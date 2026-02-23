/**
 * Stack Overflow Client
 *
 * Uses the Stack Exchange API v2.3 (free, no auth required, 300 req/day).
 * API docs: https://api.stackexchange.com/docs
 */

import { isLikelySoftwareContent } from "./contentFilter";

// ============================================================================
// Types
// ============================================================================

export interface SOQuestion {
  id: number;
  title: string;
  body: string;
  author: string;
  score: number;
  answerCount: number;
  createdAt: string;
  url: string;
  tags: string[];
}

export interface SOAnswer {
  id: number;
  body: string;
  author: string;
  score: number;
  isAccepted: boolean;
  createdAt: string;
  questionId: number;
}

export interface SOSearchResult {
  questions: SOQuestion[];
  query: string;
}

export interface SOQuestionWithAnswers {
  question: SOQuestion;
  answers: SOAnswer[];
}

export class StackOverflowApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public retryable: boolean = false
  ) {
    super(message);
    this.name = "StackOverflowApiError";
  }
}

// ============================================================================
// Interface
// ============================================================================

export interface IStackOverflowClient {
  searchQuestions(query: string, options?: { limit?: number; tagged?: string }): Promise<SOSearchResult>;
  fetchAnswers(questionId: number, options?: { limit?: number }): Promise<SOAnswer[]>;
  searchWithAnswers(
    query: string,
    options?: { questionLimit?: number; answersPerQuestion?: number; tagged?: string }
  ): Promise<SOQuestionWithAnswers[]>;
}

// ============================================================================
// Client Implementation
// ============================================================================

const SO_API_BASE = "https://api.stackexchange.com/2.3";

export interface StackOverflowClientConfig {
  cacheTtlMs?: number;
  maxRetries?: number;
  retryDelayMs?: number;
  requestDelayMs?: number;
  apiKey?: string;
}

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

interface SOApiItem {
  question_id?: number;
  answer_id?: number;
  title?: string;
  body?: string;
  owner?: { display_name?: string };
  score?: number;
  answer_count?: number;
  creation_date?: number;
  link?: string;
  tags?: string[];
  is_accepted?: boolean;
}

interface SOApiResponse {
  items: SOApiItem[];
  has_more: boolean;
  quota_remaining: number;
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/<[^>]*>/g, " ")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, num: string) => String.fromCharCode(parseInt(num, 10)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

export class StackOverflowClient implements IStackOverflowClient {
  private readonly cacheTtlMs: number;
  private readonly maxRetries: number;
  private readonly retryDelayMs: number;
  private readonly requestDelayMs: number;
  private readonly apiKey: string | undefined;
  private readonly cache: Map<string, CacheEntry<unknown>> = new Map();

  constructor(config: StackOverflowClientConfig = {}) {
    this.cacheTtlMs = config.cacheTtlMs ?? 5 * 60 * 1000;
    this.maxRetries = config.maxRetries ?? 2;
    this.retryDelayMs = config.retryDelayMs ?? 1000;
    this.requestDelayMs = config.requestDelayMs ?? 200;
    this.apiKey = config.apiKey;
  }

  private getCached<T>(key: string): T | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return entry.data;
  }

  private setCache<T>(key: string, data: T): void {
    this.cache.set(key, { data, expiresAt: Date.now() + this.cacheTtlMs });
  }

  private async fetchWithRetry(url: string): Promise<SOApiResponse> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await fetch(url, {
          headers: { Accept: "application/json" },
        });

        if (response.status === 429) {
          if (attempt < this.maxRetries) {
            await this.sleep(this.retryDelayMs * Math.pow(2, attempt));
            continue;
          }
          throw new StackOverflowApiError("Rate limited by Stack Overflow API", 429, true);
        }

        if (!response.ok) {
          throw new StackOverflowApiError(
            `Stack Overflow API error: ${response.status}`,
            response.status,
            response.status >= 500
          );
        }

        return await response.json();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (error instanceof StackOverflowApiError && !error.retryable) throw error;
        if (attempt < this.maxRetries) {
          await this.sleep(this.retryDelayMs * Math.pow(2, attempt));
        }
      }
    }

    throw lastError || new StackOverflowApiError("Failed to fetch from Stack Overflow API");
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private buildUrl(path: string, params: Record<string, string>): string {
    const url = new URL(`${SO_API_BASE}${path}`);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
    url.searchParams.set("site", "stackoverflow");
    if (this.apiKey) {
      url.searchParams.set("key", this.apiKey);
    }
    return url.toString();
  }

  private parseQuestion(item: SOApiItem): SOQuestion {
    return {
      id: item.question_id || 0,
      title: decodeHtmlEntities(item.title || ""),
      body: decodeHtmlEntities(item.body || ""),
      author: decodeHtmlEntities(item.owner?.display_name || "[unknown]"),
      score: item.score || 0,
      answerCount: item.answer_count || 0,
      createdAt: item.creation_date
        ? new Date(item.creation_date * 1000).toISOString()
        : "",
      url: item.link || "",
      tags: item.tags || [],
    };
  }

  private parseAnswer(item: SOApiItem, questionId: number): SOAnswer | null {
    const body = decodeHtmlEntities(item.body || "");
    if (body.length < 30) return null;

    return {
      id: item.answer_id || 0,
      body,
      author: decodeHtmlEntities(item.owner?.display_name || "[unknown]"),
      score: item.score || 0,
      isAccepted: item.is_accepted || false,
      createdAt: item.creation_date
        ? new Date(item.creation_date * 1000).toISOString()
        : "",
      questionId,
    };
  }

  async searchQuestions(query: string, options: { limit?: number; tagged?: string } = {}): Promise<SOSearchResult> {
    const { limit = 20, tagged } = options;

    const cacheKey = `so:questions:${query}:${limit}:${tagged || ""}`;
    const cached = this.getCached<SOSearchResult>(cacheKey);
    if (cached) return cached;

    const params: Record<string, string> = {
      q: query,
      filter: "withbody",
      pagesize: String(limit),
      sort: "relevance",
    };
    if (tagged) {
      params.tagged = tagged;
    }
    const url = this.buildUrl("/search/advanced", params);

    const data = await this.fetchWithRetry(url);
    const questions = data.items.map((item) => this.parseQuestion(item));

    const result: SOSearchResult = { questions, query };
    this.setCache(cacheKey, result);
    return result;
  }

  async fetchAnswers(questionId: number, options: { limit?: number } = {}): Promise<SOAnswer[]> {
    const { limit = 20 } = options;

    const cacheKey = `so:answers:${questionId}:${limit}`;
    const cached = this.getCached<SOAnswer[]>(cacheKey);
    if (cached) return cached;

    const url = this.buildUrl(`/questions/${questionId}/answers`, {
      filter: "withbody",
      sort: "votes",
      pagesize: String(limit),
    });

    const data = await this.fetchWithRetry(url);
    const answers = data.items
      .map((item) => this.parseAnswer(item, questionId))
      .filter((a): a is SOAnswer => a !== null);

    this.setCache(cacheKey, answers);
    return answers;
  }

  async searchWithAnswers(
    query: string,
    options: { questionLimit?: number; answersPerQuestion?: number; tagged?: string } = {}
  ): Promise<SOQuestionWithAnswers[]> {
    const { questionLimit = 10, answersPerQuestion = 20, tagged } = options;

    const searchResult = await this.searchQuestions(query, { limit: questionLimit, tagged });

    const batchSize = 3;
    const results: SOQuestionWithAnswers[] = [];

    for (let i = 0; i < searchResult.questions.length; i += batchSize) {
      const batch = searchResult.questions.slice(i, i + batchSize);
      const batchResults = await Promise.allSettled(
        batch.map((question) =>
          this.fetchAnswers(question.id, { limit: answersPerQuestion })
            .then((answers) => ({ question, answers }))
        )
      );

      for (let j = 0; j < batchResults.length; j++) {
        const result = batchResults[j];
        if (result.status === "fulfilled") {
          results.push(result.value);
        } else {
          console.warn(`Failed to fetch SO answers for question ${batch[j].id}:`, result.reason);
          results.push({ question: batch[j], answers: [] });
        }
      }

      if (i + batchSize < searchResult.questions.length) {
        await this.sleep(this.requestDelayMs);
      }
    }

    return results;
  }

  clearCache(): void {
    this.cache.clear();
  }
}

// ============================================================================
// Software-Focused Search
// ============================================================================

function generateSOSoftwareQueries(productName: string): string[] {
  return [
    `${productName}`,
    `${productName} review`,
    `${productName} alternative`,
    `${productName} vs`,
    `${productName} api`,
  ];
}

export interface SOSoftwareSearchOptions {
  questionLimit?: number;
  answersPerQuestion?: number;
}

export async function searchSoftwareProductSO(
  client: IStackOverflowClient,
  productName: string,
  options: SOSoftwareSearchOptions = {}
): Promise<SOQuestionWithAnswers[]> {
  const { questionLimit = 10, answersPerQuestion = 20 } = options;
  const allResults: SOQuestionWithAnswers[] = [];
  const seenIds = new Set<number>();

  const addResults = (results: SOQuestionWithAnswers[]) => {
    for (const result of results) {
      if (!seenIds.has(result.question.id)) {
        seenIds.add(result.question.id);
        allResults.push(result);
      }
    }
  };

  const queries = generateSOSoftwareQueries(productName);
  const tag = productName.toLowerCase().replace(/\s+/g, "-");

  // First pass: tagged search (most targeted -- only questions tagged with the product)
  try {
    const results = await client.searchWithAnswers(productName, {
      questionLimit: Math.min(questionLimit, 10),
      answersPerQuestion,
      tagged: tag,
    });
    addResults(results);
  } catch (error) {
    console.warn(`Failed tagged SO search for "${productName}":`, error);
  }

  // Second pass: untagged primary search
  if (allResults.length < questionLimit) {
    try {
      const results = await client.searchWithAnswers(productName, {
        questionLimit: Math.min(questionLimit, 10),
        answersPerQuestion,
      });
      addResults(results);
    } catch (error) {
      console.warn(`Failed SO search for "${productName}":`, error);
    }
  }

  // Query variations for breadth
  for (const query of queries.slice(1)) {
    if (allResults.length >= questionLimit) break;
    try {
      const results = await client.searchWithAnswers(query, {
        questionLimit: 3,
        answersPerQuestion,
      });
      addResults(results);
    } catch (error) {
      console.warn(`Failed SO search for "${query}":`, error);
    }
  }

  // Filter to software-relevant content
  const filtered = allResults.filter(({ question, answers }) => {
    const questionText = [question.title, question.body].join(" ");
    const questionRelevant = isLikelySoftwareContent(questionText, productName);
    const hasRelevantAnswers = answers.some((a) =>
      isLikelySoftwareContent(a.body, productName)
    );
    return questionRelevant || hasRelevantAnswers;
  });

  if (filtered.length < 3 && allResults.length > 0) {
    return allResults.slice(0, questionLimit);
  }

  return filtered.slice(0, questionLimit);
}

// ============================================================================
// Factory
// ============================================================================

export function createStackOverflowClient(config?: StackOverflowClientConfig): IStackOverflowClient {
  return new StackOverflowClient(config);
}
