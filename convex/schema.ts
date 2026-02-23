import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const quoteValidator = v.object({
  text: v.string(),
  source: v.union(v.literal("reddit"), v.literal("hackernews"), v.literal("stackoverflow"), v.literal("devto")),
  author: v.string(),
  date: v.string(),
  url: v.string(),
});

const insightValidator = v.object({
  title: v.string(),
  description: v.string(),
  frequency: v.number(),
  quotes: v.array(quoteValidator),
});

const aspectScoreValidator = v.object({
  name: v.string(),
  score: v.number(),
  mentions: v.number(),
  trend: v.union(v.literal("up"), v.literal("down"), v.literal("stable")),
});

export default defineSchema({
  productReports: defineTable({
    productName: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("fetching"),
      v.literal("analyzing"),
      v.literal("complete"),
      v.literal("error"),
    ),
    overallScore: v.optional(v.number()),
    totalMentions: v.optional(v.number()),
    sourcesAnalyzed: v.optional(v.number()),
    sourceBreakdown: v.optional(v.array(v.object({
      name: v.string(),
      label: v.string(),
      mentions: v.number(),
    }))),
    generatedAt: v.string(),
    summary: v.optional(v.string()),
    strengths: v.optional(v.array(insightValidator)),
    issues: v.optional(v.array(insightValidator)),
    aspects: v.optional(v.array(aspectScoreValidator)),
    errorMessage: v.optional(v.string()),
  }).index("by_productName", ["productName"]),
  analyticsEvents: defineTable({
    eventType: v.union(
      v.literal("search_submitted"),
      v.literal("dashboard_viewed"),
      v.literal("quote_engaged"),
    ),
    sessionId: v.string(),
    userId: v.optional(v.string()),
    productName: v.optional(v.string()),
    reportId: v.optional(v.id("productReports")),
    timestamp: v.number(),
  })
    .index("by_sessionId", ["sessionId"])
    .index("by_eventType", ["eventType"]),
  defensibilityRatings: defineTable({
    reportId: v.id("productReports"),
    sessionId: v.string(),
    score: v.number(),
    timestamp: v.number(),
  })
    .index("by_reportId", ["reportId"])
    .index("by_sessionId", ["sessionId"]),
});
