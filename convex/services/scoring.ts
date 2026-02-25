/**
 * Scoring Module
 *
 * Deterministic score computation using PRD-defined formulas.
 * All functions are pure -- no LLM calls, no side effects.
 */

// ============================================================================
// Types
// ============================================================================

export const ASPECTS = ["Price", "Quality", "Durability", "Usability"] as const;
export type Aspect = (typeof ASPECTS)[number];

export interface MentionClassification {
  sentiment: "positive" | "neutral" | "negative";
  sentimentScore: number;
  aspects: Aspect[];
  relevant: boolean;
}

export interface ClassifiedMention {
  text: string;
  author: string;
  date: string;
  url: string;
  source: "reddit" | "hackernews" | "stackoverflow" | "devto";
  classification: MentionClassification;
}

export interface AspectScoreResult {
  name: string;
  score: number;
  mentions: number;
  trend: "up" | "down" | "stable";
}

export interface IssueRadarItem {
  aspect: string;
  score: number;
  mentionCount: number;
  sentimentScore: number;
}

export interface ConfidenceIndicator {
  overall: number;
  coverage: number;
  agreement: number;
  sourceDiversity: number;
}

export interface ScoringResult {
  overallScore: number;
  aspects: AspectScoreResult[];
  issueRadar: IssueRadarItem[];
  confidence: ConfidenceIndicator;
}

// ============================================================================
// Overall Sentiment Score
// ============================================================================

/**
 * PRD formula: score = 50 + ((positiveCount - negativeCount) / totalCount) * 50
 * Score of 50 = neutral, >50 = positive, <50 = negative.
 * Only counts mentions marked as relevant.
 */
export function computeOverallScore(mentions: ClassifiedMention[]): number {
  const relevant = mentions.filter((m) => m.classification.relevant);
  if (relevant.length === 0) return 50;

  const positiveCount = relevant.filter(
    (m) => m.classification.sentiment === "positive"
  ).length;
  const negativeCount = relevant.filter(
    (m) => m.classification.sentiment === "negative"
  ).length;
  const total = relevant.length;

  const score = 50 + ((positiveCount - negativeCount) / total) * 50;
  return Math.round(Math.max(0, Math.min(100, score)));
}

// ============================================================================
// Aspect Scores
// ============================================================================

/**
 * Same formula as overall score, but filtered to mentions that reference
 * each specific aspect. Aspects with no mentions default to 50.
 */
export function computeAspectScores(
  mentions: ClassifiedMention[]
): AspectScoreResult[] {
  const relevant = mentions.filter((m) => m.classification.relevant);

  return ASPECTS.map((aspect) => {
    const aspectMentions = relevant.filter((m) =>
      m.classification.aspects.includes(aspect)
    );

    if (aspectMentions.length === 0) {
      return { name: aspect, score: 50, mentions: 0, trend: "stable" as const };
    }

    const positiveCount = aspectMentions.filter(
      (m) => m.classification.sentiment === "positive"
    ).length;
    const negativeCount = aspectMentions.filter(
      (m) => m.classification.sentiment === "negative"
    ).length;
    const total = aspectMentions.length;

    const score = 50 + ((positiveCount - negativeCount) / total) * 50;

    return {
      name: aspect,
      score: Math.round(Math.max(0, Math.min(100, score))),
      mentions: total,
      trend: "stable" as const,
    };
  });
}

// ============================================================================
// Issue Radar
// ============================================================================

/**
 * PRD formula: Issue Radar Score = (mention_count / total_mentions) * (100 - sentiment_score)
 * Issues with high frequency AND high negativity rise to the top.
 * Sorted descending by score.
 */
export function computeIssueRadar(
  mentions: ClassifiedMention[],
  aspectScores: AspectScoreResult[]
): IssueRadarItem[] {
  const relevant = mentions.filter((m) => m.classification.relevant);
  const totalMentions = relevant.length;

  if (totalMentions === 0) return [];

  return ASPECTS.map((aspect) => {
    const aspectMentions = relevant.filter((m) =>
      m.classification.aspects.includes(aspect)
    );
    const aspectScore =
      aspectScores.find((a) => a.name === aspect)?.score ?? 50;

    const score =
      (aspectMentions.length / totalMentions) * (100 - aspectScore);

    return {
      aspect,
      score: Math.round(Math.max(0, score) * 100) / 100,
      mentionCount: aspectMentions.length,
      sentimentScore: aspectScore,
    };
  }).sort((a, b) => b.score - a.score);
}

// ============================================================================
// Confidence Indicator
// ============================================================================

/**
 * Composite = coverage * agreement * sourceDiversity
 *
 * Coverage: fraction of the 4 expected aspects that have >5 mentions.
 * Agreement: average across aspects of (majority sentiment count / aspect mention count).
 * Source diversity: unique authors / total mentions (capped at 1).
 */
export function computeConfidence(
  mentions: ClassifiedMention[]
): ConfidenceIndicator {
  const relevant = mentions.filter((m) => m.classification.relevant);
  const totalMentions = relevant.length;

  if (totalMentions === 0) {
    return { overall: 0, coverage: 0, agreement: 0, sourceDiversity: 0 };
  }

  // Coverage: % of aspects (4) that have >5 mentions
  const aspectCounts = ASPECTS.map(
    (aspect) =>
      relevant.filter((m) => m.classification.aspects.includes(aspect)).length
  );
  const coveredAspects = aspectCounts.filter((count) => count > 5).length;
  const coverage = coveredAspects / ASPECTS.length;

  // Agreement: avg % of mentions agreeing on sentiment direction per aspect
  const agreementPerAspect = ASPECTS.map((aspect) => {
    const aspectMentions = relevant.filter((m) =>
      m.classification.aspects.includes(aspect)
    );
    if (aspectMentions.length === 0) return 1;

    const sentimentCounts = {
      positive: aspectMentions.filter(
        (m) => m.classification.sentiment === "positive"
      ).length,
      neutral: aspectMentions.filter(
        (m) => m.classification.sentiment === "neutral"
      ).length,
      negative: aspectMentions.filter(
        (m) => m.classification.sentiment === "negative"
      ).length,
    };
    const maxCount = Math.max(
      sentimentCounts.positive,
      sentimentCounts.neutral,
      sentimentCounts.negative
    );
    return maxCount / aspectMentions.length;
  });
  const agreement =
    agreementPerAspect.reduce((sum, a) => sum + a, 0) /
    agreementPerAspect.length;

  // Source diversity: unique authors / total mentions (capped at 1)
  const uniqueAuthors = new Set(relevant.map((m) => m.author)).size;
  const sourceDiversity = Math.min(1, uniqueAuthors / totalMentions);

  const overall = coverage * agreement * sourceDiversity;

  return {
    overall: Math.round(overall * 100) / 100,
    coverage: Math.round(coverage * 100) / 100,
    agreement: Math.round(agreement * 100) / 100,
    sourceDiversity: Math.round(sourceDiversity * 100) / 100,
  };
}

// ============================================================================
// Main Entry Point
// ============================================================================

/**
 * Compute all scores from classified mentions.
 * Returns overall score, aspect scores, issue radar, and confidence indicator.
 */
export function computeAllScores(
  mentions: ClassifiedMention[]
): ScoringResult {
  const overallScore = computeOverallScore(mentions);
  const aspects = computeAspectScores(mentions);
  const issueRadar = computeIssueRadar(mentions, aspects);
  const confidence = computeConfidence(mentions);

  return { overallScore, aspects, issueRadar, confidence };
}
