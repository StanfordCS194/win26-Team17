export interface Quote {
  text: string;
  source: "reddit" | "hackernews" | "stackoverflow" | "devto";
  author: string;
  date: string;
  url: string;
}

export interface Insight {
  title: string;
  description: string;
  frequency: number;
  quotes: Quote[];
}

export interface AspectScore {
  name: string;
  score: number;
  mentions: number;
  trend: "up" | "down" | "stable";
}

export interface SourceInfo {
  name: string;
  label: string;
  mentions: number;
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

export interface ProductReport {
  productName: string;
  overallScore: number;
  totalMentions: number;
  sourcesAnalyzed: number;
  sourceBreakdown: SourceInfo[];
  generatedAt: string;
  summary: string;
  strengths: Insight[];
  issues: Insight[];
  aspects: AspectScore[];
  issueRadar: IssueRadarItem[];
  confidence: ConfidenceIndicator;
}
