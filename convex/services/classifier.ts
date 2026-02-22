/**
 * Classifier Module
 *
 * Uses @convex-dev/agent for per-mention sentiment classification
 * and report synthesis. Model-agnostic via the Vercel AI SDK.
 */

import { Agent } from "@convex-dev/agent";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { z } from "zod";
import { components } from "../_generated/api";
import type { ActionCtx } from "../_generated/server";
import type { Aspect, ClassifiedMention, MentionClassification } from "./scoring";
import { ASPECTS } from "./scoring";

// ============================================================================
// Types
// ============================================================================

export interface RawMention {
  text: string;
  author: string;
  date: string;
  url: string;
  source: "reddit";
}

// ============================================================================
// Schemas
// ============================================================================

const mentionClassificationSchema = z.object({
  sentiment: z.enum(["positive", "neutral", "negative"]),
  sentimentScore: z
    .number()
    .min(0)
    .max(100)
    .describe("0 = extremely negative, 50 = neutral, 100 = extremely positive"),
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
  model: getModel(),
  instructions: `You are a product feedback classifier. For each user mention about a product, determine:

1. Sentiment: positive, neutral, or negative
2. Sentiment score: 0-100 (0 = extremely negative, 50 = neutral, 100 = extremely positive)
3. Relevant aspects: which of [Price, Quality, Durability, Usability] the mention discusses
4. Relevance: whether the mention is genuinely about the product

Be precise. A mention can discuss zero or multiple aspects. Only mark aspects that are clearly discussed, not merely implied.

Aspect definitions:
- Price: cost, pricing, value for money, subscription, free tier, expensive, cheap
- Quality: build quality, reliability, polish, bugs, stability, craftsmanship
- Durability: longevity, lasting, breaking, wear, lifespan, long-term use
- Usability: ease of use, UX, UI, learning curve, intuitive, workflow, navigation`,
});

const synthesizerAgent = new Agent(components.agent, {
  name: "report-synthesizer",
  model: getModel(),
  instructions: `You summarize product feedback data into executive reports. You receive pre-classified mention data with sentiment labels and aspect tags. Your job is to:

1. Identify 2-4 distinct positive themes (strengths)
2. Identify 2-4 distinct negative themes (issues)
3. Write a concise 2-3 sentence executive summary

Reference specific mention indices that support each theme. Do not re-analyze sentiment -- use the provided classifications. Each theme title should be specific and descriptive (not generic like "User Feedback").`,
});

// ============================================================================
// Classification
// ============================================================================

const CLASSIFY_BATCH_SIZE = 10;

/**
 * Classify a batch of mentions concurrently.
 * Returns classified mentions. Individual failures are logged and skipped.
 */
async function classifyBatch(
  ctx: ActionCtx,
  productName: string,
  mentions: RawMention[],
  threadId: string
): Promise<ClassifiedMention[]> {
  const results = await Promise.allSettled(
    mentions.map(async (mention) => {
      const { object } = await classifierAgent.generateObject(
        ctx,
        { threadId },
        {
          schema: mentionClassificationSchema,
          prompt: `Classify this user mention about "${productName}":\n\n"${mention.text}"`,
        }
      );
      return {
        ...mention,
        classification: object as MentionClassification,
      };
    })
  );

  const classified: ClassifiedMention[] = [];
  for (const result of results) {
    if (result.status === "fulfilled") {
      classified.push(result.value);
    } else {
      console.warn("Failed to classify mention:", result.reason);
    }
  }
  return classified;
}

/**
 * Classify all mentions in batches.
 * Creates a single thread for the classification run.
 */
export async function classifyMentions(
  ctx: ActionCtx,
  productName: string,
  mentions: RawMention[]
): Promise<ClassifiedMention[]> {
  if (mentions.length === 0) return [];

  const { threadId } = await classifierAgent.createThread(ctx, {});
  const allClassified: ClassifiedMention[] = [];

  for (let i = 0; i < mentions.length; i += CLASSIFY_BATCH_SIZE) {
    const batch = mentions.slice(i, i + CLASSIFY_BATCH_SIZE);
    const classified = await classifyBatch(ctx, productName, batch, threadId);
    allClassified.push(...classified);
  }

  return allClassified;
}

// ============================================================================
// Synthesis
// ============================================================================

interface ReportInsight {
  title: string;
  description: string;
  frequency: number;
  quotes: Array<{
    text: string;
    source: "reddit";
    author: string;
    date: string;
    url: string;
  }>;
}

export interface SynthesizedReport {
  summary: string;
  strengths: ReportInsight[];
  issues: ReportInsight[];
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
      summary: `No user feedback found for "${productName}".`,
      strengths: [],
      issues: [],
    };
  }

  const { threadId } = await synthesizerAgent.createThread(ctx, {});

  const mentionSummaries = mentions.map((m, i) => ({
    index: i,
    text: m.text.slice(0, 300),
    sentiment: m.classification.sentiment,
    aspects: m.classification.aspects,
  }));

  const prompt = `Analyze ${mentions.length} classified mentions about "${productName}".

Overall score: ${scores.overallScore}/100
Aspect scores: ${scores.aspects.map((a) => `${a.name}: ${a.score}/100 (${a.mentions} mentions)`).join(", ")}

Classified mentions:
${JSON.stringify(mentionSummaries, null, 2)}

Identify 2-4 strengths (positive themes) and 2-4 issues (negative themes). Reference mention indices that support each theme.`;

  const { object } = await synthesizerAgent.generateObject(
    ctx,
    { threadId },
    { schema: synthesisSchema, prompt }
  );

  const mapInsight = (
    insight: { title: string; description: string; mentionIndices: number[] }
  ): ReportInsight => ({
    title: insight.title,
    description: insight.description,
    frequency: insight.mentionIndices.length,
    quotes: insight.mentionIndices
      .filter((idx) => idx >= 0 && idx < mentions.length)
      .slice(0, 5)
      .map((idx) => ({
        text: mentions[idx].text,
        source: "reddit" as const,
        author: mentions[idx].author,
        date: mentions[idx].date,
        url: mentions[idx].url,
      })),
  });

  return {
    summary: object.summary,
    strengths: object.strengths.map(mapInsight),
    issues: object.issues.map(mapInsight),
  };
}
