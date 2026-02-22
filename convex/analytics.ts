import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const recordEvent = mutation({
  args: {
    eventType: v.union(
      v.literal("search_submitted"),
      v.literal("dashboard_viewed")
    ),
    sessionId: v.string(),
    productName: v.optional(v.string()),
    reportId: v.optional(v.id("productReports")),
    timestamp: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("analyticsEvents", {
      eventType: args.eventType,
      sessionId: args.sessionId,
      productName: args.productName,
      reportId: args.reportId,
      timestamp: args.timestamp,
    });
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

export const getKPIDashboard = query({
  args: {},
  handler: async (ctx) => {
    const events = await ctx.db.query("analyticsEvents").collect();
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

    return {
      completionRate,
      totalSearches,
      totalCompletions,
      averageTimeToInsightSeconds,
      averageTimeToInsightMinutes,
      totalSessionsMeasured,
      averageSourcesAnalyzed,
      reportsWithTwoOrMoreSources,
    };
  },
});
