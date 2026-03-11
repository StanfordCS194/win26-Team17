import { describe, expect, it } from "vitest";
import { synthesizeReportDeterministically } from "../../convex/services/reportSynthesis";
import type { ClassifiedMention } from "../../convex/services/scoring";

function mention(
  sentiment: "positive" | "neutral" | "negative",
  sentimentScore: number,
  aspects: ClassifiedMention["classification"]["aspects"],
  text: string,
  index: number,
  relevant = true
): ClassifiedMention {
  return {
    text,
    author: `author-${index}`,
    date: `2024-01-${String(index + 1).padStart(2, "0")}T10:00:00Z`,
    url: `https://example.com/${index}`,
    source: index % 2 === 0 ? "reddit" : "stackoverflow",
    classification: {
      sentiment,
      sentimentScore,
      aspects,
      relevant,
    },
  };
}

describe("synthesizeReportDeterministically", () => {
  it("builds strengths and issues from classified mentions", () => {
    const mentions: ClassifiedMention[] = [
      mention(
        "positive",
        88,
        ["Usability"],
        "The workflow is simple, intuitive, and easy to use every day.",
        0
      ),
      mention(
        "positive",
        82,
        ["Usability"],
        "Navigation is clean and new teammates pick it up quickly.",
        1
      ),
      mention(
        "negative",
        12,
        ["Usability"],
        "The UI is confusing and I waste time finding common actions.",
        2
      ),
      mention(
        "negative",
        18,
        ["Quality"],
        "It is buggy and crashes often enough that I do not trust it.",
        3
      ),
    ];

    const report = synthesizeReportDeterministically("Slack", mentions, {
      overallScore: 35,
      aspects: [
        { name: "Price", score: 50, mentions: 0, trend: "stable" },
        { name: "Quality", score: 0, mentions: 1, trend: "stable" },
        { name: "Durability", score: 50, mentions: 0, trend: "stable" },
        { name: "Usability", score: 33, mentions: 3, trend: "stable" },
      ],
    });

    expect(report.mode).toBe("deterministic");
    expect(report.summary).toContain("Slack");
    expect(report.summary).toContain("35/100");
    expect(report.strengths[0]?.title).toBe("Easy Daily Workflow");
    expect(report.issues[0]?.title).toBe("Workflow & UX Friction");
    expect(report.issues[1]?.title).toBe("Reliability & Quality Problems");
  });

  it("returns an empty report when nothing is relevant", () => {
    const report = synthesizeReportDeterministically(
      "Slack",
      [
        mention(
          "neutral",
          50,
          [],
          "I saw the word slack in another unrelated context.",
          0,
          false
        ),
      ],
      {
        overallScore: 50,
        aspects: [
          { name: "Price", score: 50, mentions: 0, trend: "stable" },
          { name: "Quality", score: 50, mentions: 0, trend: "stable" },
          { name: "Durability", score: 50, mentions: 0, trend: "stable" },
          { name: "Usability", score: 50, mentions: 0, trend: "stable" },
        ],
      }
    );

    expect(report.summary).toBe('No user feedback found for "Slack".');
    expect(report.strengths).toEqual([]);
    expect(report.issues).toEqual([]);
  });
});
