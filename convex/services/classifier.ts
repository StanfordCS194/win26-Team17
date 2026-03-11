/**
 * Classifier Module
 *
 * Uses @convex-dev/agent for per-mention sentiment classification
 * and optional LLM synthesis. Model-agnostic via the Vercel AI SDK.
 */

import { Agent } from "@convex-dev/agent";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { z } from "zod";
import { internal, components } from "../_generated/api";
import type { ActionCtx } from "../_generated/server";
import type { ClassifiedMention, MentionClassification } from "./scoring";
import { ASPECTS } from "./scoring";
import {
  synthesizeReportDeterministically,
  type ReportInsight,
  type SynthesizedReport,
} from "./reportSynthesis";

// ============================================================================
// Types
// ============================================================================

export type SourceName = "reddit" | "hackernews" | "stackoverflow" | "devto";

export interface RawMention {
  text: string;
  author: string;
  date: string;
  url: string;
  source: SourceName;
}

export interface ClassifyMentionsResult {
  mentions: ClassifiedMention[];
  cacheHits: number;
  cacheMisses: number;
}

// ============================================================================
// Schemas
// ============================================================================

const llmMentionClassificationSchema = z.object({
  sentiment: z.enum(["positive", "neutral", "negative"]),
  aspects: z
    .array(z.enum(ASPECTS))
    .describe(
      "Which product aspects this mention discusses. Can be empty or multiple."
    ),
  relevant: z
    .boolean()
    .describe(
      "Whether this mention is genuinely about the product, not just mentioning the name in passing."
    ),
});

const mentionBatchClassificationSchema = z.object({
  classifications: z.array(llmMentionClassificationSchema),
});

const synthesisSchema = z.object({
  summary: z
    .string()
    .describe("2-3 sentence executive summary of overall user sentiment."),
  strengths: z.array(
    z.object({
      title: z.string().describe("Short title, 3-5 words."),
      description: z.string().describe("One sentence description."),
      mentionIndices: z
        .array(z.number())
        .describe("Indices of mentions that support this strength."),
    })
  ),
  issues: z.array(
    z.object({
      title: z.string().describe("Short title, 3-5 words."),
      description: z.string().describe("One sentence description."),
      mentionIndices: z
        .array(z.number())
        .describe("Indices of mentions that support this issue."),
    })
  ),
});

// ============================================================================
// Model Provider
// ============================================================================

function getModel() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY environment variable is required. " +
        "Set it in the Convex dashboard under Settings > Environment Variables."
    );
  }
  const google = createGoogleGenerativeAI({ apiKey });
  return google("gemini-2.5-flash");
}

// ============================================================================
// Agent Definitions
// ============================================================================

const classifierAgent = new Agent(components.agent, {
  name: "mention-classifier",
  languageModel: getModel(),
  instructions: `You are a product feedback classifier. For each user mention about a product, determine:

1. Sentiment: positive, neutral, or negative
2. Relevant aspects: which of [Price, Quality, Durability, Usability] the mention discusses
3. Relevance: whether the mention is genuinely about the product

Be precise. A mention can discuss zero or multiple aspects. Only mark aspects that are clearly discussed, not merely implied.

Aspect definitions:
- Price: cost, pricing, value for money, subscription, free tier, expensive, cheap
- Quality: build quality, reliability, polish, bugs, stability, craftsmanship
- Durability: longevity, lasting, breaking, wear, lifespan, long-term use
- Usability: ease of use, UX, UI, learning curve, intuitive, workflow, navigation`,
});

const synthesizerAgent = new Agent(components.agent, {
  name: "report-synthesizer",
  languageModel: getModel(),
  instructions: `You summarize product feedback data into executive reports. You receive pre-classified mention data with sentiment labels and aspect tags. Your job is to:

1. Identify 2-4 distinct positive themes (strengths)
2. Identify 2-4 distinct negative themes (issues)
3. Write a concise 2-3 sentence executive summary

Reference specific mention indices that support each theme. Do not re-analyze sentiment -- use the provided classifications. Each theme title should be specific and descriptive (not generic like "User Feedback").`,
});

// ============================================================================
// Classification
// ============================================================================

const CLASSIFY_BATCH_SIZE = 24;
const CLASSIFY_TEXT_LIMIT = 100;
const SYNTHESIS_TEXT_LIMIT = 120;
const SHOULD_USE_LLM_SYNTHESIS =
  process.env.PIPELINE_USE_LLM_SYNTHESIS === "true";
const NO_HISTORY_AGENT_OPTIONS = {
  storageOptions: {
    saveMessages: "none" as const,
  },
};

function isQuotaError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();
  return (
    normalized.includes("quota exceeded") ||
    normalized.includes("resource_exhausted") ||
    normalized.includes("429")
  );
}

function withDerivedSentimentScore(
  classification: Omit<MentionClassification, "sentimentScore">
): MentionClassification {
  return {
    ...classification,
    sentimentScore:
      classification.sentiment === "positive"
        ? 75
        : classification.sentiment === "negative"
          ? 25
          : 50,
  };
}

function normalizeCacheText(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function hashText(text: string): string {
  let hash = 2166136261;

  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return `${(hash >>> 0).toString(16).padStart(8, "0")}:${text.length.toString(36)}`;
}

function getMentionCacheKey(mention: RawMention): string {
  return hashText(normalizeCacheText(mention.text));
}

/**
 * Classify one mention in isolation with no saved thread history.
 */
async function classifySingleMention(
  ctx: ActionCtx,
  productName: string,
  mention: RawMention,
  threadId: string
): Promise<ClassifiedMention> {
  const { object } = await classifierAgent.generateObject(
    ctx,
    { threadId },
    {
      schema: llmMentionClassificationSchema,
      prompt: `Classify this user mention about "${productName}":\n\n"${mention.text.slice(0, CLASSIFY_TEXT_LIMIT)}"`,
    },
    NO_HISTORY_AGENT_OPTIONS
  );

  return {
    ...mention,
    classification: withDerivedSentimentScore(
      object as Omit<MentionClassification, "sentimentScore">
    ),
  };
}

/**
 * Fallback path if a batched classification response is malformed.
 */
async function classifyIndividually(
  ctx: ActionCtx,
  productName: string,
  mentions: RawMention[]
): Promise<ClassifiedMention[]> {
  const { threadId } = await classifierAgent.createThread(ctx, {});
  const results = await Promise.allSettled(
    mentions.map((mention) =>
      classifySingleMention(ctx, productName, mention, threadId)
    )
  );

  const classified: ClassifiedMention[] = [];
  let quotaExceeded = false;

  for (const result of results) {
    if (result.status === "fulfilled") {
      classified.push(result.value);
    } else {
      const msg = (result.reason?.message ?? "").toLowerCase();
      if (msg.includes("quota") || msg.includes("rate limit") || msg.includes("resource_exhausted") || msg.includes("429")) {
        quotaExceeded = true;
      }
      console.warn("Failed to classify mention:", result.reason);
    }
  }

  if (quotaExceeded && classified.length === 0) {
    throw new Error("Gemini API quota exceeded. Daily limit reached — please try again tomorrow.");
  }

  return classified;
}

/**
 * Classify a batch of mentions in a single LLM call.
 * Falls back to individual classification if the batch response is malformed.
 */
async function classifyBatch(
  ctx: ActionCtx,
  productName: string,
  mentions: RawMention[]
): Promise<ClassifiedMention[]> {
  if (mentions.length === 0) return [];

  const { threadId } = await classifierAgent.createThread(ctx, {});
  const prompt = `Classify each numbered user mention about "${productName}".

Return exactly one classification for each mention, in the same order.

Mentions:
${mentions
  .map(
    (mention, index) =>
      `${index + 1}. ${JSON.stringify(mention.text.slice(0, CLASSIFY_TEXT_LIMIT))}`
  )
  .join("\n\n")}`;

  try {
    const { object } = await classifierAgent.generateObject(
      ctx,
      { threadId },
      {
        schema: mentionBatchClassificationSchema,
        prompt,
      },
      NO_HISTORY_AGENT_OPTIONS
    );

    if (object.classifications.length !== mentions.length) {
      if (mentions.length === 1) {
        console.warn(
          `Batch classification returned ${object.classifications.length} results for 1 mention; falling back to single classification`
        );
        return await classifyIndividually(ctx, productName, mentions);
      }

      const midpoint = Math.ceil(mentions.length / 2);
      console.warn(
        `Batch classification returned ${object.classifications.length} results for ${mentions.length} mentions; retrying in smaller batches`
      );
      const [left, right] = await Promise.all([
        classifyBatch(ctx, productName, mentions.slice(0, midpoint)),
        classifyBatch(ctx, productName, mentions.slice(midpoint)),
      ]);
      return [...left, ...right];
    }

    return mentions.map((mention, index) => ({
      ...mention,
      classification: withDerivedSentimentScore(
        object.classifications[index] as Omit<
          MentionClassification,
          "sentimentScore"
        >
      ),
    }));
  } catch (error) {
    if (isQuotaError(error)) {
      throw error;
    }

    if (mentions.length === 1) {
      console.warn(
        "Batch classification failed for a single mention; falling back to individual classification:",
        error
      );
      return await classifyIndividually(ctx, productName, mentions);
    }

    const midpoint = Math.ceil(mentions.length / 2);
    console.warn(
      `Batch classification failed for ${mentions.length} mentions; retrying in smaller batches:`,
      error
    );
    const [left, right] = await Promise.all([
      classifyBatch(ctx, productName, mentions.slice(0, midpoint)),
      classifyBatch(ctx, productName, mentions.slice(midpoint)),
    ]);
    return [...left, ...right];
  }
}

/**
 * Classify all mentions in batches.
 */
export async function classifyMentions(
  ctx: ActionCtx,
  productName: string,
  mentions: RawMention[]
): Promise<ClassifyMentionsResult> {
  if (mentions.length === 0) {
    return { mentions: [], cacheHits: 0, cacheMisses: 0 };
  }

  const normalizedProductName = productName.trim().toLowerCase();
  const cacheKeys = mentions.map((mention) => getMentionCacheKey(mention));
  const cachedEntries = await Promise.all(
    cacheKeys.map((textHash) =>
      ctx.runQuery(internal.classificationCache.getCachedClassification, {
        productName: normalizedProductName,
        textHash,
      })
    )
  );

  const classifiedByIndex = new Array<ClassifiedMention | undefined>(mentions.length);
  const uncachedMentions: RawMention[] = [];
  const uncachedIndices: number[] = [];

  for (let index = 0; index < mentions.length; index += 1) {
    const cached = cachedEntries[index];
    if (cached) {
      classifiedByIndex[index] = {
        ...mentions[index],
        classification: cached.classification as MentionClassification,
      };
      continue;
    }

    uncachedMentions.push(mentions[index]);
    uncachedIndices.push(index);
  }

  const newlyClassified: ClassifiedMention[] = [];
  for (let index = 0; index < uncachedMentions.length; index += CLASSIFY_BATCH_SIZE) {
    const batch = uncachedMentions.slice(index, index + CLASSIFY_BATCH_SIZE);
    const classified = await classifyBatch(ctx, productName, batch);
    newlyClassified.push(...classified);
  }

  if (newlyClassified.length > 0) {
    await ctx.runMutation(internal.classificationCache.upsertCachedClassifications, {
      entries: newlyClassified.map((mention) => ({
        productName: normalizedProductName,
        textHash: getMentionCacheKey(mention),
        classification: mention.classification,
      })),
    });
  }

  const newlyClassifiedByKey = new Map(
    newlyClassified.map((mention) => [getMentionCacheKey(mention), mention])
  );

  for (const uncachedIndex of uncachedIndices) {
    const classified = newlyClassifiedByKey.get(
      getMentionCacheKey(mentions[uncachedIndex])
    );
    if (classified) {
      classifiedByIndex[uncachedIndex] = classified;
    }
  }

  const allClassified = classifiedByIndex.filter(
    (mention): mention is ClassifiedMention => mention !== undefined
  );
  const cacheHits = mentions.length - uncachedMentions.length;
  const cacheMisses = uncachedMentions.length;

  console.log(
    `[classifier:${productName}] cache hits=${cacheHits}, misses=${cacheMisses}`
  );

  return {
    mentions: allClassified,
    cacheHits,
    cacheMisses,
  };
}

/**
 * Generate executive summary and grouped insights from classified data.
 * The LLM receives pre-classified mentions and computed scores --
 * it only generates the narrative, not the scores.
 */
export async function synthesizeReport(
  ctx: ActionCtx,
  productName: string,
  mentions: ClassifiedMention[],
  scores: { overallScore: number; aspects: Array<{ name: string; score: number; mentions: number }> }
): Promise<SynthesizedReport> {
  if (mentions.length === 0) {
    return {
      mode: "deterministic",
      summary: `No user feedback found for "${productName}".`,
      strengths: [],
      issues: [],
    };
  }

  if (!SHOULD_USE_LLM_SYNTHESIS) {
    return synthesizeReportDeterministically(productName, mentions, scores);
  }

  const { threadId } = await synthesizerAgent.createThread(ctx, {});
  const mentionSummaries = mentions.slice(0, 20).map((m, i) => ({
    index: i,
    text: m.text.slice(0, SYNTHESIS_TEXT_LIMIT),
    sentiment: m.classification.sentiment,
    aspects: m.classification.aspects,
  }));

  const prompt = `Analyze ${mentionSummaries.length} classified mentions about "${productName}".

Overall score: ${scores.overallScore}/100
Aspect scores: ${scores.aspects.map((a) => `${a.name}: ${a.score}/100 (${a.mentions} mentions)`).join(", ")}

Classified mentions:
${JSON.stringify(mentionSummaries, null, 2)}

Identify 2-4 strengths (positive themes) and 2-4 issues (negative themes). Reference mention indices that support each theme.`;

  try {
    const { object } = await synthesizerAgent.generateObject(
      ctx,
      { threadId },
      { schema: synthesisSchema, prompt },
      NO_HISTORY_AGENT_OPTIONS
    );

    const mapInsight = (
      insight: { title: string; description: string; mentionIndices: number[] }
    ): ReportInsight => ({
      title: insight.title,
      description: insight.description,
      frequency: insight.mentionIndices.length,
      quotes: insight.mentionIndices
        .filter((idx) => idx >= 0 && idx < mentionSummaries.length)
        .slice(0, 5)
        .map((idx) => ({
          text: mentions[idx].text,
          source: mentions[idx].source,
          author: mentions[idx].author,
          date: mentions[idx].date,
          url: mentions[idx].url,
        })),
    });

    return {
      mode: "llm",
      summary: object.summary,
      strengths: object.strengths.map(mapInsight),
      issues: object.issues.map(mapInsight),
    };
  } catch (error) {
    console.warn(
      "LLM synthesis failed; falling back to deterministic synthesis:",
      error
    );
    return synthesizeReportDeterministically(productName, mentions, scores);
  }
}
