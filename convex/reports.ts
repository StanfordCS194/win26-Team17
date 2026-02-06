import { query, mutation, action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import { Id } from "./_generated/dataModel";

export const getByProductName = query({
  args: { productName: v.string() },
  handler: async (ctx, args) => {
    const normalizedName = args.productName.toLowerCase().trim();
    const reports = await ctx.db
      .query("productReports")
      .withIndex("by_productName")
      .collect();

    return (
      reports.find(
        (r) => r.productName.toLowerCase().trim() === normalizedName
      ) ?? null
    );
  },
});

export const listProductNames = query({
  args: {},
  handler: async (ctx) => {
    const reports = await ctx.db
      .query("productReports")
      .collect();

    // Only return completed reports
    return reports
      .filter((r) => r.status === "complete")
      .map((r) => r.productName);
  },
});

export const getReportStatus = query({
  args: { reportId: v.id("productReports") },
  handler: async (ctx, args) => {
    const report = await ctx.db.get(args.reportId);
    if (!report) return null;
    return {
      status: report.status,
      errorMessage: report.errorMessage,
    };
  },
});

export const createPendingReport = mutation({
  args: { productName: v.string() },
  handler: async (ctx, args) => {
    const normalizedName = args.productName.trim();

    // Check if report already exists
    const existing = await ctx.db
      .query("productReports")
      .withIndex("by_productName")
      .collect();

    const existingReport = existing.find(
      (r) => r.productName.toLowerCase() === normalizedName.toLowerCase()
    );

    if (existingReport) {
      // If complete, return it; if in progress, return the ID
      return { reportId: existingReport._id, existing: true };
    }

    // Create new pending report
    const reportId = await ctx.db.insert("productReports", {
      productName: normalizedName,
      status: "pending",
      generatedAt: new Date().toISOString(),
    });

    return { reportId, existing: false };
  },
});

// Action that creates report and triggers pipeline
export const analyzeProduct = action({
  args: { productName: v.string() },
  handler: async (ctx, args): Promise<{ reportId: Id<"productReports"> }> => {
    // Create pending report
    const result = await ctx.runMutation(
      api.reports.createPendingReport,
      { productName: args.productName }
    );

    const reportId = result.reportId as Id<"productReports">;

    // If it's a new report, trigger the pipeline
    if (!result.existing) {
      // Run pipeline in background (don't await)
      await ctx.scheduler.runAfter(0, api.pipeline.generateReport, {
        reportId,
        productName: args.productName,
      });
    }

    return { reportId };
  },
});
