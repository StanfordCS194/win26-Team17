import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const getByProductName = query({
  args: { productName: v.string() },
  handler: async (ctx, args) => {
    const normalizedName = args.productName.toLowerCase();
    const reports = await ctx.db
      .query("productReports")
      .withIndex("by_productName")
      .collect();
    return (
      reports.find(
        (r) => r.productName.toLowerCase() === normalizedName
      ) ?? null
    );
  },
});

export const listProductNames = query({
  args: {},
  handler: async (ctx) => {
    const reports = await ctx.db.query("productReports").collect();
    return reports.map((r) => r.productName);
  },
});

export const createReport = mutation({
  args: {
    productName: v.string(),
    overallScore: v.number(),
    totalMentions: v.number(),
    sourcesAnalyzed: v.number(),
    generatedAt: v.string(),
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
        trend: v.union(
          v.literal("up"),
          v.literal("down"),
          v.literal("stable")
        ),
      })
    ),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("productReports", args);
  },
});
