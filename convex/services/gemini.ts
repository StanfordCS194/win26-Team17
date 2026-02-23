/**
 * Gemini API Client
 *
 * Uses Google's Gemini API for AI-powered analysis.
 */

// ============================================================================
// Types
// ============================================================================

export interface GeminiConfig {
  apiKey: string;
  model?: string;
  maxRetries?: number;
}

export interface AnalyzedInsight {
  title: string;
  description: string;
  frequency: number;
  quotes: Array<{
    text: string;
    author: string;
    date: string;
    url: string;
  }>;
}

export interface AnalysisResult {
  summary: string;
  overallScore: number;
  strengths: AnalyzedInsight[];
  issues: AnalyzedInsight[];
  aspects: Array<{
    name: string;
    score: number;
    mentions: number;
  }>;
}

export interface QualityScore {
  overall: number;
  mentionCoverage: number;
  insightSpecificity: number;
  quoteAccuracy: number;
  reasons: string[];
}

export interface MentionInput {
  text: string;
  author: string;
  date: string;
  url: string;
  isPositive: boolean;
  source?: string;
}

export class GeminiApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number
  ) {
    super(message);
    this.name = "GeminiApiError";
  }
}

// ============================================================================
// Client
// ============================================================================

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models";

const GENERIC_TITLES = new Set([
  "user feedback",
  "user feedback highlights",
  "general feedback",
  "positive feedback",
  "negative feedback",
  "areas for improvement",
  "mixed reviews",
  "overall sentiment",
]);

export class GeminiClient {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly maxRetries: number;

  constructor(config: GeminiConfig) {
    this.apiKey = config.apiKey;
    this.model = config.model || "gemini-2.5-flash";
    this.maxRetries = config.maxRetries ?? 1;
  }

  private async generate(prompt: string, temperature = 0.3): Promise<string> {
    const url = `${GEMINI_API_URL}/${this.model}:generateContent?key=${this.apiKey}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature,
          maxOutputTokens: 8192,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new GeminiApiError(`Gemini API error: ${response.status} - ${error}`, response.status);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      throw new GeminiApiError("No response from Gemini");
    }

    return text;
  }

  private parseJsonResponse<T>(text: string): T {
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonStr = jsonMatch ? jsonMatch[1].trim() : text.trim();

    try {
      return JSON.parse(jsonStr);
    } catch {
      throw new GeminiApiError(`Failed to parse Gemini response as JSON: ${jsonStr.slice(0, 200)}`);
    }
  }

  // ---------------------------------------------------------------------------
  // Output Quality Scoring
  // ---------------------------------------------------------------------------

  scoreOutputQuality(
    parsed: {
      summary: string;
      overallScore: number;
      strengths: Array<{ title: string; mentionIds: number[] }>;
      issues: Array<{ title: string; mentionIds: number[] }>;
      aspects: Array<{ mentionIds: number[] }>;
    },
    mentionCount: number
  ): QualityScore {
    const reasons: string[] = [];

    // 1. Mention coverage: what % of input mentions are referenced?
    const allReferencedIds = new Set<number>();
    for (const s of parsed.strengths) {
      for (const id of s.mentionIds || []) allReferencedIds.add(id);
    }
    for (const i of parsed.issues) {
      for (const id of i.mentionIds || []) allReferencedIds.add(id);
    }
    for (const a of parsed.aspects) {
      for (const id of a.mentionIds || []) allReferencedIds.add(id);
    }
    const validIds = [...allReferencedIds].filter(id => id >= 0 && id < mentionCount);
    const mentionCoverage = mentionCount > 0 ? validIds.length / mentionCount : 0;
    if (mentionCoverage < 0.3) {
      reasons.push(`Low mention coverage: only ${validIds.length}/${mentionCount} mentions referenced`);
    }

    // 2. Insight specificity: are titles generic?
    const allTitles = [
      ...parsed.strengths.map(s => s.title),
      ...parsed.issues.map(i => i.title),
    ];
    const genericCount = allTitles.filter(
      t => GENERIC_TITLES.has(t.toLowerCase().trim())
    ).length;
    const insightSpecificity = allTitles.length > 0
      ? 1 - (genericCount / allTitles.length)
      : 0;
    if (genericCount > 0) {
      reasons.push(`${genericCount} generic insight title(s) detected`);
    }

    // 3. Quote accuracy: are all mentionIds in bounds?
    const outOfBounds = [...allReferencedIds].filter(id => id < 0 || id >= mentionCount);
    const quoteAccuracy = allReferencedIds.size > 0
      ? 1 - (outOfBounds.length / allReferencedIds.size)
      : 1;
    if (outOfBounds.length > 0) {
      reasons.push(`${outOfBounds.length} out-of-bounds mentionId(s)`);
    }

    // 4. Structural checks
    if ((parsed.strengths?.length || 0) < 1) {
      reasons.push("No strengths identified");
    }
    if ((parsed.issues?.length || 0) < 1) {
      reasons.push("No issues identified");
    }
    if (!parsed.summary || parsed.summary.length < 20) {
      reasons.push("Summary too short or missing");
    }
    if (parsed.overallScore < 0 || parsed.overallScore > 100) {
      reasons.push(`Score out of range: ${parsed.overallScore}`);
    }

    const structuralScore =
      ((parsed.strengths?.length || 0) >= 2 ? 0.25 : 0) +
      ((parsed.issues?.length || 0) >= 2 ? 0.25 : 0) +
      (parsed.summary && parsed.summary.length >= 20 ? 0.25 : 0) +
      (parsed.overallScore >= 0 && parsed.overallScore <= 100 ? 0.25 : 0);

    const overall = (
      mentionCoverage * 0.3 +
      insightSpecificity * 0.3 +
      quoteAccuracy * 0.2 +
      structuralScore * 0.2
    );

    return { overall, mentionCoverage, insightSpecificity, quoteAccuracy, reasons };
  }

  // ---------------------------------------------------------------------------
  // Prompt Building
  // ---------------------------------------------------------------------------

  private buildPrompt(
    productName: string,
    limitedMentions: Array<{ id: number; text: string; author: string; sentiment: string; source: string }>,
    totalMentions: number,
    sourceBreakdown: Record<string, number>,
    isRetry: boolean,
    qualityIssues?: string[]
  ): string {
    const sourceDescriptions: Record<string, string> = {
      reddit: "Reddit (broad user base, casual to professional)",
      hackernews: "HackerNews (technical audience, developers and founders)",
      stackoverflow: "Stack Overflow (Q&A, developer-focused technical discussions)",
      devto: "Dev.to (developer blog posts and community articles)",
      g2: "G2 (business software reviewers)",
    };

    const sourceLines = Object.entries(sourceBreakdown)
      .map(([src, count]) => `- ${sourceDescriptions[src] || src}: ${count} mentions`)
      .join("\n");

    let retryInstructions = "";
    if (isRetry && qualityIssues?.length) {
      retryInstructions = `
IMPORTANT: A previous analysis attempt had quality issues:
${qualityIssues.map(r => `- ${r}`).join("\n")}

Fix these issues in this attempt:
- Use SPECIFIC, descriptive titles (not "User Feedback" or "General Issues")
- Reference more mentionIds to improve coverage
- Only use mentionIds between 0 and ${limitedMentions.length - 1}
- Ensure at least 2 strengths and 2 issues are identified
`;
    }

    return `You are analyzing user feedback about "${productName}" gathered from multiple online communities.

Source breakdown:
${sourceLines}

Here are ${limitedMentions.length} user mentions (out of ${totalMentions} total):

${JSON.stringify(limitedMentions, null, 2)}
${retryInstructions}
Analyze this feedback and return a JSON object with this exact structure:
{
  "summary": "2-3 sentence executive summary of overall user sentiment. Note if different communities have different perspectives.",
  "overallScore": <number 0-100, where 100 is extremely positive>,
  "strengths": [
    {
      "title": "Short specific title (3-5 words, NOT generic like 'User Feedback')",
      "description": "One sentence description grounded in actual user quotes",
      "mentionIds": [<ids of mentions that support this>]
    }
  ],
  "issues": [
    {
      "title": "Short specific title (3-5 words, NOT generic like 'Areas for Improvement')",
      "description": "One sentence description grounded in actual user quotes",
      "mentionIds": [<ids of mentions that support this>]
    }
  ],
  "aspects": [
    {"name": "Features", "score": <0-100>, "mentionIds": [...]},
    {"name": "Ease of Use", "score": <0-100>, "mentionIds": [...]},
    {"name": "Performance", "score": <0-100>, "mentionIds": [...]}
  ]
}

Rules:
- Identify 2-4 distinct strengths (positive themes)
- Identify 2-4 distinct issues (negative themes/complaints)
- Each strength/issue MUST have a specific, descriptive title based on what users actually said
- Reference specific mentionIds that support each insight (aim to cover most mentions)
- If communities disagree (e.g. Reddit positive but HN negative), note it in the summary
- Be accurate to what users actually said
- Return ONLY valid JSON, no other text`;
  }

  // ---------------------------------------------------------------------------
  // Main Analysis (with retry on low quality)
  // ---------------------------------------------------------------------------

  async analyzeProductFeedback(
    productName: string,
    mentions: MentionInput[]
  ): Promise<AnalysisResult> {
    if (mentions.length === 0) {
      return {
        summary: `No user feedback found for "${productName}".`,
        overallScore: 50,
        strengths: [],
        issues: [],
        aspects: [
          { name: "Features", score: 50, mentions: 0 },
          { name: "Ease of Use", score: 50, mentions: 0 },
          { name: "Performance", score: 50, mentions: 0 },
        ],
      };
    }

    const limitedMentions = mentions.slice(0, 30).map((m, i) => ({
      id: i,
      text: m.text.slice(0, 300),
      author: m.author,
      sentiment: m.isPositive ? "positive" : "negative",
      source: m.source || "reddit",
    }));

    const sourceBreakdown: Record<string, number> = {};
    for (const m of limitedMentions) {
      sourceBreakdown[m.source] = (sourceBreakdown[m.source] || 0) + 1;
    }

    type ParsedResponse = {
      summary: string;
      overallScore: number;
      strengths: Array<{ title: string; description: string; mentionIds: number[] }>;
      issues: Array<{ title: string; description: string; mentionIds: number[] }>;
      aspects: Array<{ name: string; score: number; mentionIds: number[] }>;
    };

    let bestParsed: ParsedResponse | null = null;
    let bestQuality: QualityScore | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      const isRetry = attempt > 0;
      const prompt = this.buildPrompt(
        productName,
        limitedMentions,
        mentions.length,
        sourceBreakdown,
        isRetry,
        bestQuality?.reasons
      );

      const temperature = isRetry ? 0.5 : 0.3;
      const responseText = await this.generate(prompt, temperature);
      const parsed = this.parseJsonResponse<ParsedResponse>(responseText);

      const quality = this.scoreOutputQuality(parsed, limitedMentions.length);
      console.log(`Gemini analysis attempt ${attempt + 1}: quality=${quality.overall.toFixed(2)} [coverage=${quality.mentionCoverage.toFixed(2)}, specificity=${quality.insightSpecificity.toFixed(2)}, accuracy=${quality.quoteAccuracy.toFixed(2)}]`);

      if (!bestParsed || quality.overall > (bestQuality?.overall ?? 0)) {
        bestParsed = parsed;
        bestQuality = quality;
      }

      if (quality.overall >= 0.6) break;

      if (attempt < this.maxRetries) {
        console.log(`Quality below threshold (${quality.overall.toFixed(2)} < 0.6), reprompting... Issues: ${quality.reasons.join("; ")}`);
      }
    }

    const parsed = bestParsed!;

    const mapInsight = (insight: { title: string; description: string; mentionIds: number[] }): AnalyzedInsight => ({
      title: insight.title,
      description: insight.description,
      frequency: insight.mentionIds?.length || 0,
      quotes: (insight.mentionIds || [])
        .slice(0, 5)
        .filter((id) => id >= 0 && id < mentions.length)
        .map((id) => ({
          text: mentions[id]?.text || "",
          author: mentions[id]?.author || "Unknown",
          date: mentions[id]?.date || "",
          url: mentions[id]?.url || "",
        })),
    });

    return {
      summary: parsed.summary,
      overallScore: Math.max(0, Math.min(100, parsed.overallScore)),
      strengths: (parsed.strengths || []).map(mapInsight),
      issues: (parsed.issues || []).map(mapInsight),
      aspects: (parsed.aspects || []).map((a) => ({
        name: a.name,
        score: Math.max(0, Math.min(100, a.score)),
        mentions: a.mentionIds?.length || 0,
      })),
    };
  }
}

export function createGeminiClient(apiKey: string): GeminiClient {
  return new GeminiClient({ apiKey });
}
