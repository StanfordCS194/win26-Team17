export interface Quote {
  text: string;
  source: "reddit" | "hackernews" | "g2";
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

export interface ProductReport {
  productName: string;
  overallScore: number;
  totalMentions: number;
  sourcesAnalyzed: number;
  generatedAt: string;
  summary: string;
  strengths: Insight[];
  issues: Insight[];
  aspects: AspectScore[];
}
