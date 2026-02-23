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
            source: v.union(v.literal("reddit"), v.literal("hackernews"), v.literal("stackoverflow"), v.literal("devto")),
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
            source: v.union(v.literal("reddit"), v.literal("hackernews"), v.literal("stackoverflow"), v.literal("devto")),
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
    sourceBreakdown: v.optional(v.array(v.object({
      name: v.string(),
      label: v.string(),
      mentions: v.number(),
    }))),
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
      sourceBreakdown: args.sourceBreakdown,
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

    const pipelineStart = Date.now();
    const tag = `[pipeline:${productName}]`;

    const elapsed = (since: number) => `${((Date.now() - since) / 1000).toFixed(1)}s`;

    console.log(`${tag} Starting analysis pipeline`);

    try {
      // ----------------------------------------------------------------
      // STAGE 1: COLLECT -- Fetch Reddit posts and comments
      // ----------------------------------------------------------------
      const stage1Start = Date.now();
      console.log(`${tag} [1/6 COLLECT] Fetching Reddit data...`);

      await ctx.runMutation(internal.pipeline.updateReportStatus, {
        reportId,
        status: "fetching",
      });

      const reddit = new RedditClient({
        cacheTtlMs: 60000,
        requestDelayMs: 3000,
        retryDelayMs: 30000,
        maxRetries: 3,
      });
      const results = await searchSoftwareProduct(reddit, productName, {
        postLimit: 10,
        commentsPerPost: 20,
      });

      const rawMentions = extractMentions(results);
      const totalPosts = results.length;
      const totalComments = results.reduce((sum, r) => sum + r.comments.length, 0);
      console.log(
        `${tag} [1/6 COLLECT] Done in ${elapsed(stage1Start)} -- ` +
          `${totalPosts} posts, ${totalComments} comments, ${rawMentions.length} raw mentions`
      );

      // Handle empty results early
      if (rawMentions.length === 0) {
        console.log(`${tag} No mentions found -- setting error status`);
        await ctx.runMutation(internal.pipeline.updateReportStatus, {
          reportId,
          status: "error",
          errorMessage: `No public discussions found for "${productName}". Try a more specific software product name (e.g. "Notion", "Figma", "Linear").`,
        });
        return;
      }

      // ----------------------------------------------------------------
      // STAGE 2: PREPROCESS -- Deduplicate content
      // ----------------------------------------------------------------
      const stage2Start = Date.now();
      console.log(`${tag} [2/6 PREPROCESS] Deduplicating mentions...`);

      const dedupedMentions = deduplicateMentions(rawMentions);
      const removedCount = rawMentions.length - dedupedMentions.length;
      console.log(
        `${tag} [2/6 PREPROCESS] Done in ${elapsed(stage2Start)} -- ` +
          `${rawMentions.length} raw -> ${dedupedMentions.length} unique (${removedCount} duplicates removed)`
      );

      // ----------------------------------------------------------------
      // STAGE 3: CLASSIFY -- Per-mention sentiment + aspect labels
      // ----------------------------------------------------------------
      const stage3Start = Date.now();
      console.log(
        `${tag} [3/6 CLASSIFY] Classifying ${dedupedMentions.length} mentions...`
      );

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
      const sentimentCounts = {
        positive: classifiedMentions.filter(
          (m) => m.classification.sentiment === "positive"
        ).length,
        neutral: classifiedMentions.filter(
          (m) => m.classification.sentiment === "neutral"
        ).length,
        negative: classifiedMentions.filter(
          (m) => m.classification.sentiment === "negative"
        ).length,
      };
      console.log(
        `${tag} [3/6 CLASSIFY] Done in ${elapsed(stage3Start)} -- ` +
          `${classifiedMentions.length} classified, ${relevantMentions.length} relevant ` +
          `(+${sentimentCounts.positive} ~${sentimentCounts.neutral} -${sentimentCounts.negative})`
      );

      // ----------------------------------------------------------------
      // STAGE 4: AGGREGATE -- Deterministic score computation
      // ----------------------------------------------------------------
      const stage4Start = Date.now();
      console.log(`${tag} [4/6 AGGREGATE] Computing scores...`);

      await ctx.runMutation(internal.pipeline.updateReportStatus, {
        reportId,
        status: "analyzing",
      });

      const scores = computeAllScores(classifiedMentions);
      const aspectSummary = scores.aspects
        .map((a) => `${a.name}=${a.score}`)
        .join(", ");
      console.log(
        `${tag} [4/6 AGGREGATE] Done in ${elapsed(stage4Start)} -- ` +
          `overall=${scores.overallScore}, aspects: [${aspectSummary}], ` +
          `confidence=${(scores.confidence.overall * 100).toFixed(0)}%`
      );

      // ----------------------------------------------------------------
      // STAGE 5: SYNTHESIZE -- LLM generates narrative insights
      // ----------------------------------------------------------------
      const stage5Start = Date.now();
      console.log(`${tag} [5/6 SYNTHESIZE] Generating report narrative...`);

      const report = await synthesizeReport(
        ctx,
        productName,
        relevantMentions,
        scores
      );
      console.log(
        `${tag} [5/6 SYNTHESIZE] Done in ${elapsed(stage5Start)} -- ` +
          `${report.strengths.length} strengths, ${report.issues.length} issues`
      );

      // ----------------------------------------------------------------
      // STAGE 6: ASSEMBLE -- Save to database
      // ----------------------------------------------------------------
      const stage6Start = Date.now();
      console.log(`${tag} [6/6 ASSEMBLE] Saving report to database...`);

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

      console.log(
        `${tag} [6/6 ASSEMBLE] Done in ${elapsed(stage6Start)}`
      );
      console.log(
        `${tag} Pipeline complete in ${elapsed(pipelineStart)} -- ` +
          `score=${scores.overallScore}, mentions=${relevantMentions.length}, ` +
          `strengths=${report.strengths.length}, issues=${report.issues.length}`
      );
    } catch (error) {
      console.error(
        `${tag} Pipeline failed after ${elapsed(pipelineStart)}:`,
        error
      );
      await ctx.runMutation(internal.pipeline.updateReportStatus, {
        reportId,
        status: "error",
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
});
