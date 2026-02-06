// Doc: Natural_Language_Code/pipeline/info_pipeline.md

import { action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import { fetchRedditDiscussions, filterAndPreprocess } from "./reddit";
import { analyzeWithClaude } from "./analyze";

export const analyzeProduct = action({
  args: {
    productName: v.string(),
    brandName: v.string(),
  }, 
  handler: async (ctx, args) => {
    const { productName, brandName } = args;

    // Check if report already exists (cache hit)
    const existing = await ctx.runQuery(api.reports.getByProductName, {
      productName,
    });
    if (existing) {
      return { status: "cached" as const, productName };
    }

    // Get API key from environment
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error(
        "ANTHROPIC_API_KEY not configured. Run: npx convex env set ANTHROPIC_API_KEY <key>"
      );
    }

    // Step 1: Fetch Reddit data
    let redditContent;
    try {
      redditContent = await fetchRedditDiscussions(productName, brandName);
    } catch (e) {
      const msg = (e as Error).message ?? "Unknown error";
      throw new Error(
        `Failed to fetch Reddit data for "${brandName} ${productName}": ${msg}`
      );
    }

    // Step 2: Filter and preprocess
    const filtered = filterAndPreprocess(redditContent);

    if (filtered.posts.length === 0 && filtered.comments.length === 0) {
      throw new Error(
        `No discussions found for "${brandName} ${productName}" on Reddit. Try a more well-known product.`
      );
    }

    // Step 3: Analyze with Claude
    let analysis;
    try {
      analysis = await analyzeWithClaude(filtered, productName, brandName, apiKey);
    } catch (e) {
      throw new Error(
        `Analysis failed for "${brandName} ${productName}": ${(e as Error).message}`
      );
    }

    // Step 4: Store the report
    await ctx.runMutation(api.reports.createReport, {
      productName: analysis.productName,
      overallScore: analysis.overallScore,
      totalMentions: analysis.totalMentions,
      sourcesAnalyzed: analysis.sourcesAnalyzed,
      generatedAt: analysis.generatedAt,
      summary: analysis.summary,
      strengths: analysis.strengths,
      issues: analysis.issues,
      aspects: analysis.aspects,
    });

    return { status: "created" as const, productName };
  },
});
