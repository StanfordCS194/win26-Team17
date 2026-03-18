import { jsPDF } from "jspdf";
import * as XLSX from "xlsx";
import type { ProductReport, AspectScore, Insight, IssueRadarItem } from "@/types/report";

const PDF_MARGIN = 20;
const PDF_LINE_HEIGHT = 7;
const PDF_BULLET_SPACING = 4;
const PDF_PAGE_HEIGHT = 280;
const PDF_HEADER_TOP = 10;

function addPulseCheckHeader(doc: jsPDF, pageWidth: number): void {
  const rightMargin = PDF_MARGIN;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  const label = "PulseCheck";
  const textWidth = doc.getTextWidth(label);
  const x = pageWidth - rightMargin - textWidth;
  doc.setTextColor(45, 212, 191);
  doc.text(label, x, PDF_HEADER_TOP + 0.5);
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "normal");
}

function addWrappedText(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  maxWidth: number
): number {
  const lines = doc.splitTextToSize(text, maxWidth);
  doc.text(lines, x, y);
  return y + lines.length * PDF_LINE_HEIGHT;
}

function pdfSectionHeader(doc: jsPDF, y: number, title: string): number {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(title, PDF_MARGIN, y);
  doc.setFont("helvetica", "normal");
  return y + PDF_LINE_HEIGHT;
}

// Score colors (matching dashboard: positive / neutral / negative)
function getScoreColors(score: number): { fill: [number, number, number]; text: [number, number, number] } {
  if (score >= 70) return { fill: [209, 250, 229], text: [6, 95, 70] };   // green light / green dark
  if (score >= 50) return { fill: [241, 245, 249], text: [71, 85, 105] }; // slate light / slate
  return { fill: [254, 226, 226], text: [185, 28, 28] };                   // red light / red dark
}

function drawHeaderCard(
  doc: jsPDF,
  report: ProductReport,
  pageWidth: number,
  contentWidth: number,
  startY: number
): number {
  const padding = 6;
  const leftX = PDF_MARGIN + padding;
  const cardRadius = 3;

  // Summary wrap to compute content height
  const summaryLines = doc.splitTextToSize(report.summary ?? "", contentWidth - padding * 2);
  const summaryHeight = summaryLines.length * PDF_LINE_HEIGHT;
  // Top section must extend below "Overall Sentiment" label (circle + radius + label)
  const circleCenterY = startY + padding + 12;
  const circleRadius = 10;
  const topSectionHeight = (circleCenterY + circleRadius + 5 + PDF_LINE_HEIGHT) - startY + 2;
  const dividerSpace = 6;
  const labelSpace = 5;
  const bottomPadding = 3;
  const cardHeight = topSectionHeight + dividerSpace + labelSpace + summaryHeight + bottomPadding;

  // Card background and border (rounded rect)
  doc.setDrawColor(226, 232, 240);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(PDF_MARGIN, startY, contentWidth, cardHeight, cardRadius, cardRadius, "FD");

  let y = startY + padding;

  // Left: product name
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(report.productName, leftX, y);
  y += PDF_LINE_HEIGHT * 1.2;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text("Product Intelligence Report", leftX, y);
  doc.setTextColor(0, 0, 0);
  y += PDF_LINE_HEIGHT * 1.2;

  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  const meta = `Generated ${new Date(report.generatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}  ·  ${report.sourcesAnalyzed} sources  ·  ${report.totalMentions.toLocaleString()} mentions analyzed`;
  doc.text(meta, leftX, y);
  doc.setTextColor(0, 0, 0);
  y += PDF_LINE_HEIGHT * 1.2;

  // Right: Overall Sentiment circle (like ScoreGauge)
  const circleCenterX = PDF_MARGIN + contentWidth - padding - 18;
  if (report.overallScore !== null) {
    const colors = getScoreColors(report.overallScore);
    doc.setFillColor(...colors.fill);
    doc.setDrawColor(200, 200, 200);
    doc.circle(circleCenterX, circleCenterY, circleRadius, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(...colors.text);
    doc.text(String(report.overallScore), circleCenterX, circleCenterY + 1.5, { align: "center" });
  } else {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text("Not enough data", circleCenterX, circleCenterY + 1.5, { align: "center" });
  }
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text("Overall Sentiment", circleCenterX, circleCenterY + circleRadius + 5, { align: "center" });
  doc.setTextColor(0, 0, 0);

  // Divider line
  const dividerY = startY + topSectionHeight;
  doc.setDrawColor(226, 232, 240);
  doc.line(PDF_MARGIN + padding, dividerY, PDF_MARGIN + contentWidth - padding, dividerY);

  // Executive Summary
  y = dividerY + dividerSpace;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text("EXECUTIVE SUMMARY", leftX, y);
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "normal");
  y += labelSpace;
  doc.setFontSize(10);
  doc.text(summaryLines, leftX, y);
  y += summaryHeight + bottomPadding;

  return startY + cardHeight;
}

function getAspectScoreColors(score: number): { bar: [number, number, number]; text: [number, number, number] } {
  if (score >= 70) return { bar: [34, 197, 94], text: [22, 163, 74] };
  if (score >= 50) return { bar: [100, 116, 139], text: [71, 85, 105] };
  return { bar: [239, 68, 68], text: [185, 28, 28] };
}

function getTrendLabel(trend: "up" | "down" | "stable"): string {
  switch (trend) {
    case "up": return "Improving";
    case "down": return "Declining";
    default: return "Stable";
  }
}

function drawAspectCard(
  doc: jsPDF,
  aspect: AspectScore & { score: number },
  x: number,
  y: number,
  w: number,
  padding: number
): number {
  const cardH = 32;
  doc.setDrawColor(226, 232, 240);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(x, y, w, cardH, 2, 2, "FD");

  let cy = y + padding;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(aspect.name, x + padding, cy);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(getTrendLabel(aspect.trend), x + w - padding, cy, { align: "right" });
  doc.setTextColor(0, 0, 0);
  cy += PDF_LINE_HEIGHT * 1.2;

  const colors = getAspectScoreColors(aspect.score);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(...colors.text);
  doc.text(String(aspect.score), x + padding, cy);
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text("/ 100", x + padding + doc.getTextWidth(String(aspect.score)) + 5, cy);
  doc.setTextColor(0, 0, 0);
  cy += PDF_LINE_HEIGHT;

  const barY = cy + 2;
  const barH = 3;
  doc.setFillColor(226, 232, 240);
  doc.roundedRect(x + padding, barY, w - padding * 2, barH, 0.5, 0.5, "F");
  doc.setFillColor(...colors.bar);
  doc.roundedRect(x + padding, barY, (w - padding * 2) * (aspect.score / 100), barH, 0.5, 0.5, "F");
  cy = barY + barH + 4;

  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(`Based on ${aspect.mentions} mentions`, x + padding, cy);
  doc.setTextColor(0, 0, 0);
  return y + cardH;
}

function drawStrengthCard(
  doc: jsPDF,
  insight: Insight,
  index: number,
  x: number,
  y: number,
  w: number,
  padding: number,
  contentWidth: number
): number {
  const descLines = doc.splitTextToSize(insight.description, w - padding * 2 - 10);
  const bottomPadding = 3;
  const cardH = padding + PDF_LINE_HEIGHT * 1.2 + (descLines.length * PDF_LINE_HEIGHT) + 2 + PDF_LINE_HEIGHT + bottomPadding;
  doc.setDrawColor(226, 232, 240);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(x, y, w, cardH, 2, 2, "FD");

  let cy = y + padding;
  doc.setFillColor(209, 250, 229);
  doc.setTextColor(22, 163, 74);
  doc.roundedRect(x + padding, cy - 4, 7, 7, 1, 1, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(String(index + 1), x + padding + 3.5, cy + 0.5, { align: "center" });
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "normal");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(insight.title, x + padding + 10, cy);
  doc.setFont("helvetica", "normal");
  cy += PDF_LINE_HEIGHT * 1.2;
  doc.setFontSize(9);
  doc.text(descLines, x + padding + 10, cy);
  cy += descLines.length * PDF_LINE_HEIGHT + 2;
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(`${insight.frequency} mentions`, x + padding + 10, cy);
  doc.setTextColor(0, 0, 0);
  return y + cardH;
}

function drawIssueCard(
  doc: jsPDF,
  insight: Insight,
  index: number,
  x: number,
  y: number,
  w: number,
  padding: number
): number {
  const descLines = doc.splitTextToSize(insight.description, w - padding * 2 - 10);
  const bottomPadding = 3;
  const cardH = padding + PDF_LINE_HEIGHT * 1.2 + (descLines.length * PDF_LINE_HEIGHT) + 2 + PDF_LINE_HEIGHT + bottomPadding;
  doc.setDrawColor(226, 232, 240);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(x, y, w, cardH, 2, 2, "FD");

  let cy = y + padding;
  doc.setFillColor(254, 226, 226);
  doc.setTextColor(185, 28, 28);
  doc.roundedRect(x + padding, cy - 4, 7, 7, 1, 1, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(String(index + 1), x + padding + 3.5, cy + 0.5, { align: "center" });
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "normal");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(insight.title, x + padding + 10, cy);
  doc.setFont("helvetica", "normal");
  cy += PDF_LINE_HEIGHT * 1.2;
  doc.setFontSize(9);
  doc.text(descLines, x + padding + 10, cy);
  cy += descLines.length * PDF_LINE_HEIGHT + 2;
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(`${insight.frequency} mentions`, x + padding + 10, cy);
  doc.setTextColor(0, 0, 0);
  return y + cardH;
}

function drawSourceCard(
  doc: jsPDF,
  label: string,
  mentions: number,
  x: number,
  y: number,
  w: number,
  padding: number
): number {
  const cardH = 22;
  doc.setDrawColor(226, 232, 240);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(x, y, w, cardH, 2, 2, "FD");
  const cx = x + w / 2;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(String(mentions), cx, y + padding + PDF_LINE_HEIGHT, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(label, cx, y + padding + PDF_LINE_HEIGHT + 6, { align: "center" });
  doc.setTextColor(0, 0, 0);
  return y + cardH;
}

function drawConfidenceCard(
  doc: jsPDF,
  confidence: ProductReport["confidence"],
  x: number,
  y: number,
  w: number,
  padding: number
): number {
  const cardH = confidence == null ? 28 : 52;
  doc.setDrawColor(226, 232, 240);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(x, y, w, cardH, 2, 2, "FD");
  let cy = y + padding;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Data Confidence", x + padding, cy);
  cy += PDF_LINE_HEIGHT;
  doc.setFont("helvetica", "normal");
  if (confidence == null) {
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text("Confidence is not available for this report. Run a new analysis to see coverage, agreement, and source diversity.", x + padding, cy, { maxWidth: w - padding * 2 });
    doc.setTextColor(0, 0, 0);
    return y + cardH;
  }
  const pct = Math.round(confidence.overall * 100);
  const colors = getScoreColors(confidence.overall);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...colors.text);
  doc.text(`${pct}%`, x + w - padding, y + padding, { align: "right" });
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "normal");
  cy += 4;
  const metrics: (keyof typeof confidence)[] = ["coverage", "agreement", "sourceDiversity"];
  const labels = ["Coverage", "Agreement", "Source Diversity"];
  for (let i = 0; i < metrics.length; i++) {
    const val = confidence[metrics[i]];
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(labels[i], x + padding, cy);
    doc.setTextColor(0, 0, 0);
    doc.text(`${Math.round(val * 100)}%`, x + w - padding, cy, { align: "right" });
    cy += 3;
    doc.setFillColor(226, 232, 240);
    doc.roundedRect(x + padding, cy, w - padding * 2, 2, 0.3, 0.3, "F");
    const barW = (w - padding * 2) * val;
    if (barW > 0) {
      const c = val >= 0.7 ? [34, 197, 94] : val >= 0.4 ? [100, 116, 139] : [239, 68, 68];
      doc.setFillColor(...c);
      doc.roundedRect(x + padding, cy, barW, 2, 0.3, 0.3, "F");
    }
    cy += 5;
  }
  return y + cardH;
}

function drawIssueRadarCard(
  doc: jsPDF,
  items: IssueRadarItem[],
  x: number,
  y: number,
  w: number,
  padding: number
): number {
  const hasIssues = items.some((i) => i.score > 0);
  const maxScore = Math.max(...items.map((i) => i.score), 1);
  const rowH = 10;
  const cardH = hasIssues ? 22 + items.length * rowH : 28;
  doc.setDrawColor(226, 232, 240);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(x, y, w, cardH, 2, 2, "FD");
  let cy = y + padding;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Issue Radar", x + padding, cy);
  doc.setFont("helvetica", "normal");
  cy += PDF_LINE_HEIGHT + 2;
  if (!hasIssues) {
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text("No significant issues detected.", x + padding, cy);
    doc.setTextColor(0, 0, 0);
    return y + cardH;
  }
  for (const item of items) {
    doc.setFontSize(9);
    doc.text(item.aspect, x + padding, cy);
    doc.setTextColor(100, 116, 139);
    doc.text(`${item.mentionCount} mentions`, x + w - padding - 28, cy);
    doc.setTextColor(0, 0, 0);
    const severity = item.score >= 40 ? [185, 28, 28] : item.score >= 15 ? [71, 85, 105] : [22, 163, 74];
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...severity);
    doc.text(String(item.score), x + w - padding, cy, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);
    cy += 3;
    doc.setFillColor(226, 232, 240);
    doc.roundedRect(x + padding, cy, w - padding * 2, 2, 0.3, 0.3, "F");
    const barW = (w - padding * 2) * (item.score / maxScore);
    if (barW > 0) {
      doc.setFillColor(...(item.score >= 40 ? [239, 68, 68] : item.score >= 15 ? [100, 116, 139] : [34, 197, 94]));
      doc.roundedRect(x + padding, cy, barW, 2, 0.3, 0.3, "F");
    }
    cy += 5;
  }
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text("Higher scores indicate more frequent and more negative feedback.", x + padding, cy);
  doc.setTextColor(0, 0, 0);
  return y + cardH;
}

export function exportReportToPdf(report: ProductReport): void {
  const doc = new jsPDF({ format: "a4", unit: "mm" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const contentWidth = pageWidth - PDF_MARGIN * 2;
  let y = PDF_MARGIN;

  addPulseCheckHeader(doc, pageWidth);

  const aspectPadding = 4;
  const gap = 5;

  // Header card: product info, overall score gauge, executive summary (like dashboard UI)
  y = drawHeaderCard(doc, report, pageWidth, contentWidth, y + 4);
  y += 6;

  if (y > PDF_PAGE_HEIGHT) {
    doc.addPage();
    addPulseCheckHeader(doc, pageWidth);
    y = PDF_MARGIN;
  }

  // 1. Sources Analyzed (dashboard order)
  if (report.sourceBreakdown?.length) {
    if (y > PDF_PAGE_HEIGHT - 35) {
      doc.addPage();
      addPulseCheckHeader(doc, pageWidth);
      y = PDF_MARGIN;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("Sources Analyzed", PDF_MARGIN, y);
    doc.setFont("helvetica", "normal");
    y += PDF_LINE_HEIGHT * 1.5;
    const sourceGap = 4;
    const numCols = 4;
    const sourceCardW = (contentWidth - sourceGap * (numCols - 1)) / numCols;
    const sources = report.sourceBreakdown;
    for (let i = 0; i < sources.length; i += numCols) {
      const rowY = y;
      for (let c = 0; c < numCols && i + c < sources.length; c++) {
        drawSourceCard(
          doc,
          sources[i + c].label,
          sources[i + c].mentions,
          PDF_MARGIN + c * (sourceCardW + sourceGap),
          rowY,
          sourceCardW,
          aspectPadding
        );
      }
      y = rowY + 22 + sourceGap;
    }
    y += 4;
  }

  if (y > PDF_PAGE_HEIGHT) {
    doc.addPage();
    addPulseCheckHeader(doc, pageWidth);
    y = PDF_MARGIN;
  }

  // 2. Aspect Analysis (cards like dashboard)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Aspect Analysis", PDF_MARGIN, y);
  doc.setFont("helvetica", "normal");
  y += PDF_LINE_HEIGHT * 1.5;
  const aspectCardW = (contentWidth - gap) / 2;
  const allAspects = report.aspects ?? [];
  const scoredAspects = allAspects.filter(
    (a): a is AspectScore & { score: number } => a.score !== null
  );
  const missingAspects = allAspects.filter((a) => a.score === null);
  for (let i = 0; i < scoredAspects.length; i += 2) {
    if (y > PDF_PAGE_HEIGHT - 40) {
      doc.addPage();
      addPulseCheckHeader(doc, pageWidth);
      y = PDF_MARGIN;
    }
    const leftY = drawAspectCard(doc, scoredAspects[i], PDF_MARGIN, y, aspectCardW, aspectPadding);
    if (i + 1 < scoredAspects.length) {
      drawAspectCard(doc, scoredAspects[i + 1], PDF_MARGIN + aspectCardW + gap, y, aspectCardW, aspectPadding);
    }
    y = Math.max(leftY, y + 32) + 4;
  }
  if (missingAspects.length > 0) {
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(`Not enough data for: ${missingAspects.map((a) => a.name).join(", ")}`, PDF_MARGIN, y);
    doc.setTextColor(0, 0, 0);
    y += PDF_LINE_HEIGHT;
  }
  y += 4;

  if (y > PDF_PAGE_HEIGHT) {
    doc.addPage();
    addPulseCheckHeader(doc, pageWidth);
    y = PDF_MARGIN;
  }

  // 3. Confidence & Issue Radar (two cards side by side, like dashboard)
  const twoColGap = 5;
  const halfW = (contentWidth - twoColGap) / 2;
  const confidenceBottom = drawConfidenceCard(doc, report.confidence, PDF_MARGIN, y, halfW, aspectPadding);
  const radarBottom = drawIssueRadarCard(doc, report.issueRadar ?? [], PDF_MARGIN + halfW + twoColGap, y, halfW, aspectPadding);
  y = Math.max(confidenceBottom, radarBottom) + 6;

  if (y > PDF_PAGE_HEIGHT) {
    doc.addPage();
    addPulseCheckHeader(doc, pageWidth);
    y = PDF_MARGIN;
  }

  // 4. Top Strengths (cards with number badge like dashboard)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Top Strengths", PDF_MARGIN, y);
  doc.setFont("helvetica", "normal");
  y += PDF_LINE_HEIGHT * 1.5;
  for (let i = 0; i < (report.strengths ?? []).length; i++) {
    if (y > PDF_PAGE_HEIGHT - 35) {
      doc.addPage();
      addPulseCheckHeader(doc, pageWidth);
      y = PDF_MARGIN;
    }
    y = drawStrengthCard(
      doc,
      report.strengths![i],
      i,
      PDF_MARGIN,
      y,
      contentWidth,
      aspectPadding,
      contentWidth
    ) + 4;
  }
  y += 4;

  if (y > PDF_PAGE_HEIGHT) {
    doc.addPage();
    addPulseCheckHeader(doc, pageWidth);
    y = PDF_MARGIN;
  }

  // 5. Top Issues to Fix (cards with red number badge like dashboard)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Top Issues to Fix", PDF_MARGIN, y);
  doc.setFont("helvetica", "normal");
  y += PDF_LINE_HEIGHT * 1.5;
  const issues = report.issues ?? [];
  for (let i = 0; i < issues.length; i++) {
    if (y > PDF_PAGE_HEIGHT - 35) {
      doc.addPage();
      addPulseCheckHeader(doc, pageWidth);
      y = PDF_MARGIN;
    }
    y = drawIssueCard(doc, issues[i], i, PDF_MARGIN, y, contentWidth, aspectPadding) + 4;
  }

  const safeName = report.productName.replace(/[^a-zA-Z0-9-_]/g, "_").slice(0, 50);
  doc.save(`PulseCheck-${safeName}.pdf`);
}

export function exportReportToExcel(report: ProductReport): void {
  const wb = XLSX.utils.book_new();

  const aspectSummary =
    (report.aspects ?? [])
      .map((a) => `${a.name}: ${a.score ?? "N/A"}`)
      .join("  |  ") || "—";
  const sourceSummary =
    (report.sourceBreakdown ?? [])
      .map((s) => `${s.label}: ${s.mentions}`)
      .join("  |  ") || "—";
  const confidenceLine = report.confidence
    ? `Overall: ${(report.confidence.overall * 100).toFixed(0)}%  |  Coverage: ${(report.confidence.coverage * 100).toFixed(0)}%  |  Agreement: ${(report.confidence.agreement * 100).toFixed(0)}%  |  Source diversity: ${(report.confidence.sourceDiversity * 100).toFixed(0)}%`
    : "—";

  const overview = [
    ["Product Intelligence Report", ""],
    ["Product", report.productName],
    ["Generated", new Date(report.generatedAt).toLocaleString()],
    ["Overall Score (0-100)", report.overallScore ?? "Not enough data"],
    ["Total Mentions Analyzed", report.totalMentions],
    ["Sources Analyzed", report.sourcesAnalyzed],
    ["Aspect Scores (by dimension)", aspectSummary],
    ["Source Breakdown", sourceSummary],
    ["Data Confidence", confidenceLine],
    [],
    ["Executive Summary", ""],
    [report.summary ?? ""],
    [],
    ["Issue Radar (aspects with notable negative sentiment)", ""],
    ...(report.issueRadar ?? []).map((r) => [
      r.aspect,
      `Score: ${r.score}, Mentions: ${r.mentionCount}, Sentiment: ${r.sentimentScore}`,
    ]),
  ];
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet(overview),
    "Overview"
  );

  const aspectData = [
    ["Aspect", "Score (0–100)", "Mentions", "Trend"],
    ...(report.aspects ?? []).map((a) => [a.name, a.score ?? "Not enough data", a.mentions, a.trend]),
  ];
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet(aspectData),
    "Aspect Scores"
  );

  const strengthRows: (string | number)[][] = [
    ["Title", "Description", "Frequency", "Quote Text", "Source", "Author", "Date", "URL"],
  ];
  for (const s of report.strengths ?? []) {
    const qs = s.quotes ?? [];
    if (qs.length === 0) {
      strengthRows.push([s.title, s.description, s.frequency, "", "", "", "", ""]);
    } else {
      qs.forEach((q, idx) => {
        strengthRows.push([
          idx === 0 ? s.title : "",
          idx === 0 ? s.description : "",
          idx === 0 ? s.frequency : "",
          q.text,
          q.source,
          q.author,
          q.date,
          q.url,
        ]);
      });
    }
  }
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet(strengthRows),
    "Strengths"
  );

  const issueRows: (string | number)[][] = [
    ["Title", "Description", "Frequency", "Quote Text", "Source", "Author", "Date", "URL"],
  ];
  for (const i of report.issues ?? []) {
    const qs = i.quotes ?? [];
    if (qs.length === 0) {
      issueRows.push([i.title, i.description, i.frequency, "", "", "", "", ""]);
    } else {
      qs.forEach((q, idx) => {
        issueRows.push([
          idx === 0 ? i.title : "",
          idx === 0 ? i.description : "",
          idx === 0 ? i.frequency : "",
          q.text,
          q.source,
          q.author,
          q.date,
          q.url,
        ]);
      });
    }
  }
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet(issueRows),
    "Issues"
  );

  const allQuotesData: (string | number)[][] = [
    ["Category", "Insight Title", "Quote Text", "Source", "Author", "Date", "URL"],
  ];
  for (const s of report.strengths ?? []) {
    for (const q of s.quotes ?? []) {
      allQuotesData.push(["Strength", s.title, q.text, q.source, q.author, q.date, q.url]);
    }
  }
  for (const i of report.issues ?? []) {
    for (const q of i.quotes ?? []) {
      allQuotesData.push(["Issue", i.title, q.text, q.source, q.author, q.date, q.url]);
    }
  }
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet(allQuotesData),
    "All Quotes"
  );

  if (report.sourceBreakdown?.length) {
    const sourceData = [
      ["Source", "Label", "Mentions"],
      ...report.sourceBreakdown.map((s) => [s.name, s.label, s.mentions]),
    ];
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet(sourceData),
      "Sources"
    );
  }

  const safeName = report.productName.replace(/[^a-zA-Z0-9-_]/g, "_").slice(0, 50);
  XLSX.writeFile(wb, `PulseCheck-${safeName}.xlsx`);
}
