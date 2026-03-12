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

const POSITIVE_WEIGHT = 1.5;

function weightedAverage(mentions: ClassifiedMention[]): number {
  let weightedSum = 0;
  let totalWeight = 0;
  for (const m of mentions) {
    const w = m.classification.sentimentScore > 50 ? POSITIVE_WEIGHT : 1;
    weightedSum += m.classification.sentimentScore * w;
    totalWeight += w;
  }
  return weightedSum / totalWeight;
}

/**
 * Intensity-weighted overall score: weighted average of sentimentScores for relevant mentions.
 * Positive mentions (score > 50) count 1.5x so the score tilts toward strengths.
 * Only counts mentions marked as relevant.
 */
export function computeOverallScore(mentions: ClassifiedMention[]): number {
  const relevant = mentions.filter((m) => m.classification.relevant);
  if (relevant.length === 0) return 50;

  const score = weightedAverage(relevant);
  return Math.round(Math.max(0, Math.min(100, score)));
}

// ============================================================================
// Aspect Scores
// ============================================================================

/**
 * Intensity-weighted aspect scores: average of sentimentScores for mentions
 * tagged with each aspect. Aspects with no mentions default to 50.
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

    const score = weightedAverage(aspectMentions);

    return {
      name: aspect,
      score: Math.round(Math.max(0, Math.min(100, score))),
      mentions: aspectMentions.length,
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

  // Single-pass: accumulate per-aspect sentiment counts and unique authors
  const aspectStats = Object.fromEntries(
    ASPECTS.map((a) => [a, { total: 0, positive: 0, neutral: 0, negative: 0 }])
  ) as Record<Aspect, { total: number; positive: number; neutral: number; negative: number }>;
  const authors = new Set<string>();

  for (const m of relevant) {
    authors.add(m.author);
    for (const aspect of m.classification.aspects) {
      if (aspect in aspectStats) {
        const s = aspectStats[aspect as Aspect];
        s.total++;
        s[m.classification.sentiment]++;
      }
    }
  }

  // Coverage: % of aspects (4) that have >5 mentions
  const coveredAspects = ASPECTS.filter((a) => aspectStats[a].total > 5).length;
  const coverage = coveredAspects / ASPECTS.length;

  // Agreement: avg % of mentions agreeing on sentiment direction per aspect
  const agreementPerAspect = ASPECTS.map((aspect) => {
    const s = aspectStats[aspect];
    if (s.total === 0) return 1;
    return Math.max(s.positive, s.neutral, s.negative) / s.total;
  });
  const agreement =
    agreementPerAspect.reduce((sum, a) => sum + a, 0) /
    agreementPerAspect.length;

  // Source diversity: unique authors / total mentions (capped at 1)
  const sourceDiversity = Math.min(1, authors.size / totalMentions);

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
