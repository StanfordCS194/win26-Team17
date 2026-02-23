import { action, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import {
  RedditClient,
  RedditComment,
  RedditPost,
  searchSoftwareProduct,
} from "./services/reddit";
import {
  HackerNewsClient,
  searchSoftwareProductHN,
  type HNStoryWithComments,
} from "./services/hackernews";
import {
  StackOverflowClient,
  searchSoftwareProductSO,
  type SOQuestionWithAnswers,
} from "./services/stackoverflow";
import {
  DevToClient,
  searchSoftwareProductDevTo,
  type DevToArticleWithComments,
} from "./services/devto";
import { deduplicateMentions } from "./services/dedup";
import { classifyMentions, synthesizeReport } from "./services/classifier";
import type { RawMention } from "./services/classifier";
import { computeAllScores, ASPECTS } from "./services/scoring";

// ============================================================================
// Helpers: Extract Raw Mentions from Each Source
// ============================================================================

function extractRedditMentions(
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

function extractHackerNewsMentions(
  stories: HNStoryWithComments[]
): RawMention[] {
  const mentions: RawMention[] = [];

  for (const { story, comments } of stories) {
    const storyText = story.storyText || story.title;
    if (storyText && storyText.length > 30) {
      const hnUrl = `https://news.ycombinator.com/item?id=${story.id}`;
      mentions.push({
        text: storyText.slice(0, 500),
        author: story.author,
        date: story.createdAt,
        url: story.url || hnUrl,
        source: "hackernews",
      });
    }

    for (const comment of comments) {
      if (comment.text && comment.text.length > 30) {
        mentions.push({
          text: comment.text.slice(0, 500),
          author: comment.author,
          date: comment.createdAt,
          url: `https://news.ycombinator.com/item?id=${comment.id}`,
          source: "hackernews",
        });
      }
    }
  }

  return mentions;
}

function extractStackOverflowMentions(
  questions: SOQuestionWithAnswers[]
): RawMention[] {
  const mentions: RawMention[] = [];

  for (const { question, answers } of questions) {
    const questionText = question.body || question.title;
    if (questionText && questionText.length > 30) {
      mentions.push({
        text: questionText.slice(0, 500),
        author: question.author,
        date: question.createdAt,
        url: question.url,
        source: "stackoverflow",
      });
    }

    for (const answer of answers) {
      if (answer.body && answer.body.length > 30) {
        mentions.push({
          text: answer.body.slice(0, 500),
          author: answer.author,
          date: answer.createdAt,
          url: `https://stackoverflow.com/a/${answer.id}`,
          source: "stackoverflow",
        });
      }
    }
  }

  return mentions;
}

function extractDevToMentions(
  articles: DevToArticleWithComments[]
): RawMention[] {
  const mentions: RawMention[] = [];

  for (const { article, comments } of articles) {
    const articleText = article.body || `${article.title}. ${article.description}`;
    if (articleText && articleText.length > 30) {
      mentions.push({
        text: articleText.slice(0, 500),
        author: article.author,
        date: article.publishedAt,
        url: article.url,
        source: "devto",
      });
    }

    for (const comment of comments) {
      if (comment.body && comment.body.length > 30) {
        mentions.push({
          text: comment.body.slice(0, 500),
          author: comment.author,
          date: comment.createdAt,
          url: article.url,
          source: "devto",
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
            source: v.union(v.literal("reddit"), v.literal("hackernews"), v.literal("stackoverflow"), v.literal("devto"), v.literal("g2")),
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
            source: v.union(v.literal("reddit"), v.literal("hackernews"), v.literal("stackoverflow"), v.literal("devto"), v.literal("g2")),
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

    const pipelineStart = Date.now();
    const tag = `[pipeline:${productName}]`;

    const elapsed = (since: number) => `${((Date.now() - since) / 1000).toFixed(1)}s`;

    console.log(`${tag} Starting analysis pipeline`);

    try {
      // ----------------------------------------------------------------
      // STAGE 1: COLLECT -- Fetch data from all sources
      // ----------------------------------------------------------------
      const stage1Start = Date.now();
      console.log(`${tag} [1/6 COLLECT] Fetching data from all sources...`);

      await ctx.runMutation(internal.pipeline.updateReportStatus, {
        reportId,
        status: "fetching",
      });

      const rawMentions: RawMention[] = [];
      let sourcesAnalyzed = 0;

      // Reddit
      try {
        const reddit = new RedditClient({
          cacheTtlMs: 60000,
          requestDelayMs: 3000,
          retryDelayMs: 30000,
          maxRetries: 3,
        });
        const redditResults = await searchSoftwareProduct(reddit, productName, {
          postLimit: 25,
          commentsPerPost: 25,
        });
        const redditMentions = extractRedditMentions(redditResults);
        rawMentions.push(...redditMentions);
        sourcesAnalyzed++;
        console.log(`${tag} Reddit: ${redditResults.length} posts, ${redditMentions.length} mentions`);
      } catch (error) {
        console.warn(`${tag} Reddit fetch failed:`, error);
      }

      // HackerNews
      try {
        const hn = new HackerNewsClient();
        const hnResults = await searchSoftwareProductHN(hn, productName, {
          storyLimit: 10,
          commentsPerStory: 20,
        });
        const hnMentions = extractHackerNewsMentions(hnResults);
        rawMentions.push(...hnMentions);
        sourcesAnalyzed++;
        console.log(`${tag} HackerNews: ${hnResults.length} stories, ${hnMentions.length} mentions`);
      } catch (error) {
        console.warn(`${tag} HackerNews fetch failed:`, error);
      }

      // Stack Overflow
      try {
        const so = new StackOverflowClient();
        const soResults = await searchSoftwareProductSO(so, productName, {
          questionLimit: 10,
          answersPerQuestion: 10,
        });
        const soMentions = extractStackOverflowMentions(soResults);
        rawMentions.push(...soMentions);
        sourcesAnalyzed++;
        console.log(`${tag} StackOverflow: ${soResults.length} questions, ${soMentions.length} mentions`);
      } catch (error) {
        console.warn(`${tag} StackOverflow fetch failed:`, error);
      }

      // Dev.to
      try {
        const devto = new DevToClient();
        const devtoResults = await searchSoftwareProductDevTo(devto, productName, {
          articleLimit: 10,
        });
        const devtoMentions = extractDevToMentions(devtoResults);
        rawMentions.push(...devtoMentions);
        sourcesAnalyzed++;
        console.log(`${tag} Dev.to: ${devtoResults.length} articles, ${devtoMentions.length} mentions`);
      } catch (error) {
        console.warn(`${tag} Dev.to fetch failed:`, error);
      }

      console.log(
        `${tag} [1/6 COLLECT] Done in ${elapsed(stage1Start)} -- ` +
          `${rawMentions.length} raw mentions from ${sourcesAnalyzed} sources`
      );

      // Handle empty results early
      if (rawMentions.length === 0) {
        console.log(`${tag} No mentions found -- saving empty report`);
        await ctx.runMutation(internal.pipeline.saveReportResults, {
          reportId,
          overallScore: 50,
          totalMentions: 0,
          sourcesAnalyzed: Math.max(sourcesAnalyzed, 1),
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
        sourcesAnalyzed: Math.max(sourcesAnalyzed, 1),
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
