import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

const classificationValidator = v.object({
  sentiment: v.union(
    v.literal("positive"),
    v.literal("neutral"),
    v.literal("negative")
  ),
  sentimentScore: v.number(),
  aspects: v.array(
    v.union(
      v.literal("Price"),
      v.literal("Quality"),
      v.literal("Durability"),
      v.literal("Usability")
    )
  ),
  relevant: v.boolean(),
});

export const getCachedClassification = internalQuery({
  args: {
    productName: v.string(),
    textHash: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("mentionClassificationCache")
      .withIndex("by_product_textHash", (q) =>
        q.eq("productName", args.productName).eq("textHash", args.textHash)
      )
      .unique();
  },
});

export const upsertCachedClassifications = internalMutation({
  args: {
    entries: v.array(
      v.object({
        productName: v.string(),
        textHash: v.string(),
        classification: classificationValidator,
      })
    ),
  },
  handler: async (ctx, args) => {
    const updatedAt = Date.now();

    for (const entry of args.entries) {
      const existing = await ctx.db
        .query("mentionClassificationCache")
        .withIndex("by_product_textHash", (q) =>
          q.eq("productName", entry.productName).eq("textHash", entry.textHash)
        )
        .unique();

      if (existing) {
        await ctx.db.patch(existing._id, {
          classification: entry.classification,
          updatedAt,
        });
        continue;
      }

      await ctx.db.insert("mentionClassificationCache", {
        productName: entry.productName,
        textHash: entry.textHash,
        classification: entry.classification,
        updatedAt,
      });
    }
  },
});
