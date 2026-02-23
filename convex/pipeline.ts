import { action, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { RedditClient, RedditComment, RedditPost, searchSoftwareProduct, isMentionRelevant } from "./services/reddit";
import { createGeminiClient } from "./services/gemini";

// ============================================================================
// Simple Sentiment Analysis (fallback when Gemini unavailable)
// ============================================================================

const POSITIVE_WORDS = [
  "love", "great", "awesome", "amazing", "excellent", "fantastic", "perfect",
  "best", "helpful", "easy", "intuitive", "powerful", "recommend", "smooth",
  "fast", "reliable", "beautiful", "clean", "simple", "efficient", "impressed"
];

const NEGATIVE_WORDS = [
  "hate", "terrible", "awful", "horrible", "worst", "bad", "frustrating",
  "slow", "buggy", "broken", "annoying", "confusing", "expensive", "poor",
  "disappointing", "difficult", "complicated", "crash", "laggy", "unusable"
];

function analyzeSentiment(text: string): { score: number; isPositive: boolean } {
  const lower = text.toLowerCase();
  let positiveCount = 0;
  let negativeCount = 0;

  for (const word of POSITIVE_WORDS) {
    if (lower.includes(word)) positiveCount++;
  }
  for (const word of NEGATIVE_WORDS) {
    if (lower.includes(word)) negativeCount++;
  }

  const total = positiveCount + negativeCount;
  if (total === 0) return { score: 50, isPositive: true };

  const score = Math.round((positiveCount / total) * 100);
  return { score, isPositive: positiveCount >= negativeCount };
}

// ============================================================================
// Helper Functions
// ============================================================================

interface MentionWithSentiment {
  text: string;
  author: string;
  date: string;
  url: string;
  score: number;
  isPositive: boolean;
  source: "reddit";
}

function processRedditData(
  posts: Array<{ post: RedditPost; comments: RedditComment[] }>,
  productName: string
): MentionWithSentiment[] {
  const mentions: MentionWithSentiment[] = [];

  for (const { post, comments } of posts) {
    if (post.content && post.content.length > 50 && isMentionRelevant(post.content, productName)) {
      const sentiment = analyzeSentiment(post.content);
      mentions.push({
        text: post.content.slice(0, 500),
        author: post.author,
        date: post.createdAt,
        url: post.permalink,
        score: sentiment.score,
        isPositive: sentiment.isPositive,
        source: "reddit",
      });
    }

    for (const comment of comments) {
      if (comment.content && comment.content.length > 30 && isMentionRelevant(comment.content, productName)) {
        const sentiment = analyzeSentiment(comment.content);
        mentions.push({
          text: comment.content.slice(0, 500),
          author: comment.author,
          date: comment.createdAt,
          url: comment.permalink,
          score: sentiment.score,
          isPositive: sentiment.isPositive,
          source: "reddit",
        });
      }
    }
  }

  return mentions;
}

// Fallback analysis without Gemini
function createBasicInsights(mentions: MentionWithSentiment[], isPositive: boolean) {
  const filtered = mentions.filter((m) => m.isPositive === isPositive);

  if (filtered.length === 0) {
    return [{
      title: isPositive ? "Limited positive feedback" : "Limited negative feedback",
      description: isPositive
        ? "Not enough positive mentions found to identify clear strengths."
        : "Not enough negative mentions found to identify clear issues.",
      frequency: 0,
      quotes: [],
    }];
  }

  const sorted = filtered.sort((a, b) => b.text.length - a.text.length);
  const topMentions = sorted.slice(0, Math.min(5, sorted.length));

  return [{
    title: isPositive ? "User Feedback Highlights" : "Areas for Improvement",
    description: isPositive
      ? `Users shared ${filtered.length} positive mentions about this product.`
      : `Users identified ${filtered.length} areas where improvements could be made.`,
    frequency: filtered.length,
    quotes: topMentions.map((m) => ({
      text: m.text,
      source: m.source as "reddit" | "g2",
      author: m.author,
      date: m.date,
      url: m.url,
    })),
  }];
}

function calculateBasicScore(mentions: MentionWithSentiment[]): number {
  if (mentions.length === 0) return 50;
  const avgScore = mentions.reduce((sum, m) => sum + m.score, 0) / mentions.length;
  return Math.round(avgScore);
}

function createBasicAspects(mentions: MentionWithSentiment[]) {
  const aspects = [
    { name: "Features", keywords: ["feature", "functionality", "tool", "option", "capability"] },
    { name: "Ease of Use", keywords: ["easy", "intuitive", "simple", "user-friendly", "learning curve", "ux", "ui"] },
    { name: "Performance", keywords: ["fast", "slow", "speed", "performance", "lag", "quick", "responsive"] },
  ];

  return aspects.map((aspect) => {
    const relevant = mentions.filter((m) =>
      aspect.keywords.some((kw) => m.text.toLowerCase().includes(kw))
    );

    const score = relevant.length > 0
      ? Math.round(relevant.reduce((sum, m) => sum + m.score, 0) / relevant.length)
      : 50;

    return {
      name: aspect.name,
      score,
      mentions: relevant.length,
      trend: "stable" as const,
    };
  });
}

// ============================================================================
// Internal Mutations
// ============================================================================

export const updateReportStatus = internalMutation({
  args: {
    reportId: v.id("productReports"),
    status: v.union(
      v.literal("pending"),
      v.literal("fetching"),
      v.literal("analyzing"),
      v.literal("complete"),
      v.literal("error")
    ),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.reportId, {
      status: args.status,
      errorMessage: args.errorMessage,
    });
  },
});

export const saveReportResults = internalMutation({
  args: {
    reportId: v.id("productReports"),
    overallScore: v.number(),
    totalMentions: v.number(),
    sourcesAnalyzed: v.number(),
    summary: v.string(),
    strengths: v.array(
      v.object({
        title: v.string(),
        description: v.string(),
        frequency: v.number(),
        quotes: v.array(
          v.object({
            text: v.string(),
            source: v.union(v.literal("reddit"), v.literal("g2")),
            author: v.string(),
            date: v.string(),
            url: v.string(),
          })
        ),
      })
    ),
    issues: v.array(
      v.object({
        title: v.string(),
        description: v.string(),
        frequency: v.number(),
        quotes: v.array(
          v.object({
            text: v.string(),
            source: v.union(v.literal("reddit"), v.literal("g2")),
            author: v.string(),
            date: v.string(),
            url: v.string(),
          })
        ),
      })
    ),
    aspects: v.array(
      v.object({
        name: v.string(),
        score: v.number(),
        mentions: v.number(),
        trend: v.union(v.literal("up"), v.literal("down"), v.literal("stable")),
      })
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.reportId, {
      status: "complete",
      overallScore: args.overallScore,
      totalMentions: args.totalMentions,
      sourcesAnalyzed: args.sourcesAnalyzed,
      summary: args.summary,
      strengths: args.strengths,
      issues: args.issues,
      aspects: args.aspects,
    });
  },
});

// ============================================================================
// Main Pipeline Action
// ============================================================================

export const generateReport = action({
  args: {
    reportId: v.id("productReports"),
    productName: v.string(),
  },
  handler: async (ctx, args): Promise<void> => {
    const { reportId, productName } = args;

    try {
      // Update status: fetching
      await ctx.runMutation(internal.pipeline.updateReportStatus, {
        reportId,
        status: "fetching",
      });

      // Fetch Reddit data with software-focused search
      const reddit = new RedditClient({ cacheTtlMs: 60000 });
      const results = await searchSoftwareProduct(reddit, productName, {
        postLimit: 25,
        commentsPerPost: 25,
      });

      // Update status: analyzing
      await ctx.runMutation(internal.pipeline.updateReportStatus, {
        reportId,
        status: "analyzing",
      });

      // Process mentions (per-mention relevance filtering applied inside)
      const mentions = processRedditData(results, productName);
      console.log(`Found ${mentions.length} relevant mentions for "${productName}" from ${results.length} posts`);

      // Try Gemini analysis, fall back to basic if unavailable
      let summary: string;
      let overallScore: number;
      let strengths: Array<{
        title: string;
        description: string;
        frequency: number;
        quotes: Array<{ text: string; source: "reddit" | "g2"; author: string; date: string; url: string }>;
      }>;
      let issues: typeof strengths;
      let aspects: Array<{ name: string; score: number; mentions: number; trend: "up" | "down" | "stable" }>;

      const geminiApiKey = process.env.GEMINI_API_KEY;

      if (geminiApiKey && mentions.length > 0) {
        try {
          console.log("Using Gemini for analysis...");
          const gemini = createGeminiClient(geminiApiKey);
          const analysis = await gemini.analyzeProductFeedback(productName, mentions);

          summary = analysis.summary;
          overallScore = analysis.overallScore;
          strengths = analysis.strengths.map((s) => ({
            ...s,
            quotes: s.quotes.map((q) => ({ ...q, source: "reddit" as const })),
          }));
          issues = analysis.issues.map((i) => ({
            ...i,
            quotes: i.quotes.map((q) => ({ ...q, source: "reddit" as const })),
          }));
          aspects = analysis.aspects.map((a) => ({ ...a, trend: "stable" as const }));

          console.log("Gemini analysis complete");
        } catch (error) {
          console.warn("Gemini analysis failed, using fallback:", error);
          // Fall back to basic analysis
          summary = `Analysis of ${mentions.length} mentions from Reddit.`;
          overallScore = calculateBasicScore(mentions);
          strengths = createBasicInsights(mentions, true);
          issues = createBasicInsights(mentions, false);
          aspects = createBasicAspects(mentions);
        }
      } else {
        // No Gemini key or no mentions - use basic analysis
        console.log("Using basic analysis (no Gemini key or no mentions)");
        const positiveMentions = mentions.filter((m) => m.isPositive).length;
        const negativeMentions = mentions.length - positiveMentions;

        summary = mentions.length > 0
          ? `Analysis of ${mentions.length} mentions from Reddit. Found ${positiveMentions} positive and ${negativeMentions} negative mentions.`
          : `Limited data found for "${productName}".`;
        overallScore = calculateBasicScore(mentions);
        strengths = createBasicInsights(mentions, true);
        issues = createBasicInsights(mentions, false);
        aspects = createBasicAspects(mentions);
      }

      // Save results
      await ctx.runMutation(internal.pipeline.saveReportResults, {
        reportId,
        overallScore,
        totalMentions: mentions.length,
        sourcesAnalyzed: 1,
        summary,
        strengths,
        issues,
        aspects,
      });
    } catch (error) {
      console.error("Pipeline error:", error);
      await ctx.runMutation(internal.pipeline.updateReportStatus, {
        reportId,
        status: "error",
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
});
