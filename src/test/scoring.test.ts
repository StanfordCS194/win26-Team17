import { describe, it, expect } from "vitest";
import {
  computeOverallScore,
  computeAspectScores,
  computeIssueRadar,
  computeConfidence,
  computeAllScores,
  ClassifiedMention,
  Aspect,
  ASPECTS,
} from "../../convex/services/scoring";

// ============================================================================
// Test Data Factory
// ============================================================================

function makeMention(
  overrides: {
    sentiment?: "positive" | "neutral" | "negative";
    aspects?: Aspect[];
    relevant?: boolean;
    author?: string;
  } = {}
): ClassifiedMention {
  return {
    text: "Test mention text for unit testing purposes.",
    author: overrides.author ?? "testuser",
    date: "2026-01-15",
    url: "https://reddit.com/r/test/comments/abc/test",
    source: "reddit",
    classification: {
      sentiment: overrides.sentiment ?? "positive",
      sentimentScore: overrides.sentiment === "negative" ? 20 : overrides.sentiment === "neutral" ? 50 : 80,
      aspects: overrides.aspects ?? [],
      relevant: overrides.relevant ?? true,
    },
  };
}

function makeMentions(
  count: number,
  overrides: Parameters<typeof makeMention>[0] = {}
): ClassifiedMention[] {
  return Array.from({ length: count }, (_, i) =>
    makeMention({ author: `user${i}`, ...overrides })
  );
}

// ============================================================================
// computeOverallScore
// ============================================================================

describe("computeOverallScore", () => {
  it("returns 50 for empty mentions", () => {
    expect(computeOverallScore([])).toBe(50);
  });

  it("returns 50 when all mentions are irrelevant", () => {
    const mentions = makeMentions(5, { relevant: false, sentiment: "positive" });
    expect(computeOverallScore(mentions)).toBe(50);
  });

  it("returns 100 when all mentions are positive", () => {
    const mentions = makeMentions(10, { sentiment: "positive" });
    expect(computeOverallScore(mentions)).toBe(100);
  });

  it("returns 0 when all mentions are negative", () => {
    const mentions = makeMentions(10, { sentiment: "negative" });
    expect(computeOverallScore(mentions)).toBe(0);
  });

  it("returns 50 when positive and negative are equal", () => {
    const mentions = [
      ...makeMentions(5, { sentiment: "positive" }),
      ...makeMentions(5, { sentiment: "negative" }),
    ];
    expect(computeOverallScore(mentions)).toBe(50);
  });

  it("returns 50 when all mentions are neutral", () => {
    const mentions = makeMentions(10, { sentiment: "neutral" });
    expect(computeOverallScore(mentions)).toBe(50);
  });

  it("computes correctly with mixed sentiments", () => {
    // 6 positive, 2 negative, 2 neutral = 10 total
    // score = 50 + ((6 - 2) / 10) * 50 = 50 + 20 = 70
    const mentions = [
      ...makeMentions(6, { sentiment: "positive" }),
      ...makeMentions(2, { sentiment: "negative" }),
      ...makeMentions(2, { sentiment: "neutral" }),
    ];
    expect(computeOverallScore(mentions)).toBe(70);
  });

  it("ignores irrelevant mentions in the calculation", () => {
    const mentions = [
      ...makeMentions(4, { sentiment: "positive" }),
      ...makeMentions(10, { sentiment: "negative", relevant: false }),
    ];
    // Only 4 relevant positive mentions
    expect(computeOverallScore(mentions)).toBe(100);
  });

  it("clamps to 0-100 range", () => {
    // All positive -> should be exactly 100, not above
    expect(computeOverallScore(makeMentions(1, { sentiment: "positive" }))).toBeLessThanOrEqual(100);
    // All negative -> should be exactly 0, not below
    expect(computeOverallScore(makeMentions(1, { sentiment: "negative" }))).toBeGreaterThanOrEqual(0);
  });
});

// ============================================================================
// computeAspectScores
// ============================================================================

describe("computeAspectScores", () => {
  it("returns all 4 PRD aspects", () => {
    const result = computeAspectScores([]);
    expect(result).toHaveLength(4);
    expect(result.map((a) => a.name)).toEqual(["Price", "Quality", "Durability", "Usability"]);
  });

  it("returns score 50 and 0 mentions for aspects with no data", () => {
    const result = computeAspectScores([]);
    for (const aspect of result) {
      expect(aspect.score).toBe(50);
      expect(aspect.mentions).toBe(0);
      expect(aspect.trend).toBe("stable");
    }
  });

  it("computes score correctly for a single aspect", () => {
    // 3 positive Price mentions, 1 negative Price mention = 4 total
    // score = 50 + ((3 - 1) / 4) * 50 = 50 + 25 = 75
    const mentions = [
      ...makeMentions(3, { sentiment: "positive", aspects: ["Price"] }),
      ...makeMentions(1, { sentiment: "negative", aspects: ["Price"] }),
    ];
    const result = computeAspectScores(mentions);
    const price = result.find((a) => a.name === "Price")!;
    expect(price.score).toBe(75);
    expect(price.mentions).toBe(4);
  });

  it("only counts mentions tagged with the specific aspect", () => {
    const mentions = [
      ...makeMentions(5, { sentiment: "positive", aspects: ["Quality"] }),
      ...makeMentions(5, { sentiment: "negative", aspects: ["Price"] }),
    ];
    const result = computeAspectScores(mentions);
    expect(result.find((a) => a.name === "Quality")!.score).toBe(100);
    expect(result.find((a) => a.name === "Price")!.score).toBe(0);
    expect(result.find((a) => a.name === "Durability")!.score).toBe(50);
  });

  it("handles mentions tagged with multiple aspects", () => {
    // A mention about both Price and Quality contributes to both
    const mentions = makeMentions(4, {
      sentiment: "positive",
      aspects: ["Price", "Quality"],
    });
    const result = computeAspectScores(mentions);
    expect(result.find((a) => a.name === "Price")!.score).toBe(100);
    expect(result.find((a) => a.name === "Price")!.mentions).toBe(4);
    expect(result.find((a) => a.name === "Quality")!.score).toBe(100);
    expect(result.find((a) => a.name === "Quality")!.mentions).toBe(4);
  });

  it("ignores irrelevant mentions", () => {
    const mentions = [
      ...makeMentions(3, { sentiment: "positive", aspects: ["Price"] }),
      ...makeMentions(5, { sentiment: "negative", aspects: ["Price"], relevant: false }),
    ];
    const result = computeAspectScores(mentions);
    expect(result.find((a) => a.name === "Price")!.score).toBe(100);
    expect(result.find((a) => a.name === "Price")!.mentions).toBe(3);
  });
});

// ============================================================================
// computeIssueRadar
// ============================================================================

describe("computeIssueRadar", () => {
  it("returns empty array for no mentions", () => {
    expect(computeIssueRadar([], [])).toEqual([]);
  });

  it("returns sorted results with highest issue score first", () => {
    // Price: 8 mentions, score 25 (very negative) -> radar = (8/10) * (100-25) = 60
    // Quality: 2 mentions, score 75 (positive) -> radar = (2/10) * (100-75) = 5
    const mentions = [
      ...makeMentions(8, { sentiment: "negative", aspects: ["Price"] }),
      ...makeMentions(2, { sentiment: "positive", aspects: ["Quality"] }),
    ];
    const aspectScores = computeAspectScores(mentions);
    const result = computeIssueRadar(mentions, aspectScores);

    expect(result[0].aspect).toBe("Price");
    expect(result[0].score).toBeGreaterThan(result[1].score);
  });

  it("high frequency + low sentiment = high radar score", () => {
    // All 10 mentions are negative Price mentions
    // Price score = 0, radar = (10/10) * (100 - 0) = 100
    const mentions = makeMentions(10, { sentiment: "negative", aspects: ["Price"] });
    const aspectScores = computeAspectScores(mentions);
    const result = computeIssueRadar(mentions, aspectScores);
    const priceRadar = result.find((r) => r.aspect === "Price")!;
    expect(priceRadar.score).toBe(100);
  });

  it("low frequency = low radar score regardless of sentiment", () => {
    // 1 negative Price mention out of 20 total
    // Price score = 0, but radar = (1/20) * (100 - 0) = 5
    const mentions = [
      ...makeMentions(1, { sentiment: "negative", aspects: ["Price"] }),
      ...makeMentions(19, { sentiment: "positive", aspects: ["Quality"] }),
    ];
    const aspectScores = computeAspectScores(mentions);
    const result = computeIssueRadar(mentions, aspectScores);
    const priceRadar = result.find((r) => r.aspect === "Price")!;
    expect(priceRadar.score).toBe(5);
  });

  it("positive aspects have low radar scores", () => {
    // All positive Quality mentions -> score = 100 -> radar = (10/10) * (100-100) = 0
    const mentions = makeMentions(10, { sentiment: "positive", aspects: ["Quality"] });
    const aspectScores = computeAspectScores(mentions);
    const result = computeIssueRadar(mentions, aspectScores);
    const qualityRadar = result.find((r) => r.aspect === "Quality")!;
    expect(qualityRadar.score).toBe(0);
  });
});

// ============================================================================
// computeConfidence
// ============================================================================

describe("computeConfidence", () => {
  it("returns all zeros for empty mentions", () => {
    const result = computeConfidence([]);
    expect(result).toEqual({ overall: 0, coverage: 0, agreement: 0, sourceDiversity: 0 });
  });

  it("coverage: 0 when no aspect has >5 mentions", () => {
    // 3 mentions per aspect (below threshold of >5)
    const mentions = ASPECTS.flatMap((aspect) =>
      makeMentions(3, { sentiment: "positive", aspects: [aspect] })
    );
    const result = computeConfidence(mentions);
    expect(result.coverage).toBe(0);
  });

  it("coverage: 0.5 when 2 of 4 aspects have >5 mentions", () => {
    const mentions = [
      ...makeMentions(6, { sentiment: "positive", aspects: ["Price"] }),
      ...makeMentions(6, { sentiment: "positive", aspects: ["Quality"] }),
      ...makeMentions(2, { sentiment: "positive", aspects: ["Durability"] }),
      ...makeMentions(2, { sentiment: "positive", aspects: ["Usability"] }),
    ];
    const result = computeConfidence(mentions);
    expect(result.coverage).toBe(0.5);
  });

  it("coverage: 1 when all 4 aspects have >5 mentions", () => {
    const mentions = ASPECTS.flatMap((aspect) =>
      makeMentions(6, { sentiment: "positive", aspects: [aspect] })
    );
    const result = computeConfidence(mentions);
    expect(result.coverage).toBe(1);
  });

  it("agreement: 1 when all mentions agree on sentiment per aspect", () => {
    // All Price mentions are positive, all Quality mentions are negative
    const mentions = [
      ...makeMentions(5, { sentiment: "positive", aspects: ["Price"] }),
      ...makeMentions(5, { sentiment: "negative", aspects: ["Quality"] }),
    ];
    const result = computeConfidence(mentions);
    expect(result.agreement).toBe(1);
  });

  it("agreement: lower when mentions are split on sentiment", () => {
    // 3 positive + 3 negative Price mentions -> agreement for Price = 3/6 = 0.5
    // Other aspects have no mentions -> default 1
    // Average = (0.5 + 1 + 1 + 1) / 4 = 0.875
    const mentions = [
      ...makeMentions(3, { sentiment: "positive", aspects: ["Price"] }),
      ...makeMentions(3, { sentiment: "negative", aspects: ["Price"] }),
    ];
    const result = computeConfidence(mentions);
    expect(result.agreement).toBeCloseTo(0.88, 1);
  });

  it("sourceDiversity: 1 when all authors are unique", () => {
    const mentions = makeMentions(5, { sentiment: "positive" });
    // makeMentions gives each a unique author (user0, user1, ...)
    const result = computeConfidence(mentions);
    expect(result.sourceDiversity).toBe(1);
  });

  it("sourceDiversity: low when same author repeats", () => {
    // All 10 mentions from the same author
    const mentions = makeMentions(10, { sentiment: "positive", author: "sameuser" });
    const result = computeConfidence(mentions);
    // 1 unique / 10 total = 0.1
    expect(result.sourceDiversity).toBe(0.1);
  });

  it("overall: 0 when any factor is 0", () => {
    // coverage = 0 (no aspect has >5 mentions), so overall must be 0
    const mentions = makeMentions(3, { sentiment: "positive", aspects: ["Price"] });
    const result = computeConfidence(mentions);
    expect(result.overall).toBe(0);
  });

  it("overall: product of all three factors", () => {
    // 6 mentions each for all 4 aspects, all positive, all unique authors = 24 total
    // coverage = 4/4 = 1, agreement = 1, sourceDiversity = 24/24 = 1
    // overall = 1 * 1 * 1 = 1
    const mentions = ASPECTS.flatMap((aspect, i) =>
      Array.from({ length: 6 }, (_, j) =>
        makeMention({ sentiment: "positive", aspects: [aspect], author: `user_${i}_${j}` })
      )
    );
    const result = computeConfidence(mentions);
    expect(result.overall).toBe(1);
  });
});

// ============================================================================
// computeAllScores (integration)
// ============================================================================

describe("computeAllScores", () => {
  it("returns all four metric categories", () => {
    const result = computeAllScores([]);
    expect(result).toHaveProperty("overallScore");
    expect(result).toHaveProperty("aspects");
    expect(result).toHaveProperty("issueRadar");
    expect(result).toHaveProperty("confidence");
  });

  it("produces consistent results across sub-functions", () => {
    const mentions = [
      ...makeMentions(6, { sentiment: "positive", aspects: ["Quality"] }),
      ...makeMentions(4, { sentiment: "negative", aspects: ["Price"] }),
    ];
    const result = computeAllScores(mentions);

    // Overall: 6 pos, 4 neg, 10 total -> 50 + ((6-4)/10)*50 = 60
    expect(result.overallScore).toBe(60);
    expect(result.aspects).toHaveLength(4);
    expect(result.aspects.find((a) => a.name === "Quality")!.score).toBe(100);
    expect(result.aspects.find((a) => a.name === "Price")!.score).toBe(0);
    expect(result.issueRadar[0].aspect).toBe("Price");
    expect(result.issueRadar[0].score).toBeGreaterThan(0);
  });
});
