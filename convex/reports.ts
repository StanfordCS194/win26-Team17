import { query, mutation, action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import { Id } from "./_generated/dataModel";

// ============================================================================
// Validation
// ============================================================================

const MIN_PRODUCT_NAME_LENGTH = 2;
const MAX_PRODUCT_NAME_LENGTH = 100;
const REPORT_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

function validateProductName(name: string): { valid: boolean; error?: string; normalized?: string } {
  const trimmed = name.trim();

  if (trimmed.length < MIN_PRODUCT_NAME_LENGTH) {
    return { valid: false, error: `Product name must be at least ${MIN_PRODUCT_NAME_LENGTH} characters` };
  }

  if (trimmed.length > MAX_PRODUCT_NAME_LENGTH) {
    return { valid: false, error: `Product name must be less than ${MAX_PRODUCT_NAME_LENGTH} characters` };
  }

  // Remove potentially dangerous characters but allow common product name chars
  const sanitized = trimmed.replace(/[<>{}[\]\\]/g, "").trim();

  if (sanitized.length === 0) {
    return { valid: false, error: "Product name contains invalid characters" };
  }

  return { valid: true, normalized: sanitized };
}

function isReportExpired(generatedAt: string): boolean {
  const generatedTime = new Date(generatedAt).getTime();
  return Date.now() - generatedTime > REPORT_EXPIRY_MS;
}

// ============================================================================
// Queries
// ============================================================================

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

export const listRecentReports = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 10;
    const reports = await ctx.db
      .query("productReports")
      .order("desc")
      .collect();

    return reports
      .filter((r) => r.status === "complete")
      .slice(0, limit)
      .map((r) => ({
        productName: r.productName,
        overallScore: r.overallScore ?? 50,
        totalMentions: r.totalMentions ?? 0,
        generatedAt: r.generatedAt,
        isExpired: r.generatedAt ? isReportExpired(r.generatedAt) : false,
      }));
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

// ============================================================================
// Actions
// ============================================================================

// Action that creates report and triggers pipeline
export const analyzeProduct = action({
  args: {
    productName: v.string(),
    forceRefresh: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<{ reportId: Id<"productReports">; error?: string }> => {
    // Validate input
    const validation = validateProductName(args.productName);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const normalizedName = validation.normalized!;

    // Check for existing report
    const result = await ctx.runMutation(
      api.reports.createPendingReport,
      { productName: normalizedName }
    );

    const reportId = result.reportId as Id<"productReports">;

    // If forcing refresh and report exists, delete and recreate
    if (args.forceRefresh && result.existing) {
      await ctx.runMutation(api.reports.deleteReport, { reportId });
      const newResult = await ctx.runMutation(
        api.reports.createPendingReport,
        { productName: normalizedName }
      );
      const newReportId = newResult.reportId as Id<"productReports">;

      await ctx.scheduler.runAfter(0, api.pipeline.generateReport, {
        reportId: newReportId,
        productName: normalizedName,
      });

      return { reportId: newReportId };
    }

    // If it's a new report, trigger the pipeline
    if (!result.existing) {
      await ctx.scheduler.runAfter(0, api.pipeline.generateReport, {
        reportId,
        productName: normalizedName,
      });
    }

    return { reportId };
  },
});

// Delete a report (for refresh functionality)
export const deleteReport = mutation({
  args: { reportId: v.id("productReports") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.reportId);
  },
});

// Get report with expiration info
export const getReportWithMeta = query({
  args: { productName: v.string() },
  handler: async (ctx, args) => {
    const validation = validateProductName(args.productName);
    if (!validation.valid) {
      return null;
    }

    const normalizedName = validation.normalized!.toLowerCase();
    const reports = await ctx.db
      .query("productReports")
      .withIndex("by_productName")
      .collect();

    const report = reports.find(
      (r) => r.productName.toLowerCase().trim() === normalizedName
    );

    if (!report) return null;

    return {
      ...report,
      isExpired: report.generatedAt ? isReportExpired(report.generatedAt) : false,
    };
  },
});
