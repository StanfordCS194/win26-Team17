import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const quoteValidator = v.object({
  text: v.string(),
  source: v.union(v.literal("reddit"), v.literal("g2")),
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
    overallScore: v.number(),
    totalMentions: v.number(),
    sourcesAnalyzed: v.number(),
    generatedAt: v.string(),
    summary: v.string(),
    strengths: v.array(insightValidator),
    issues: v.array(insightValidator),
    aspects: v.array(aspectScoreValidator),
  }).index("by_productName", ["productName"]),
});
