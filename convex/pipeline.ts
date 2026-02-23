import { action, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { RedditClient, RedditComment, RedditPost, searchSoftwareProduct, isMentionRelevant } from "./services/reddit";
import { createGeminiClient } from "./services/gemini";
import { HNStoryWithComments, searchSoftwareProductHN, HackerNewsClient } from "./services/hackernews";
import { SOQuestionWithAnswers, searchSoftwareProductSO, StackOverflowClient } from "./services/stackoverflow";
import { DevToArticleWithComments, searchSoftwareProductDevTo, DevToClient } from "./services/devto";

type SourceName = "reddit" | "hackernews" | "stackoverflow" | "devto";

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
  source: "reddit" | "hackernews" | "stackoverflow" | "devto";
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

function processHackerNewsData(
  stories: HNStoryWithComments[]
): MentionWithSentiment[] {
  const mentions: MentionWithSentiment[] = [];

  for (const { story, comments } of stories) {
    const storyText = story.storyText || story.title;
    if (storyText && storyText.length > 30) {
      const sentiment = analyzeSentiment(storyText);
      const hnUrl = `https://news.ycombinator.com/item?id=${story.id}`;
      mentions.push({
        text: storyText.slice(0, 500),
        author: story.author,
        date: story.createdAt,
        url: story.url || hnUrl,
        score: sentiment.score,
        isPositive: sentiment.isPositive,
        source: "hackernews",
      });
    }

    for (const comment of comments) {
      if (comment.text && comment.text.length > 30) {
        const sentiment = analyzeSentiment(comment.text);
        mentions.push({
          text: comment.text.slice(0, 500),
          author: comment.author,
          date: comment.createdAt,
          url: `https://news.ycombinator.com/item?id=${comment.id}`,
          score: sentiment.score,
          isPositive: sentiment.isPositive,
          source: "hackernews",
        });
      }
    }
  }

  return mentions;
}

function processStackOverflowData(
  questions: SOQuestionWithAnswers[]
): MentionWithSentiment[] {
  const mentions: MentionWithSentiment[] = [];

  for (const { question, answers } of questions) {
    const questionText = question.body || question.title;
    if (questionText && questionText.length > 30) {
      const sentiment = analyzeSentiment(questionText);
      mentions.push({
        text: questionText.slice(0, 500),
        author: question.author,
        date: question.createdAt,
        url: question.url,
        score: sentiment.score,
        isPositive: sentiment.isPositive,
        source: "stackoverflow",
      });
    }

    for (const answer of answers) {
      if (answer.body && answer.body.length > 30) {
        const sentiment = analyzeSentiment(answer.body);
        mentions.push({
          text: answer.body.slice(0, 500),
          author: answer.author,
          date: answer.createdAt,
          url: `https://stackoverflow.com/a/${answer.id}`,
          score: sentiment.score,
          isPositive: sentiment.isPositive,
          source: "stackoverflow",
        });
      }
    }
  }

  return mentions;
}

function processDevToData(
  articles: DevToArticleWithComments[]
): MentionWithSentiment[] {
  const mentions: MentionWithSentiment[] = [];

  for (const { article, comments } of articles) {
    const articleText = article.body || `${article.title}. ${article.description}`;
    if (articleText && articleText.length > 30) {
      const sentiment = analyzeSentiment(articleText);
      mentions.push({
        text: articleText.slice(0, 500),
        author: article.author,
        date: article.publishedAt,
        url: article.url,
        score: sentiment.score,
        isPositive: sentiment.isPositive,
        source: "devto",
      });
    }

    for (const comment of comments) {
      if (comment.body && comment.body.length > 30) {
        const sentiment = analyzeSentiment(comment.body);
        mentions.push({
          text: comment.body.slice(0, 500),
          author: comment.author,
          date: comment.createdAt,
          url: article.url,
          score: sentiment.score,
          isPositive: sentiment.isPositive,
          source: "devto",
        });
      }
    }
  }

  return mentions;
}

// Deduplicate near-identical mentions (same text within first 100 chars)
function deduplicateMentions(mentions: MentionWithSentiment[]): MentionWithSentiment[] {
  const seen = new Set<string>();
  return mentions.filter((m) => {
    const key = m.text.slice(0, 100).toLowerCase().trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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
      source: m.source as "reddit" | "hackernews" | "stackoverflow" | "devto",
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

      // Fetch from all sources in parallel
      const allMentions: MentionWithSentiment[] = [];
      const activeSourceNames: SourceName[] = [];

      const [redditResults, hnResults, soResults, devtoResults] = await Promise.allSettled([
        (async () => {
          const reddit = new RedditClient({ cacheTtlMs: 60000, requestDelayMs: 150 });
          return searchSoftwareProduct(reddit, productName, {
            postLimit: 15,
            commentsPerPost: 10,
          });
        })(),
        (async () => {
          const hn = new HackerNewsClient({ requestDelayMs: 100 });
          return searchSoftwareProductHN(hn, productName, {
            storyLimit: 8,
            commentsPerStory: 10,
          });
        })(),
        (async () => {
          const so = new StackOverflowClient({ requestDelayMs: 100 });
          return searchSoftwareProductSO(so, productName, {
            questionLimit: 8,
            answersPerQuestion: 10,
          });
        })(),
        (async () => {
          const devto = new DevToClient({ requestDelayMs: 100 });
          return searchSoftwareProductDevTo(devto, productName, {
            articleLimit: 5,
          });
        })(),
      ]);

      if (redditResults.status === "fulfilled") {
        const mentions = processRedditData(redditResults.value, productName);
        allMentions.push(...mentions);
        if (mentions.length > 0) activeSourceNames.push("reddit");
        console.log(`Reddit: ${mentions.length} relevant mentions from ${redditResults.value.length} posts`);
      } else {
        console.warn("Reddit fetch failed:", redditResults.reason);
      }

      if (hnResults.status === "fulfilled") {
        const mentions = processHackerNewsData(hnResults.value);
        allMentions.push(...mentions);
        if (mentions.length > 0) activeSourceNames.push("hackernews");
        console.log(`HackerNews: ${mentions.length} mentions`);
      } else {
        console.warn("HackerNews fetch failed:", hnResults.reason);
      }

      if (soResults.status === "fulfilled") {
        const mentions = processStackOverflowData(soResults.value);
        allMentions.push(...mentions);
        if (mentions.length > 0) activeSourceNames.push("stackoverflow");
        console.log(`StackOverflow: ${mentions.length} mentions`);
      } else {
        console.warn("StackOverflow fetch failed:", soResults.reason);
      }

      if (devtoResults.status === "fulfilled") {
        const mentions = processDevToData(devtoResults.value);
        allMentions.push(...mentions);
        if (mentions.length > 0) activeSourceNames.push("devto");
        console.log(`Dev.to: ${mentions.length} mentions`);
      } else {
        console.warn("Dev.to fetch failed:", devtoResults.reason);
      }

      // Deduplicate
      const dedupedMentions = deduplicateMentions(allMentions);
      const sourcesAnalyzed = activeSourceNames.length;
      const sourceLabels: Record<SourceName, string> = {
        reddit: "Reddit",
        hackernews: "HackerNews",
        stackoverflow: "Stack Overflow",
        devto: "Dev.to",
      };
      const sourceNames = activeSourceNames.map((s) => sourceLabels[s] || s);

      // Compute per-source mention counts
      const sourceMentionCounts = new Map<SourceName, number>();
      for (const m of dedupedMentions) {
        sourceMentionCounts.set(m.source, (sourceMentionCounts.get(m.source) || 0) + 1);
      }
      const sourceBreakdown = activeSourceNames.map((name) => ({
        name,
        label: sourceLabels[name] || name,
        mentions: sourceMentionCounts.get(name) || 0,
      }));

      console.log(`Total: ${dedupedMentions.length} deduplicated mentions from ${sourcesAnalyzed} sources`);

      // Update status: analyzing
      await ctx.runMutation(internal.pipeline.updateReportStatus, {
        reportId,
        status: "analyzing",
      });

      // Try Gemini analysis, fall back to basic if unavailable
      let summary: string;
      let overallScore: number;
      let strengths: Array<{
        title: string;
        description: string;
        frequency: number;
        quotes: Array<{ text: string; source: SourceName; author: string; date: string; url: string }>;
      }>;
      let issues: typeof strengths;
      let aspects: Array<{ name: string; score: number; mentions: number; trend: "up" | "down" | "stable" }>;

      const geminiApiKey = process.env.GEMINI_API_KEY;

      if (geminiApiKey && dedupedMentions.length > 0) {
        try {
          console.log("Using Gemini for analysis...");
          const gemini = createGeminiClient(geminiApiKey);
          const analysis = await gemini.analyzeProductFeedback(productName, dedupedMentions);

          summary = analysis.summary;
          overallScore = analysis.overallScore;
          const mentionUrlToSource = new Map<string, SourceName>(
            dedupedMentions.map((m) => [m.url, m.source])
          );
          const lookupSource = (url: string): SourceName =>
            mentionUrlToSource.get(url) || "reddit";

          strengths = analysis.strengths.map((s) => ({
            ...s,
            quotes: s.quotes.map((q) => ({ ...q, source: lookupSource(q.url) })),
          }));
          issues = analysis.issues.map((i) => ({
            ...i,
            quotes: i.quotes.map((q) => ({ ...q, source: lookupSource(q.url) })),
          }));
          aspects = analysis.aspects.map((a) => ({ ...a, trend: "stable" as const }));

          console.log("Gemini analysis complete");
        } catch (error) {
          console.warn("Gemini analysis failed, using fallback:", error);
          summary = `Analysis of ${dedupedMentions.length} mentions from ${sourceNames.join(" and ") || "online sources"}.`;
          overallScore = calculateBasicScore(dedupedMentions);
          strengths = createBasicInsights(dedupedMentions, true);
          issues = createBasicInsights(dedupedMentions, false);
          aspects = createBasicAspects(dedupedMentions);
        }
      } else {
        console.log("Using basic analysis (no Gemini key or no mentions)");
        const positiveMentions = dedupedMentions.filter((m: MentionWithSentiment) => m.isPositive).length;
        const negativeMentions = dedupedMentions.length - positiveMentions;

        summary = dedupedMentions.length > 0
          ? `Analysis of ${dedupedMentions.length} mentions from ${sourceNames.join(" and ") || "online sources"}. Found ${positiveMentions} positive and ${negativeMentions} negative mentions.`
          : `Limited data found for "${productName}".`;
        overallScore = calculateBasicScore(dedupedMentions);
        strengths = createBasicInsights(dedupedMentions, true);
        issues = createBasicInsights(dedupedMentions, false);
        aspects = createBasicAspects(dedupedMentions);
      }

      // Save results
      await ctx.runMutation(internal.pipeline.saveReportResults, {
        reportId,
        overallScore,
        totalMentions: dedupedMentions.length,
        sourcesAnalyzed: Math.max(sourcesAnalyzed, 1),
        summary,
        strengths,
        issues,
        aspects,
        sourceBreakdown,
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
