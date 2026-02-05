/**
 * PulseCheck Backend - Prototype API
 *
 * Serves product reports for the MVP demo:
 * - Pre-cached reports for Notion, Figma, Linear (< 30s / instant)
 * - Generic placeholder reports for other products (future: Reddit/G2 pipeline)
 *
 * MVP scope: Reddit + G2 data retrieval stubbed; real ingestion post-demo.
 */

import express from "express";
import cors from "cors";
import { getReport, getCachedReport, getSuggestions } from "./data/demoReports.js";

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: true }));
app.use(express.json());

/** Health check for devops / frontend */
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "pulsecheck-api" });
});

/** Suggested product names for typeahead / quick try */
app.get("/api/suggestions", (_req, res) => {
  res.json(getSuggestions());
});

/**
 * Get report by product key (slug): notion, figma, linear.
 * Returns 404 if key is unknown and we only want to serve cached for demo.
 * For MVP we serve generic report for any key via getReport.
 */
app.get("/api/reports/:productKey", (req, res) => {
  const { productKey } = req.params;
  const report = getCachedReport(productKey);
  if (!report) {
    return res.status(404).json({
      error: "Report not found",
      message: `No cached report for "${productKey}". Try POST /api/reports with body { "productName": "Product Name" } for any product.`,
    });
  }
  res.json(report);
});

/**
 * Generate or retrieve report by product name.
 * Cached for Notion, Figma, Linear; generic placeholder otherwise.
 * Matches PRD: "User can enter product name and see results in <30 seconds"
 */
app.post("/api/reports", (req, res) => {
  const productName = req.body?.productName ?? req.body?.product ?? "";
  if (!String(productName).trim()) {
    return res.status(400).json({
      error: "Bad request",
      message: "Body must include productName (e.g. { \"productName\": \"Notion\" })",
    });
  }
  const report = getReport(productName);
  res.json(report);
});

app.listen(PORT, () => {
  console.log(`PulseCheck API running at http://localhost:${PORT}`);
  console.log(`  GET  /api/health`);
  console.log(`  GET  /api/suggestions`);
  console.log(`  GET  /api/reports/:productKey   (notion | figma | linear)`);
  console.log(`  POST /api/reports               body: { "productName": "..." }`);
});
