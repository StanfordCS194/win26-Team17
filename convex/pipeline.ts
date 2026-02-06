import { action, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { RedditClient, RedditComment, RedditPost } from "./services/reddit";

// ============================================================================
// Simple Sentiment Analysis (until we add Gemini)
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
  posts: Array<{ post: RedditPost; comments: RedditComment[] }>
): MentionWithSentiment[] {
  const mentions: MentionWithSentiment[] = [];

  for (const { post, comments } of posts) {
    // Add post content if substantial
    if (post.content && post.content.length > 50) {
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

    // Add comments
    for (const comment of comments) {
      if (comment.content && comment.content.length > 30) {
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

function createInsights(mentions: MentionWithSentiment[], isPositive: boolean) {
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

  // Group by rough similarity (for now just take top mentions)
  const sorted = filtered.sort((a, b) => {
    // Prefer longer, more detailed feedback
    return b.text.length - a.text.length;
  });

  // Create insights from top mentions
  const insights = [];
  const topMentions = sorted.slice(0, Math.min(5, sorted.length));

  // Create a single insight with the quotes
  const title = isPositive
    ? "User Feedback Highlights"
    : "Areas for Improvement";

  const description = isPositive
    ? `Users shared ${filtered.length} positive mentions about this product.`
    : `Users identified ${filtered.length} areas where improvements could be made.`;

  insights.push({
    title,
    description,
    frequency: filtered.length,
    quotes: topMentions.map((m) => ({
      text: m.text,
      source: m.source as "reddit" | "g2",
      author: m.author,
      date: m.date,
      url: m.url,
    })),
  });

  return insights;
}

function calculateOverallScore(mentions: MentionWithSentiment[]): number {
  if (mentions.length === 0) return 50;

  const avgScore = mentions.reduce((sum, m) => sum + m.score, 0) / mentions.length;
  return Math.round(avgScore);
}

function createAspects(mentions: MentionWithSentiment[]) {
  // Simple aspect detection based on keywords
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
// Internal Mutations (for updating report status)
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

      // Fetch Reddit data
      const reddit = new RedditClient({ cacheTtlMs: 60000 });
      const results = await reddit.searchWithComments(productName, {
        postLimit: 10,
        commentsPerPost: 20,
      });

      // Update status: analyzing
      await ctx.runMutation(internal.pipeline.updateReportStatus, {
        reportId,
        status: "analyzing",
      });

      // Process and analyze
      const mentions = processRedditData(results);
      const strengths = createInsights(mentions, true);
      const issues = createInsights(mentions, false);
      const overallScore = calculateOverallScore(mentions);
      const aspects = createAspects(mentions);

      const positiveMentions = mentions.filter((m) => m.isPositive).length;
      const negativeMentions = mentions.length - positiveMentions;

      const summary = mentions.length > 0
        ? `Analysis of ${mentions.length} mentions from Reddit. Found ${positiveMentions} positive and ${negativeMentions} negative mentions. Overall sentiment score: ${overallScore}/100.`
        : `Limited data found for "${productName}". Try searching for a more popular product.`;

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
