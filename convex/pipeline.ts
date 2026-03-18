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
import type { RawMention, SourceName } from "./services/classifier";
import { selectMentionsForClassification } from "./services/mentionSelection";
import { computeAllScores, ASPECTS } from "./services/scoring";

const MAX_CLASSIFICATION_MENTIONS = 150;
const MIN_MENTIONS_FOR_RELIABLE_SCORE = 100;

interface FetchLimits {
  postLimit: number;
  commentsPerPost: number;
  storyLimit: number;
  commentsPerStory: number;
  questionLimit: number;
  answersPerQuestion: number;
  articleLimit: number;
}

const STANDARD_LIMITS: FetchLimits = {
  postLimit: 25,
  commentsPerPost: 20,
  storyLimit: 20,
  commentsPerStory: 25,
  questionLimit: 20,
  answersPerQuestion: 15,
  articleLimit: 20,
};

const EXPANDED_LIMITS: FetchLimits = {
  postLimit: 25,
  commentsPerPost: 25,
  storyLimit: 25,
  commentsPerStory: 30,
  questionLimit: 25,
  answersPerQuestion: 20,
  articleLimit: 25,
};

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
// Fetch All Sources
// ============================================================================

async function fetchAllSources(
  productName: string,
  limits: FetchLimits,
  tag: string,
  elapsed: (since: number) => string
): Promise<Array<{ name: SourceName; mentions: RawMention[] }>> {
  return Promise.all([
    (async () => {
      const sourceStart = Date.now();
      try {
        const reddit = new RedditClient({
          cacheTtlMs: 60000,
          requestDelayMs: 250,
          retryDelayMs: 750,
          maxRetries: 1,
        });
        const redditResults = await searchSoftwareProduct(reddit, productName, {
          postLimit: limits.postLimit,
          commentsPerPost: limits.commentsPerPost,
        });
        const mentions = extractRedditMentions(redditResults);
        console.log(
          `${tag} Reddit: ${redditResults.length} posts, ${mentions.length} mentions in ${elapsed(sourceStart)}`
        );
        return { name: "reddit" as const, mentions };
      } catch (error) {
        console.warn(`${tag} Reddit fetch failed after ${elapsed(sourceStart)}:`, error);
        return { name: "reddit" as const, mentions: [] };
      }
    })(),
    (async () => {
      const sourceStart = Date.now();
      try {
        const hn = new HackerNewsClient();
        const hnResults = await searchSoftwareProductHN(hn, productName, {
          storyLimit: limits.storyLimit,
          commentsPerStory: limits.commentsPerStory,
        });
        const mentions = extractHackerNewsMentions(hnResults);
        console.log(
          `${tag} HackerNews: ${hnResults.length} stories, ${mentions.length} mentions in ${elapsed(sourceStart)}`
        );
        return { name: "hackernews" as const, mentions };
      } catch (error) {
        console.warn(`${tag} HackerNews fetch failed after ${elapsed(sourceStart)}:`, error);
        return { name: "hackernews" as const, mentions: [] };
      }
    })(),
    (async () => {
      const sourceStart = Date.now();
      try {
        const so = new StackOverflowClient();
        const soResults = await searchSoftwareProductSO(so, productName, {
          questionLimit: limits.questionLimit,
          answersPerQuestion: limits.answersPerQuestion,
        });
        const mentions = extractStackOverflowMentions(soResults);
        console.log(
          `${tag} StackOverflow: ${soResults.length} questions, ${mentions.length} mentions in ${elapsed(sourceStart)}`
        );
        return { name: "stackoverflow" as const, mentions };
      } catch (error) {
        console.warn(`${tag} StackOverflow fetch failed after ${elapsed(sourceStart)}:`, error);
        return { name: "stackoverflow" as const, mentions: [] };
      }
    })(),
    (async () => {
      const sourceStart = Date.now();
      try {
        const devto = new DevToClient();
        const devtoResults = await searchSoftwareProductDevTo(devto, productName, {
          articleLimit: limits.articleLimit,
        });
        const mentions = extractDevToMentions(devtoResults);
        console.log(
          `${tag} Dev.to: ${devtoResults.length} articles, ${mentions.length} mentions in ${elapsed(sourceStart)}`
        );
        return { name: "devto" as const, mentions };
      } catch (error) {
        console.warn(`${tag} Dev.to fetch failed after ${elapsed(sourceStart)}:`, error);
        return { name: "devto" as const, mentions: [] };
      }
    })(),
  ]);
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
    overallScore: v.optional(v.number()),
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
        score: v.optional(v.number()),
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
      // STAGE 1: COLLECT -- Fetch data from all sources
      // ----------------------------------------------------------------
      const stage1Start = Date.now();
      console.log(`${tag} [1/6 COLLECT] Fetching data from all sources...`);

      await ctx.runMutation(internal.pipeline.updateReportStatus, {
        reportId,
        status: "fetching",
      });

      const rawMentions: RawMention[] = [];
      const activeSourceNames: SourceName[] = [];
      const sourceLabels: Record<SourceName, string> = {
        reddit: "Reddit",
        hackernews: "HackerNews",
        stackoverflow: "Stack Overflow",
        devto: "Dev.to",
      };

      // First pass with standard limits
      const sourceResults = await fetchAllSources(productName, STANDARD_LIMITS, tag, elapsed);

      for (const { name, mentions } of sourceResults) {
        rawMentions.push(...mentions);
        if (mentions.length > 0) {
          activeSourceNames.push(name);
        }
      }

      // Retry with expanded limits if we got too few mentions
      if (rawMentions.length > 0 && rawMentions.length < MIN_MENTIONS_FOR_RELIABLE_SCORE) {
        console.log(
          `${tag} [1/6 COLLECT] Only ${rawMentions.length} mentions (below ${MIN_MENTIONS_FOR_RELIABLE_SCORE}) -- retrying with expanded search...`
        );
        const expandedResults = await fetchAllSources(productName, EXPANDED_LIMITS, tag, elapsed);
        for (const { name, mentions } of expandedResults) {
          rawMentions.push(...mentions);
          if (mentions.length > 0 && !activeSourceNames.includes(name)) {
            activeSourceNames.push(name);
          }
        }
        console.log(
          `${tag} [1/6 COLLECT] After expanded search: ${rawMentions.length} total raw mentions`
        );
      }

      const sourcesAnalyzed = activeSourceNames.length;

      const failedSources = (["reddit", "hackernews", "stackoverflow", "devto"] as const)
        .filter((name) => !activeSourceNames.includes(name));
      console.log(
        `${tag} [1/6 COLLECT] Done in ${elapsed(stage1Start)} -- ` +
          `${rawMentions.length} raw mentions from ${sourcesAnalyzed}/4 sources` +
          (failedSources.length > 0 ? ` (no data: ${failedSources.join(", ")})` : "")
      );
      if (sourcesAnalyzed < 2 && rawMentions.length > 0) {
        console.warn(`${tag} Low source diversity: only ${sourcesAnalyzed} source(s) returned data`);
      }

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

      // Compute per-source mention counts for sourceBreakdown
      const sourceMentionCounts = new Map<SourceName, number>();
      for (const m of rawMentions) {
        sourceMentionCounts.set(m.source, (sourceMentionCounts.get(m.source) || 0) + 1);
      }

      // ----------------------------------------------------------------
      // STAGE 2: PREPROCESS -- Deduplicate content
      // ----------------------------------------------------------------
      const stage2Start = Date.now();
      console.log(`${tag} [2/6 PREPROCESS] Deduplicating mentions...`);

      const dedupedMentions = deduplicateMentions(rawMentions);
      const mentionsForClassification = selectMentionsForClassification(
        dedupedMentions,
        MAX_CLASSIFICATION_MENTIONS
      );
      const removedCount = rawMentions.length - dedupedMentions.length;
      const sampledCount = dedupedMentions.length - mentionsForClassification.length;
      console.log(
        `${tag} [2/6 PREPROCESS] Done in ${elapsed(stage2Start)} -- ` +
          `${rawMentions.length} raw -> ${dedupedMentions.length} unique (${removedCount} duplicates removed)` +
          (sampledCount > 0
            ? `, classifying ${mentionsForClassification.length} representative mentions`
            : "")
      );

      // ----------------------------------------------------------------
      // STAGE 3: CLASSIFY -- Per-mention sentiment + aspect labels
      // ----------------------------------------------------------------
      const stage3Start = Date.now();
      console.log(
        `${tag} [3/6 CLASSIFY] Classifying ${mentionsForClassification.length} mentions...`
      );

      const [, classifiedMentions] = await Promise.all([
        ctx.runMutation(internal.pipeline.updateReportStatus, {
          reportId,
          status: "classifying",
        }),
        classifyMentions(
          ctx,
          productName,
          mentionsForClassification
        ),
      ]);
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
      const classifyRate = mentionsForClassification.length > 0
        ? ((classifiedMentions.length / mentionsForClassification.length) * 100).toFixed(0)
        : "100";
      console.log(
        `${tag} [3/6 CLASSIFY] Done in ${elapsed(stage3Start)} -- ` +
          `${classifiedMentions.length}/${mentionsForClassification.length} classified (${classifyRate}%), ` +
          `${relevantMentions.length} relevant ` +
          `(+${sentimentCounts.positive} ~${sentimentCounts.neutral} -${sentimentCounts.negative})`
      );
      if (classifiedMentions.length < mentionsForClassification.length * 0.9) {
        console.warn(
          `${tag} Classification success rate below 90%: ` +
            `${classifiedMentions.length}/${mentionsForClassification.length} mentions classified`
        );
      }

      // ----------------------------------------------------------------
      // STAGE 4: AGGREGATE -- Deterministic score computation
      // ----------------------------------------------------------------
      const stage4Start = Date.now();
      console.log(`${tag} [4/6 AGGREGATE] Computing scores...`);

      void ctx.runMutation(internal.pipeline.updateReportStatus, {
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
          `${report.mode}, ${report.strengths.length} strengths, ${report.issues.length} issues`
      );

      // ----------------------------------------------------------------
      // STAGE 6: ASSEMBLE -- Save to database
      // ----------------------------------------------------------------
      const stage6Start = Date.now();
      console.log(`${tag} [6/6 ASSEMBLE] Saving report to database...`);

      // Build sourceBreakdown from the sampled mentions that were actually classified.
      const classifiedSourceCounts = new Map<SourceName, number>();
      for (const m of mentionsForClassification) {
        classifiedSourceCounts.set(m.source, (classifiedSourceCounts.get(m.source) || 0) + 1);
      }
      const sourceBreakdown = activeSourceNames.map((name) => ({
        name,
        label: sourceLabels[name] || name,
        mentions: classifiedSourceCounts.get(name) || 0,
      }));

      await ctx.runMutation(internal.pipeline.saveReportResults, {
        reportId,
        overallScore: scores.overallScore ?? undefined,
        totalMentions: classifiedMentions.length,
        sourcesAnalyzed: Math.max(sourcesAnalyzed, 1),
        summary: report.summary,
        strengths: report.strengths,
        issues: report.issues,
        aspects: scores.aspects.map((a) => ({
          ...a,
          score: a.score ?? undefined,
        })),
        sourceBreakdown,
        issueRadar: scores.issueRadar,
        confidence: scores.confidence,
      });

      console.log(
        `${tag} [6/6 ASSEMBLE] Done in ${elapsed(stage6Start)}`
      );
      console.log(
        `${tag} Pipeline complete in ${elapsed(pipelineStart)} -- ` +
          `score=${scores.overallScore}, mentions=${classifiedMentions.length}, ` +
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
