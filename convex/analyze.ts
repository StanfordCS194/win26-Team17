// Doc: Natural_Language_Code/pipeline/info_pipeline.md

import Anthropic from "@anthropic-ai/sdk";
import { RedditContent } from "./reddit";

const STANDARD_ASPECTS = [
  "Value for Money",
  "Quality & Durability",
  "Ease of Use",
  "Customer Support",
  "Features & Functionality",
  "Overall Satisfaction",
] as const;

interface AnalysisResult {
  productName: string;
  overallScore: number;
  totalMentions: number;
  sourcesAnalyzed: number;
  generatedAt: string;
  summary: string;
  strengths: {
    title: string;
    description: string;
    frequency: number;
    quotes: {
      text: string;
      source: "reddit" | "g2";
      author: string;
      date: string;
      url: string;
    }[];
  }[];
  issues: {
    title: string;
    description: string;
    frequency: number;
    quotes: {
      text: string;
      source: "reddit" | "g2";
      author: string;
      date: string;
      url: string;
    }[];
  }[];
  aspects: {
    name: string;
    score: number;
    mentions: number;
    trend: "up" | "down" | "stable";
  }[];
}

function formatRedditDataForPrompt(
  content: RedditContent,
  productName: string,
  brandName: string
): string {
  const lines: string[] = [];
  lines.push(`Product: ${brandName} ${productName}`);
  lines.push(`\n=== REDDIT POSTS (${content.posts.length}) ===\n`);

  for (const post of content.posts.slice(0, 15)) {
    const date = new Date(post.created_utc * 1000).toISOString().split("T")[0];
    lines.push(`--- Post by u/${post.author} | Score: ${post.score} | Date: ${date} | r/${post.subreddit} ---`);
    lines.push(`Title: ${post.title}`);
    if (post.selftext) {
      lines.push(`Body: ${post.selftext.slice(0, 800)}`);
    }
    lines.push(`URL: https://www.reddit.com${post.permalink}`);
    lines.push("");
  }

  lines.push(`\n=== REDDIT COMMENTS (${content.comments.length}) ===\n`);

  for (const comment of content.comments.slice(0, 30)) {
    const date = new Date(comment.created_utc * 1000).toISOString().split("T")[0];
    lines.push(`--- Comment by u/${comment.author} | Score: ${comment.score} | Date: ${date} ---`);
    lines.push(comment.body.slice(0, 500));
    lines.push(`URL: https://www.reddit.com${comment.permalink}`);
    lines.push("");
  }

  return lines.join("\n");
}

function buildPrompt(formattedData: string, productName: string, brandName: string): string {
  return `You are an expert product analyst. Analyze the following real user discussions about "${brandName} ${productName}" from Reddit and produce a structured sentiment analysis report.

${formattedData}

INSTRUCTIONS:
1. Analyze ALL the content above carefully.
2. Score each of the 6 standard aspects from 0-100 using this rubric:
   - 0-30: Very negative sentiment
   - 31-50: Mostly negative
   - 51-65: Mixed/neutral
   - 66-75: Mostly positive
   - 76-100: Very positive
3. Extract REAL quotes from the provided content (do NOT fabricate quotes).
4. Identify 3-5 top strengths and 3-5 top issues, ranked by how frequently they appear.
5. Each strength/issue must include 1-3 supporting quotes from the actual content.
6. Determine trends: "up" if recent mentions are more positive, "down" if more negative, "stable" if consistent.

Output ONLY valid JSON matching this exact schema (no markdown, no explanation):

{
  "productName": "${productName}",
  "overallScore": <number 0-100>,
  "totalMentions": <total posts + comments analyzed>,
  "sourcesAnalyzed": 1,
  "summary": "<2-3 sentence executive summary>",
  "strengths": [
    {
      "title": "<short title>",
      "description": "<1-2 sentence description>",
      "frequency": <number of mentions>,
      "quotes": [
        {
          "text": "<exact quote from the content>",
          "source": "reddit",
          "author": "<username from the content>",
          "date": "<date from the content>",
          "url": "<url from the content>"
        }
      ]
    }
  ],
  "issues": [
    {
      "title": "<short title>",
      "description": "<1-2 sentence description>",
      "frequency": <number of mentions>,
      "quotes": [
        {
          "text": "<exact quote from the content>",
          "source": "reddit",
          "author": "<username from the content>",
          "date": "<date from the content>",
          "url": "<url from the content>"
        }
      ]
    }
  ],
  "aspects": [
    { "name": "Value for Money", "score": <0-100>, "mentions": <number>, "trend": "<up|down|stable>" },
    { "name": "Quality & Durability", "score": <0-100>, "mentions": <number>, "trend": "<up|down|stable>" },
    { "name": "Ease of Use", "score": <0-100>, "mentions": <number>, "trend": "<up|down|stable>" },
    { "name": "Customer Support", "score": <0-100>, "mentions": <number>, "trend": "<up|down|stable>" },
    { "name": "Features & Functionality", "score": <0-100>, "mentions": <number>, "trend": "<up|down|stable>" },
    { "name": "Overall Satisfaction", "score": <0-100>, "mentions": <number>, "trend": "<up|down|stable>" }
  ]
}

IMPORTANT: You MUST include ALL 6 aspects listed above. Output ONLY the JSON object, nothing else.`;
}

function validateAndFixResult(result: any, productName: string): AnalysisResult {
  // Ensure all 6 aspects exist
  const aspectMap = new Map<string, any>();
  for (const aspect of result.aspects ?? []) {
    aspectMap.set(aspect.name, aspect);
  }

  const aspects = STANDARD_ASPECTS.map((name) => {
    const existing = aspectMap.get(name);
    if (existing) {
      return {
        name,
        score: Math.max(0, Math.min(100, existing.score ?? 50)),
        mentions: existing.mentions ?? 0,
        trend: (["up", "down", "stable"].includes(existing.trend) ? existing.trend : "stable") as "up" | "down" | "stable",
      };
    }
    // Fill missing aspect with neutral score
    return { name, score: 50, mentions: 0, trend: "stable" as const };
  });

  // Validate quotes have correct source type
  const fixQuotes = (quotes: any[]) =>
    (quotes ?? []).map((q: any) => ({
      text: q.text ?? "",
      source: "reddit" as const,
      author: q.author ?? "unknown",
      date: q.date ?? new Date().toISOString().split("T")[0],
      url: q.url ?? "",
    }));

  const fixInsights = (insights: any[]) =>
    (insights ?? []).map((i: any) => ({
      title: i.title ?? "",
      description: i.description ?? "",
      frequency: i.frequency ?? 0,
      quotes: fixQuotes(i.quotes),
    }));

  return {
    productName: result.productName ?? productName,
    overallScore: Math.max(0, Math.min(100, result.overallScore ?? 50)),
    totalMentions: result.totalMentions ?? 0,
    sourcesAnalyzed: result.sourcesAnalyzed ?? 1,
    generatedAt: new Date().toISOString(),
    summary: result.summary ?? "Analysis complete.",
    strengths: fixInsights(result.strengths),
    issues: fixInsights(result.issues),
    aspects,
  };
}

export async function analyzeWithClaude(
  content: RedditContent,
  productName: string,
  brandName: string,
  apiKey: string
): Promise<AnalysisResult> {
  const client = new Anthropic({ apiKey });
  const formattedData = formatRedditDataForPrompt(content, productName, brandName);
  const prompt = buildPrompt(formattedData, productName, brandName);

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    messages: [{ role: "user", content: prompt }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from Claude");
  }

  let parsed: any;
  try {
    // Strip potential markdown fences
    let raw = textBlock.text.trim();
    if (raw.startsWith("```")) {
      raw = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new Error(`Failed to parse Claude response as JSON: ${(e as Error).message}`);
  }

  return validateAndFixResult(parsed, productName);
}
