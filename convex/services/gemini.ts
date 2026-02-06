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

export class GeminiClient {
  private readonly apiKey: string;
  private readonly model: string;

  constructor(config: GeminiConfig) {
    this.apiKey = config.apiKey;
    this.model = config.model || "gemini-1.5-flash-latest";
  }

  private async generate(prompt: string): Promise<string> {
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
          temperature: 0.3,
          maxOutputTokens: 4096,
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
    // Extract JSON from markdown code blocks if present
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonStr = jsonMatch ? jsonMatch[1].trim() : text.trim();

    try {
      return JSON.parse(jsonStr);
    } catch {
      throw new GeminiApiError(`Failed to parse Gemini response as JSON: ${jsonStr.slice(0, 200)}`);
    }
  }

  async analyzeProductFeedback(
    productName: string,
    mentions: Array<{
      text: string;
      author: string;
      date: string;
      url: string;
      isPositive: boolean;
    }>
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

    // Prepare mentions for the prompt (limit to avoid token limits)
    const limitedMentions = mentions.slice(0, 50).map((m, i) => ({
      id: i,
      text: m.text.slice(0, 400),
      author: m.author,
      date: m.date,
      url: m.url,
      sentiment: m.isPositive ? "positive" : "negative",
    }));

    const prompt = `You are analyzing user feedback about "${productName}" from Reddit.

Here are ${limitedMentions.length} user mentions (out of ${mentions.length} total):

${JSON.stringify(limitedMentions, null, 2)}

Analyze this feedback and return a JSON object with this exact structure:
{
  "summary": "2-3 sentence executive summary of overall user sentiment",
  "overallScore": <number 0-100, where 100 is extremely positive>,
  "strengths": [
    {
      "title": "Short title (3-5 words)",
      "description": "One sentence description",
      "mentionIds": [<ids of mentions that support this>]
    }
  ],
  "issues": [
    {
      "title": "Short title (3-5 words)",
      "description": "One sentence description",
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
- Each strength/issue should have specific, descriptive titles (not generic like "User Feedback")
- Reference specific mentionIds that support each insight
- Be accurate to what users actually said
- Return ONLY valid JSON, no other text`;

    const responseText = await this.generate(prompt);
    const parsed = this.parseJsonResponse<{
      summary: string;
      overallScore: number;
      strengths: Array<{ title: string; description: string; mentionIds: number[] }>;
      issues: Array<{ title: string; description: string; mentionIds: number[] }>;
      aspects: Array<{ name: string; score: number; mentionIds: number[] }>;
    }>(responseText);

    // Map mentionIds back to actual quotes
    const mentionMap = new Map(limitedMentions.map((m) => [m.id, m]));

    const mapInsight = (insight: { title: string; description: string; mentionIds: number[] }): AnalyzedInsight => ({
      title: insight.title,
      description: insight.description,
      frequency: insight.mentionIds?.length || 0,
      quotes: (insight.mentionIds || [])
        .slice(0, 5)
        .map((id) => mentionMap.get(id))
        .filter((m): m is NonNullable<typeof m> => m !== undefined)
        .map((m) => ({
          text: mentions[m.id]?.text || m.text,
          author: m.author,
          date: m.date,
          url: m.url,
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
