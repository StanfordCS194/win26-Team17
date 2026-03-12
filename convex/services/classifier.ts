/**
 * Classifier Module
 *
 * Uses @convex-dev/agent for per-mention sentiment classification
 * and optional LLM synthesis. Model-agnostic via the Vercel AI SDK.
 */

import { Agent } from "@convex-dev/agent";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { z } from "zod";
import { components } from "../_generated/api";
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

// ============================================================================
// Schemas
// ============================================================================

const llmMentionClassificationSchema = z.object({
  sentiment: z.enum(["positive", "neutral", "negative"]),
  sentimentScore: z
    .number()
    .min(0)
    .max(100)
    .describe(
      "Sentiment intensity from 0 (most negative) to 100 (most positive). Use the full range: 85-100 for strongly positive, 70-84 for mildly positive, 45-55 for neutral, 16-30 for mildly negative, 0-15 for strongly negative."
    ),
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

function createClassifierAgent() {
  return new Agent(components.agent, {
    name: "mention-classifier",
    languageModel: getModel(),
    instructions: `You are a product feedback classifier. For each user mention about a product, determine:

1. Sentiment: positive, neutral, or negative
2. Sentiment score: 0-100 intensity (use the full range -- strongly positive should be 85+, mildly positive 70-84, neutral 45-55, mildly negative 16-30, strongly negative 0-15)
3. Relevant aspects: which of [Price, Quality, Durability, Usability] the mention discusses
4. Relevance: whether the mention is genuinely about the product

Be precise. A mention can discuss zero or multiple aspects. Only mark aspects that are clearly discussed, not merely implied.

Aspect definitions:
- Price: cost, pricing, value for money, subscription, free tier, expensive, cheap
- Quality: build quality, reliability, polish, bugs, stability, craftsmanship
- Durability: longevity, lasting, breaking, wear, lifespan, long-term use
- Usability: ease of use, UX, UI, learning curve, intuitive, workflow, navigation

Examples:
- "It's expensive but incredibly reliable" -> sentiment: positive, sentimentScore: 65, aspects: [Price, Quality], relevant: true
- "I switched from ProductName to a competitor last month" -> sentiment: negative, sentimentScore: 35, aspects: [], relevant: true
- "Someone in the thread mentioned ProductName but was talking about something else" -> relevant: false

Be alert for sarcasm or irony (e.g. "This product is *great*, if you love waiting 10 minutes to load"). Classify based on the actual intent, not surface-level word choice.`,
  });
}

function createSynthesizerAgent() {
  return new Agent(components.agent, {
    name: "report-synthesizer",
    languageModel: getModel(),
    instructions: `You summarize product feedback data into executive reports. You receive pre-classified mention data with sentiment labels and aspect tags. Your job is to:

1. Identify 2-4 distinct positive themes (strengths)
2. Identify 2-4 distinct negative themes (issues)
3. Write a concise 2-3 sentence executive summary

Reference specific mention indices that support each theme. Do not re-analyze sentiment -- use the provided classifications. Each theme title should be specific and descriptive (not generic like "User Feedback").`,
  });
}

type ClassifierAgent = ReturnType<typeof createClassifierAgent>;
type SynthesizerAgent = ReturnType<typeof createSynthesizerAgent>;

// ============================================================================
// Classification
// ============================================================================

const CLASSIFY_BATCH_SIZE = 25;
const CLASSIFY_TEXT_LIMIT = 500;
const SYNTHESIS_TEXT_LIMIT = 500;
const SHOULD_USE_LLM_SYNTHESIS =
  process.env.PIPELINE_USE_LLM_SYNTHESIS !== "false";
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
  classification: Omit<MentionClassification, "sentimentScore"> & { sentimentScore?: number }
): MentionClassification {
  const fallback =
    classification.sentiment === "positive"
      ? 75
      : classification.sentiment === "negative"
        ? 25
        : 50;
  return {
    ...classification,
    sentimentScore:
      classification.sentimentScore != null ? classification.sentimentScore : fallback,
  };
}

/**
 * Classify one mention in isolation with no saved thread history.
 */
async function classifySingleMention(
  ctx: ActionCtx,
  agent: ClassifierAgent,
  productName: string,
  mention: RawMention,
  threadId: string
): Promise<ClassifiedMention> {
  const { object } = await agent.generateObject(
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
  agent: ClassifierAgent,
  productName: string,
  mentions: RawMention[]
): Promise<ClassifiedMention[]> {
  const { threadId } = await agent.createThread(ctx, {});
  const results = await Promise.allSettled(
    mentions.map((mention) =>
      classifySingleMention(ctx, agent, productName, mention, threadId)
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
  agent: ClassifierAgent,
  productName: string,
  mentions: RawMention[]
): Promise<ClassifiedMention[]> {
  if (mentions.length === 0) return [];

  const { threadId } = await agent.createThread(ctx, {});
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
    const { object } = await agent.generateObject(
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
        return await classifyIndividually(ctx, agent, productName, mentions);
      }

      const midpoint = Math.ceil(mentions.length / 2);
      console.warn(
        `Batch classification returned ${object.classifications.length} results for ${mentions.length} mentions; retrying in smaller batches`
      );
      const [left, right] = await Promise.all([
        classifyBatch(ctx, agent, productName, mentions.slice(0, midpoint)),
        classifyBatch(ctx, agent, productName, mentions.slice(midpoint)),
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
      return await classifyIndividually(ctx, agent, productName, mentions);
    }

    const midpoint = Math.ceil(mentions.length / 2);
    console.warn(
      `Batch classification failed for ${mentions.length} mentions; retrying in smaller batches:`,
      error
    );
    const [left, right] = await Promise.all([
      classifyBatch(ctx, agent, productName, mentions.slice(0, midpoint)),
      classifyBatch(ctx, agent, productName, mentions.slice(midpoint)),
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
): Promise<ClassifiedMention[]> {
  if (mentions.length === 0) return [];

  const classifierAgent = createClassifierAgent();

  const batches: RawMention[][] = [];
  for (let i = 0; i < mentions.length; i += CLASSIFY_BATCH_SIZE) {
    batches.push(mentions.slice(i, i + CLASSIFY_BATCH_SIZE));
  }

  const batchResults = await Promise.all(
    batches.map((batch) => classifyBatch(ctx, classifierAgent, productName, batch))
  );

  return batchResults.flat();
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
  scores: {
    overallScore: number;
    aspects: Array<{ name: string; score: number; mentions: number }>;
    confidence?: { overall: number; coverage: number; agreement: number };
  }
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

  const synthesizerAgent: SynthesizerAgent = createSynthesizerAgent();
  const { threadId } = await synthesizerAgent.createThread(ctx, {});
  const mentionSummaries = mentions.map((m, i) => ({
    index: i,
    text: m.text.slice(0, SYNTHESIS_TEXT_LIMIT),
    sentiment: m.classification.sentiment,
    aspects: m.classification.aspects,
  }));

  const sentimentDist = {
    positive: mentions.filter((m) => m.classification.sentiment === "positive").length,
    neutral: mentions.filter((m) => m.classification.sentiment === "neutral").length,
    negative: mentions.filter((m) => m.classification.sentiment === "negative").length,
  };

  const prompt = `Analyze ${mentionSummaries.length} classified mentions about "${productName}".

Overall score: ${scores.overallScore}/100
Sentiment distribution: ${sentimentDist.positive} positive, ${sentimentDist.neutral} neutral, ${sentimentDist.negative} negative
Aspect scores: ${scores.aspects.map((a) => `${a.name}: ${a.score}/100 (${a.mentions} mentions)`).join(", ")}${scores.confidence ? `\nData confidence: ${Math.round(scores.confidence.overall * 100)}% (coverage: ${Math.round(scores.confidence.coverage * 100)}%, agreement: ${Math.round(scores.confidence.agreement * 100)}%)` : ""}

Classified mentions:
${JSON.stringify(mentionSummaries, null, 2)}

Identify 2-4 strengths (positive themes) and 2-4 issues (negative themes). Reference mention indices that support each theme. Focus on themes supported by 2+ mentions; avoid surfacing one-off comments as themes.`;

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
