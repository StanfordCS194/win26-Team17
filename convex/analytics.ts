import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const eventTypeValidator = v.union(
  v.literal("search_submitted"),
  v.literal("dashboard_viewed"),
  v.literal("quote_engaged")
);

export const recordEvent = mutation({
  args: {
    eventType: eventTypeValidator,
    sessionId: v.string(),
    userId: v.optional(v.string()),
    productName: v.optional(v.string()),
    reportId: v.optional(v.id("productReports")),
    timestamp: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("analyticsEvents", {
      eventType: args.eventType,
      sessionId: args.sessionId,
      userId: args.userId,
      productName: args.productName,
      reportId: args.reportId,
      timestamp: args.timestamp,
    });
  },
});

export const recordDefensibilityRating = mutation({
  args: {
    reportId: v.id("productReports"),
    sessionId: v.string(),
    score: v.number(),
    timestamp: v.number(),
  },
  handler: async (ctx, args) => {
    if (args.score < 1 || args.score > 5) return;
    await ctx.db.insert("defensibilityRatings", {
      reportId: args.reportId,
      sessionId: args.sessionId,
      score: args.score,
      timestamp: args.timestamp,
    });
  },
});

export const recordFeedback = mutation({
  args: {
    reportId: v.id("productReports"),
    sessionId: v.string(),
    timestamp: v.number(),
    usefulness: v.optional(v.number()),
    defensibility: v.optional(v.number()),
    easeOfUse: v.optional(v.number()),
    relevance: v.optional(v.number()),
    nps: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const doc: Record<string, unknown> = {
      reportId: args.reportId,
      sessionId: args.sessionId,
      timestamp: args.timestamp,
    };
    if (args.usefulness != null && args.usefulness >= 1 && args.usefulness <= 5) {
      doc.usefulness = args.usefulness;
    }
    if (args.defensibility != null && args.defensibility >= 1 && args.defensibility <= 5) {
      doc.defensibility = args.defensibility;
    }
    if (args.easeOfUse != null && args.easeOfUse >= 1 && args.easeOfUse <= 5) {
      doc.easeOfUse = args.easeOfUse;
    }
    if (args.relevance != null && args.relevance >= 1 && args.relevance <= 5) {
      doc.relevance = args.relevance;
    }
    if (args.nps != null && args.nps >= 0 && args.nps <= 10) {
      doc.nps = args.nps;
    }
    const hasAny = "usefulness" in doc || "defensibility" in doc || "easeOfUse" in doc || "relevance" in doc || "nps" in doc;
    if (!hasAny) return;
    await ctx.db.insert("feedback", doc as {
      reportId: typeof args.reportId;
      sessionId: string;
      timestamp: number;
      usefulness?: number;
      defensibility?: number;
      easeOfUse?: number;
      relevance?: number;
      nps?: number;
    });
  },
});

export const getFeedbackStats = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("feedback").collect();
    const n = all.length;
    const withUsefulness = all.filter((r) => r.usefulness != null);
    const withDefensibility = all.filter((r) => r.defensibility != null);
    const withEaseOfUse = all.filter((r) => r.easeOfUse != null);
    const withRelevance = all.filter((r) => r.relevance != null);
    const withNps = all.filter((r) => r.nps != null);

    const usefulnessAverage = withUsefulness.length === 0 ? 0 : Math.round((withUsefulness.reduce((a, r) => a + (r.usefulness ?? 0), 0) / withUsefulness.length) * 10) / 10;
    const defensibilityAverage = withDefensibility.length === 0 ? 0 : Math.round((withDefensibility.reduce((a, r) => a + (r.defensibility ?? 0), 0) / withDefensibility.length) * 10) / 10;
    const easeOfUseAverage = withEaseOfUse.length === 0 ? 0 : Math.round((withEaseOfUse.reduce((a, r) => a + (r.easeOfUse ?? 0), 0) / withEaseOfUse.length) * 10) / 10;
    const relevanceAverage = withRelevance.length === 0 ? 0 : Math.round((withRelevance.reduce((a, r) => a + (r.relevance ?? 0), 0) / withRelevance.length) * 10) / 10;

    const npsN = withNps.length;
    const npsAverage = npsN === 0 ? 0 : Math.round((withNps.reduce((a, r) => a + (r.nps ?? 0), 0) / npsN) * 10) / 10;
    const promoters = withNps.filter((r) => (r.nps ?? 0) >= 9).length;
    const detractors = withNps.filter((r) => (r.nps ?? 0) <= 6).length;
    const promotersPct = npsN === 0 ? 0 : Math.round((promoters / npsN) * 1000) / 10;
    const detractorsPct = npsN === 0 ? 0 : Math.round((detractors / npsN) * 1000) / 10;
    const npsScore = npsN === 0 ? null : promotersPct - detractorsPct;

    return {
      usefulnessAverage,
      defensibilityAverage,
      easeOfUseAverage,
      relevanceAverage,
      feedbackCount: n,
      npsAverage,
      npsCount: npsN,
      npsScore,
      promotersPct,
      detractorsPct,
    };
  },
});

export const getSourceCoverageStats = query({
  args: {},
  handler: async (ctx) => {
    const reports = await ctx.db
      .query("productReports")
      .filter((q) => q.eq(q.field("status"), "complete"))
      .collect();

    const total = reports.length;
    if (total === 0) {
      return { averageSourcesAnalyzed: 0, reportsWithTwoOrMoreSources: 0 };
    }

    const sum = reports.reduce(
      (acc, r) => acc + (r.sourcesAnalyzed ?? 0),
      0
    );
    const reportsWithTwoOrMore = reports.filter(
      (r) => (r.sourcesAnalyzed ?? 0) >= 2
    ).length;

    return {
      averageSourcesAnalyzed: sum / total,
      reportsWithTwoOrMoreSources: reportsWithTwoOrMore,
    };
  },
});

export const getReportCompletionRate = query({
  args: {},
  handler: async (ctx) => {
    const events = await ctx.db.query("analyticsEvents").collect();
    const searchSessions = new Set(
      events
        .filter((e) => e.eventType === "search_submitted")
        .map((e) => e.sessionId)
    );
    const dashboardSessions = new Set(
      events
        .filter((e) => e.eventType === "dashboard_viewed")
        .map((e) => e.sessionId)
    );

    const totalSearches = searchSessions.size;
    const totalCompletions = [...searchSessions].filter((sid) =>
      dashboardSessions.has(sid)
    ).length;

    const completionRate =
      totalSearches === 0
        ? 0
        : Math.round((totalCompletions / totalSearches) * 1000) / 10;

    return {
      totalSearches,
      totalCompletions,
      completionRate,
    };
  },
});

export const getAverageTimeToInsight = query({
  args: {},
  handler: async (ctx) => {
    const events = await ctx.db.query("analyticsEvents").collect();

    const searchBySession = new Map<string, number>();
    const dashboardBySession = new Map<string, number>();

    for (const e of events) {
      if (e.eventType === "search_submitted") {
        const current = searchBySession.get(e.sessionId);
        if (current === undefined || e.timestamp < current) {
          searchBySession.set(e.sessionId, e.timestamp);
        }
      } else if (e.eventType === "dashboard_viewed") {
        const current = dashboardBySession.get(e.sessionId);
        if (current === undefined || e.timestamp < current) {
          dashboardBySession.set(e.sessionId, e.timestamp);
        }
      }
    }

    const diffsSeconds: number[] = [];
    for (const [sessionId, searchTs] of searchBySession) {
      const dashboardTs = dashboardBySession.get(sessionId);
      if (
        dashboardTs !== undefined &&
        dashboardTs > searchTs
      ) {
        diffsSeconds.push((dashboardTs - searchTs) / 1000);
      }
    }

    const totalSessionsMeasured = diffsSeconds.length;
    if (totalSessionsMeasured === 0) {
      return {
        totalSessionsMeasured: 0,
        averageTimeToInsightSeconds: 0,
        averageTimeToInsightMinutes: 0,
      };
    }

    const averageSeconds =
      diffsSeconds.reduce((a, b) => a + b, 0) / totalSessionsMeasured;
    const averageTimeToInsightSeconds =
      Math.round(averageSeconds * 10) / 10;
    const averageTimeToInsightMinutes =
      Math.round((averageSeconds / 60) * 100) / 100;

    return {
      totalSessionsMeasured,
      averageTimeToInsightSeconds,
      averageTimeToInsightMinutes,
    };
  },
});

export const getEvidenceEngagementRate = query({
  args: {},
  handler: async (ctx) => {
    const events = await ctx.db.query("analyticsEvents").collect();
    const dashboardSessions = new Set(
      events
        .filter((e) => e.eventType === "dashboard_viewed")
        .map((e) => e.sessionId)
    );
    const quoteEngagedSessions = new Set(
      events
        .filter((e) => e.eventType === "quote_engaged")
        .map((e) => e.sessionId)
    );

    const totalDashboardSessions = dashboardSessions.size;
    const sessionsWithQuoteEngaged = [...dashboardSessions].filter((sid) =>
      quoteEngagedSessions.has(sid)
    ).length;

    const evidenceEngagementRate =
      totalDashboardSessions === 0
        ? 0
        : Math.round((sessionsWithQuoteEngaged / totalDashboardSessions) * 1000) / 10;

    return {
      evidenceEngagementRate,
      totalDashboardSessions,
      sessionsWithQuoteEngaged,
    };
  },
});

export const getDefensibilityScore = query({
  args: {},
  handler: async (ctx) => {
    const ratings = await ctx.db.query("defensibilityRatings").collect();
    const total = ratings.length;
    if (total === 0) {
      return { defensibilityAverage: 0, defensibilityCount: 0 };
    }
    const sum = ratings.reduce((acc, r) => acc + r.score, 0);
    const defensibilityAverage = Math.round((sum / total) * 10) / 10;
    return { defensibilityAverage, defensibilityCount: total };
  },
});

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export const getReturnUsageRate = query({
  args: {},
  handler: async (ctx) => {
    const events = await ctx.db.query("analyticsEvents").collect();
    const searchEvents = events.filter(
      (e) => e.eventType === "search_submitted" && e.userId
    );

    const timestampsByUser = new Map<string, number[]>();
    for (const e of searchEvents) {
      const uid = e.userId!;
      const list = timestampsByUser.get(uid) ?? [];
      list.push(e.timestamp);
      timestampsByUser.set(uid, list);
    }

    let usersWithSecondWithin7Days = 0;
    for (const [, timestamps] of timestampsByUser) {
      const sorted = [...timestamps].sort((a, b) => a - b);
      if (sorted.length >= 2 && sorted[1] - sorted[0] <= SEVEN_DAYS_MS) {
        usersWithSecondWithin7Days += 1;
      }
    }

    const totalUsersWithOneSearch = timestampsByUser.size;
    const returnUsageRate =
      totalUsersWithOneSearch === 0
        ? 0
        : Math.round((usersWithSecondWithin7Days / totalUsersWithOneSearch) * 1000) / 10;

    return {
      returnUsageRate,
      totalUsersWithOneSearch,
      usersWithSecondWithin7Days,
    };
  },
});

export const getKPIDashboard = query({
  args: {},
  handler: async (ctx) => {
    const events = await ctx.db.query("analyticsEvents").collect();
    const ratings = await ctx.db.query("defensibilityRatings").collect();
    const feedbackList = await ctx.db.query("feedback").collect();
    const reports = await ctx.db
      .query("productReports")
      .filter((q) => q.eq(q.field("status"), "complete"))
      .collect();

    // Completion rate
    const searchSessions = new Set(
      events
        .filter((e) => e.eventType === "search_submitted")
        .map((e) => e.sessionId)
    );
    const dashboardSessions = new Set(
      events
        .filter((e) => e.eventType === "dashboard_viewed")
        .map((e) => e.sessionId)
    );
    const totalSearches = searchSessions.size;
    const totalCompletions = [...searchSessions].filter((sid) =>
      dashboardSessions.has(sid)
    ).length;
    const completionRate =
      totalSearches === 0
        ? 0
        : Math.round((totalCompletions / totalSearches) * 1000) / 10;

    // Time to insight
    const searchBySession = new Map<string, number>();
    const dashboardBySession = new Map<string, number>();
    for (const e of events) {
      if (e.eventType === "search_submitted") {
        const current = searchBySession.get(e.sessionId);
        if (current === undefined || e.timestamp < current) {
          searchBySession.set(e.sessionId, e.timestamp);
        }
      } else if (e.eventType === "dashboard_viewed") {
        const current = dashboardBySession.get(e.sessionId);
        if (current === undefined || e.timestamp < current) {
          dashboardBySession.set(e.sessionId, e.timestamp);
        }
      }
    }
    const diffsSeconds: number[] = [];
    for (const [sessionId, searchTs] of searchBySession) {
      const dashboardTs = dashboardBySession.get(sessionId);
      if (dashboardTs !== undefined && dashboardTs > searchTs) {
        diffsSeconds.push((dashboardTs - searchTs) / 1000);
      }
    }
    const totalSessionsMeasured = diffsSeconds.length;
    const averageTimeToInsightSeconds =
      totalSessionsMeasured === 0
        ? 0
        : Math.round((diffsSeconds.reduce((a, b) => a + b, 0) / totalSessionsMeasured) * 10) / 10;
    const averageTimeToInsightMinutes =
      Math.round((averageTimeToInsightSeconds / 60) * 100) / 100;

    // Source coverage
    const reportTotal = reports.length;
    const averageSourcesAnalyzed =
      reportTotal === 0
        ? 0
        : reports.reduce((acc, r) => acc + (r.sourcesAnalyzed ?? 0), 0) / reportTotal;
    const reportsWithTwoOrMoreSources = reports.filter(
      (r) => (r.sourcesAnalyzed ?? 0) >= 2
    ).length;

    // Evidence engagement
    const dashboardSessionsSet = new Set(
      events
        .filter((e) => e.eventType === "dashboard_viewed")
        .map((e) => e.sessionId)
    );
    const quoteEngagedSessionsSet = new Set(
      events
        .filter((e) => e.eventType === "quote_engaged")
        .map((e) => e.sessionId)
    );
    const totalDashboardSessions = dashboardSessionsSet.size;
    const sessionsWithQuoteEngaged = [...dashboardSessionsSet].filter((sid) =>
      quoteEngagedSessionsSet.has(sid)
    ).length;
    const evidenceEngagementRate =
      totalDashboardSessions === 0
        ? 0
        : Math.round((sessionsWithQuoteEngaged / totalDashboardSessions) * 1000) / 10;

    // Defensibility (legacy defensibilityRatings + feedback.defensibility where provided)
    const feedbackDefensibility = feedbackList.filter((r) => r.defensibility != null);
    const defensibilitySum = ratings.reduce((acc, r) => acc + r.score, 0) + feedbackDefensibility.reduce((acc, r) => acc + (r.defensibility ?? 0), 0);
    const defensibilityCount = ratings.length + feedbackDefensibility.length;
    const defensibilityAverage =
      defensibilityCount === 0
        ? 0
        : Math.round((defensibilitySum / defensibilityCount) * 10) / 10;

    // Feedback KPIs (from feedback table; only average over responses that have each field)
    const feedbackCount = feedbackList.length;
    const withUsefulness = feedbackList.filter((r) => r.usefulness != null);
    const withEaseOfUse = feedbackList.filter((r) => r.easeOfUse != null);
    const withRelevance = feedbackList.filter((r) => r.relevance != null);
    const withNps = feedbackList.filter((r) => r.nps != null);
    const usefulnessAverage = withUsefulness.length === 0 ? 0 : Math.round((withUsefulness.reduce((a, r) => a + (r.usefulness ?? 0), 0) / withUsefulness.length) * 10) / 10;
    const easeOfUseAverage = withEaseOfUse.length === 0 ? 0 : Math.round((withEaseOfUse.reduce((a, r) => a + (r.easeOfUse ?? 0), 0) / withEaseOfUse.length) * 10) / 10;
    const relevanceAverage = withRelevance.length === 0 ? 0 : Math.round((withRelevance.reduce((a, r) => a + (r.relevance ?? 0), 0) / withRelevance.length) * 10) / 10;
    const npsAverage = withNps.length === 0 ? 0 : Math.round((withNps.reduce((a, r) => a + (r.nps ?? 0), 0) / withNps.length) * 10) / 10;
    const promoters = withNps.filter((r) => (r.nps ?? 0) >= 9).length;
    const detractors = withNps.filter((r) => (r.nps ?? 0) <= 6).length;
    const npsScore = withNps.length === 0 ? null : Math.round((promoters / withNps.length) * 100 - (detractors / withNps.length) * 100);

    // Return usage (users who ran a second report within 7 days)
    const searchWithUserId = events.filter(
      (e) => e.eventType === "search_submitted" && e.userId
    );
    const timestampsByUser = new Map<string, number[]>();
    for (const e of searchWithUserId) {
      const uid = e.userId!;
      const list = timestampsByUser.get(uid) ?? [];
      list.push(e.timestamp);
      timestampsByUser.set(uid, list);
    }
    let usersWithSecondWithin7Days = 0;
    for (const [, timestamps] of timestampsByUser) {
      const sorted = [...timestamps].sort((a, b) => a - b);
      if (sorted.length >= 2 && sorted[1] - sorted[0] <= SEVEN_DAYS_MS) {
        usersWithSecondWithin7Days += 1;
      }
    }
    const totalUsersWithOneSearch = timestampsByUser.size;
    const returnUsageRate =
      totalUsersWithOneSearch === 0
        ? 0
        : Math.round((usersWithSecondWithin7Days / totalUsersWithOneSearch) * 1000) / 10;

    return {
      completionRate,
      totalSearches,
      totalCompletions,
      averageTimeToInsightSeconds,
      averageTimeToInsightMinutes,
      totalSessionsMeasured,
      averageSourcesAnalyzed,
      reportsWithTwoOrMoreSources,
      evidenceEngagementRate,
      totalDashboardSessions,
      sessionsWithQuoteEngaged,
      defensibilityAverage,
      defensibilityCount,
      returnUsageRate,
      totalUsersWithOneSearch,
      usersWithSecondWithin7Days,
      usefulnessAverage,
      easeOfUseAverage,
      relevanceAverage,
      feedbackCount,
      npsAverage,
      npsScore,
    };
  },
});
