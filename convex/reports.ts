import { query, mutation, action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { generateObject } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { z } from "zod";

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
        overallScore: r.overallScore ?? null,
        totalMentions: r.totalMentions ?? 0,
        generatedAt: r.generatedAt,
        isExpired: r.generatedAt ? isReportExpired(r.generatedAt) : false,
      }));
  },
});

/**
 * Average overall score across all completed reports.
 * Used as baseline under "Overall Sentiment" so users can compare to all products we've analyzed.
 */
export const getOverallScoreBaseline = query({
  args: {},
  handler: async (ctx) => {
    const reports = await ctx.db
      .query("productReports")
      .filter((q) => q.eq(q.field("status"), "complete"))
      .collect();

    const scored = reports.filter((r) => r.overallScore != null);
    if (scored.length === 0) return null;
    const sum = scored.reduce((acc, r) => acc + r.overallScore!, 0);
    return Math.round((sum / scored.length) * 10) / 10;
  },
});

/**
 * Average score per aspect across all completed reports.
 * Used as baseline so users can compare "this product vs average of all products we've analyzed".
 */
export const getAspectBaselines = query({
  args: {},
  handler: async (ctx) => {
    const reports = await ctx.db
      .query("productReports")
      .filter((q) => q.eq(q.field("status"), "complete"))
      .collect();

    const sumByAspect = new Map<string, number>();
    const countByAspect = new Map<string, number>();

    for (const report of reports) {
      const aspects = report.aspects ?? [];
      for (const a of aspects) {
        if (a.score == null) continue;
        const name = a.name;
        sumByAspect.set(name, (sumByAspect.get(name) ?? 0) + a.score);
        countByAspect.set(name, (countByAspect.get(name) ?? 0) + 1);
      }
    }

    const baselines: Record<string, number> = {};
    for (const [name, sum] of sumByAspect) {
      const count = countByAspect.get(name) ?? 0;
      if (count > 0) {
        baselines[name] = Math.round((sum / count) * 10) / 10;
      }
    }
    return baselines;
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
      // Errored reports are not cached — delete and re-run the pipeline
      if (existingReport.status === "error") {
        await ctx.db.delete(existingReport._id);
      } else {
        // Complete or in-progress — return cached
        return { reportId: existingReport._id, existing: true };
      }
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
export const validateSoftwareProduct = action({
  args: { productName: v.string() },
  handler: async (ctx, args): Promise<{ isSoftware: boolean; reason: string }> => {
    const apiKey = process.env.GEMINI_VALIDATION_KEY ?? process.env.GEMINI_API_KEY;
    if (!apiKey) {
      // If key is missing, fail open so the pipeline still runs
      return { isSoftware: true, reason: "Validation skipped: no API key" };
    }

    const google = createGoogleGenerativeAI({ apiKey });

    const { object } = await generateObject({
      model: google("gemini-2.5-flash"),
      schema: z.object({
        isSoftware: z.boolean(),
        reason: z.string().describe("One sentence explanation of the decision."),
      }),
      prompt: `A user typed "${args.productName}" into a software product analytics tool. Is this specifically a software product, app, developer tool, framework, library, or technology platform? Answer true if a knowledgeable person would recognize this as a software product. Answer false if it is primarily a common word, food, animal, place, or physical object. If you are not confident it is a software product, answer false.`,
    });

    return object;
  },
});

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
