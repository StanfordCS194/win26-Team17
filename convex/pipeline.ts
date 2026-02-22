import { action, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import {
  RedditClient,
  RedditComment,
  RedditPost,
  searchSoftwareProduct,
} from "./services/reddit";
import { deduplicateMentions } from "./services/dedup";
import { classifyMentions, synthesizeReport } from "./services/classifier";
import type { RawMention } from "./services/classifier";
import { computeAllScores, ASPECTS } from "./services/scoring";

// ============================================================================
// Helper: Extract Raw Mentions from Reddit Data
// ============================================================================

function extractMentions(
  posts: Array<{ post: RedditPost; comments: RedditComment[] }>
): RawMention[] {
  const mentions: RawMention[] = [];

  for (const { post, comments } of posts) {
    if (post.content && post.content.length > 50) {
      mentions.push({
        text: post.content.slice(0, 500),
        author: post.author,
        date: post.createdAt,
        url: post.permalink,
        source: "reddit",
      });
    }

    for (const comment of comments) {
      if (comment.content && comment.content.length > 30) {
        mentions.push({
          text: comment.content.slice(0, 500),
          author: comment.author,
          date: comment.createdAt,
          url: comment.permalink,
          source: "reddit",
        });
      }
    }
  }

  return mentions;
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
      v.literal("classifying"),
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
    issueRadar: v.array(
      v.object({
        aspect: v.string(),
        score: v.number(),
        mentionCount: v.number(),
        sentimentScore: v.number(),
      })
    ),
    confidence: v.object({
      overall: v.number(),
      coverage: v.number(),
      agreement: v.number(),
      sourceDiversity: v.number(),
    }),
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
      issueRadar: args.issueRadar,
      confidence: args.confidence,
    });
  },
});

// ============================================================================
// Main Pipeline Action (6-Stage Flow)
// ============================================================================

export const generateReport = action({
  args: {
    reportId: v.id("productReports"),
    productName: v.string(),
  },
  handler: async (ctx, args): Promise<void> => {
    const { reportId, productName } = args;

    try {
      // ----------------------------------------------------------------
      // STAGE 1: COLLECT -- Fetch Reddit posts and comments
      // ----------------------------------------------------------------
      await ctx.runMutation(internal.pipeline.updateReportStatus, {
        reportId,
        status: "fetching",
      });

      const reddit = new RedditClient({ cacheTtlMs: 60000 });
      const results = await searchSoftwareProduct(reddit, productName, {
        postLimit: 10,
        commentsPerPost: 20,
      });

      const rawMentions = extractMentions(results);

      // Handle empty results early
      if (rawMentions.length === 0) {
        await ctx.runMutation(internal.pipeline.saveReportResults, {
          reportId,
          overallScore: 50,
          totalMentions: 0,
          sourcesAnalyzed: 1,
          summary: `No user feedback found for "${productName}".`,
          strengths: [],
          issues: [],
          aspects: ASPECTS.map((name) => ({
            name,
            score: 50,
            mentions: 0,
            trend: "stable" as const,
          })),
          issueRadar: [],
          confidence: { overall: 0, coverage: 0, agreement: 0, sourceDiversity: 0 },
        });
        return;
      }

      // ----------------------------------------------------------------
      // STAGE 2: PREPROCESS -- Deduplicate content
      // ----------------------------------------------------------------
      const dedupedMentions = deduplicateMentions(rawMentions);
      console.log(
        `Deduplication: ${rawMentions.length} raw -> ${dedupedMentions.length} unique mentions`
      );

      // ----------------------------------------------------------------
      // STAGE 3: CLASSIFY -- Per-mention sentiment + aspect labels
      // ----------------------------------------------------------------
      await ctx.runMutation(internal.pipeline.updateReportStatus, {
        reportId,
        status: "classifying",
      });

      const classifiedMentions = await classifyMentions(
        ctx,
        productName,
        dedupedMentions
      );
      const relevantMentions = classifiedMentions.filter(
        (m) => m.classification.relevant
      );
      console.log(
        `Classification: ${classifiedMentions.length} classified, ${relevantMentions.length} relevant`
      );

      // ----------------------------------------------------------------
      // STAGE 4: AGGREGATE -- Deterministic score computation
      // ----------------------------------------------------------------
      await ctx.runMutation(internal.pipeline.updateReportStatus, {
        reportId,
        status: "analyzing",
      });

      const scores = computeAllScores(classifiedMentions);

      // ----------------------------------------------------------------
      // STAGE 5: SYNTHESIZE -- LLM generates narrative insights
      // ----------------------------------------------------------------
      const report = await synthesizeReport(
        ctx,
        productName,
        relevantMentions,
        scores
      );

      // ----------------------------------------------------------------
      // STAGE 6: ASSEMBLE -- Save to database
      // ----------------------------------------------------------------
      await ctx.runMutation(internal.pipeline.saveReportResults, {
        reportId,
        overallScore: scores.overallScore,
        totalMentions: relevantMentions.length,
        sourcesAnalyzed: 1,
        summary: report.summary,
        strengths: report.strengths,
        issues: report.issues,
        aspects: scores.aspects,
        issueRadar: scores.issueRadar,
        confidence: scores.confidence,
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
