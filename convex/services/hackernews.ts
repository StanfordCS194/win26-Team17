/**
 * HackerNews Client
 *
 * Uses the Algolia HN Search API (free, no auth required) to fetch stories and comments.
 * API docs: https://hn.algolia.com/api
 */

import { isLikelySoftwareContent } from "./contentFilter";

// ============================================================================
// Types
// ============================================================================

export interface HNStory {
  id: number;
  title: string;
  url: string | null;
  author: string;
  points: number;
  numComments: number;
  createdAt: string;
  storyText: string | null;
}

export interface HNComment {
  id: number;
  text: string;
  author: string;
  createdAt: string;
  storyId: number;
}

export interface HNSearchResult {
  stories: HNStory[];
  query: string;
}

export interface HNStoryWithComments {
  story: HNStory;
  comments: HNComment[];
}

export class HackerNewsApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public retryable: boolean = false
  ) {
    super(message);
    this.name = "HackerNewsApiError";
  }
}

// ============================================================================
// Interface
// ============================================================================

export interface IHackerNewsClient {
  searchStories(query: string, options?: { limit?: number }): Promise<HNSearchResult>;
  fetchComments(storyId: number, options?: { limit?: number }): Promise<HNComment[]>;
  searchWithComments(
    query: string,
    options?: { storyLimit?: number; commentsPerStory?: number }
  ): Promise<HNStoryWithComments[]>;
}

// ============================================================================
// Client Implementation
// ============================================================================

const HN_API_BASE = "https://hn.algolia.com/api/v1";

export interface HackerNewsClientConfig {
  cacheTtlMs?: number;
  maxRetries?: number;
  retryDelayMs?: number;
  requestDelayMs?: number;
}

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

interface AlgoliaHit {
  objectID: string;
  title?: string;
  url?: string;
  author: string;
  points?: number;
  num_comments?: number;
  created_at: string;
  story_text?: string | null;
  comment_text?: string | null;
  story_id?: number;
}

interface AlgoliaResponse {
  hits: AlgoliaHit[];
}

export class HackerNewsClient implements IHackerNewsClient {
  private readonly cacheTtlMs: number;
  private readonly maxRetries: number;
  private readonly retryDelayMs: number;
  private readonly requestDelayMs: number;
  private readonly cache: Map<string, CacheEntry<unknown>> = new Map();

  constructor(config: HackerNewsClientConfig = {}) {
    this.cacheTtlMs = config.cacheTtlMs ?? 5 * 60 * 1000;
    this.maxRetries = config.maxRetries ?? 2;
    this.retryDelayMs = config.retryDelayMs ?? 1000;
    this.requestDelayMs = config.requestDelayMs ?? 200;
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

  private async fetchWithRetry(url: string): Promise<AlgoliaResponse> {
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
          throw new HackerNewsApiError("Rate limited by HN Algolia API", 429, true);
        }

        if (!response.ok) {
          throw new HackerNewsApiError(
            `HN Algolia API error: ${response.status}`,
            response.status,
            response.status >= 500
          );
        }

        return await response.json();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (error instanceof HackerNewsApiError && !error.retryable) throw error;
        if (attempt < this.maxRetries) {
          await this.sleep(this.retryDelayMs * Math.pow(2, attempt));
        }
      }
    }

    throw lastError || new HackerNewsApiError("Failed to fetch from HN Algolia API");
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private parseStory(hit: AlgoliaHit): HNStory {
    return {
      id: parseInt(hit.objectID, 10),
      title: hit.title || "",
      url: hit.url || null,
      author: hit.author || "[unknown]",
      points: hit.points || 0,
      numComments: hit.num_comments || 0,
      createdAt: hit.created_at || "",
      storyText: hit.story_text || null,
    };
  }

  private parseComment(hit: AlgoliaHit, storyId: number): HNComment | null {
    const text = hit.comment_text;
    if (!text || text.length < 10) return null;

    // Strip HTML tags and decode entities
    const cleanText = text
      .replace(/<[^>]*>/g, " ")
      .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
      .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)))
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&amp;/g, "&")
      .replace(/\s+/g, " ")
      .trim();

    if (cleanText.length < 10) return null;

    return {
      id: parseInt(hit.objectID, 10),
      text: cleanText,
      author: hit.author || "[unknown]",
      createdAt: hit.created_at || "",
      storyId,
    };
  }

  async searchStories(query: string, options: { limit?: number; sort?: "relevance" | "date" } = {}): Promise<HNSearchResult> {
    const { limit = 20, sort = "relevance" } = options;

    const cacheKey = `hn:stories:${query}:${limit}:${sort}`;
    const cached = this.getCached<HNSearchResult>(cacheKey);
    if (cached) return cached;

    const encodedQuery = encodeURIComponent(query);
    const endpoint = sort === "date" ? "search_by_date" : "search";
    const url = `${HN_API_BASE}/${endpoint}?query=${encodedQuery}&tags=story&hitsPerPage=${limit}`;

    const data = await this.fetchWithRetry(url);
    const stories = data.hits.map((hit) => this.parseStory(hit));

    const result: HNSearchResult = { stories, query };
    this.setCache(cacheKey, result);
    return result;
  }

  async fetchComments(storyId: number, options: { limit?: number } = {}): Promise<HNComment[]> {
    const { limit = 30 } = options;

    const cacheKey = `hn:comments:${storyId}:${limit}`;
    const cached = this.getCached<HNComment[]>(cacheKey);
    if (cached) return cached;

    const url = `${HN_API_BASE}/search?tags=comment,story_${storyId}&hitsPerPage=${limit}`;

    const data = await this.fetchWithRetry(url);
    const comments = data.hits
      .map((hit) => this.parseComment(hit, storyId))
      .filter((c): c is HNComment => c !== null);

    this.setCache(cacheKey, comments);
    return comments;
  }

  async searchWithComments(
    query: string,
    options: { storyLimit?: number; commentsPerStory?: number } = {}
  ): Promise<HNStoryWithComments[]> {
    const { storyLimit = 10, commentsPerStory = 20 } = options;

    const searchResult = await this.searchStories(query, { limit: storyLimit });

    // Fetch comments in parallel batches of 3
    const batchSize = 3;
    const results: HNStoryWithComments[] = [];

    for (let i = 0; i < searchResult.stories.length; i += batchSize) {
      const batch = searchResult.stories.slice(i, i + batchSize);
      const batchResults = await Promise.allSettled(
        batch.map(story =>
          this.fetchComments(story.id, { limit: commentsPerStory })
            .then(comments => ({ story, comments }))
        )
      );

      for (let j = 0; j < batchResults.length; j++) {
        const result = batchResults[j];
        if (result.status === "fulfilled") {
          results.push(result.value);
        } else {
          console.warn(`Failed to fetch HN comments for story ${batch[j].id}:`, result.reason);
          results.push({ story: batch[j], comments: [] });
        }
      }

      if (i + batchSize < searchResult.stories.length) {
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

function generateHNSoftwareQueries(productName: string): string[] {
  return [
    `${productName}`,
    `${productName} review`,
    `${productName} alternative`,
    `${productName} vs`,
    `${productName} pricing`,
  ];
}

export interface HNSoftwareSearchOptions {
  storyLimit?: number;
  commentsPerStory?: number;
}

export async function searchSoftwareProductHN(
  client: IHackerNewsClient,
  productName: string,
  options: HNSoftwareSearchOptions = {}
): Promise<HNStoryWithComments[]> {
  const { storyLimit = 10, commentsPerStory = 20 } = options;
  const allResults: HNStoryWithComments[] = [];
  const seenStoryIds = new Set<number>();

  const addResults = (results: HNStoryWithComments[]) => {
    for (const result of results) {
      if (!seenStoryIds.has(result.story.id)) {
        seenStoryIds.add(result.story.id);
        allResults.push(result);
      }
    }
  };

  // Mix relevance-sorted and recent results for balanced coverage
  const queries = generateHNSoftwareQueries(productName);

  // First: top relevance hit for the product name
  try {
    const relevanceResults = await client.searchWithComments(productName, {
      storyLimit: 5,
      commentsPerStory,
    });
    addResults(relevanceResults);
  } catch (error) {
    console.warn(`Failed HN relevance search for "${productName}":`, error);
  }

  // Second: recent results (search_by_date) for freshness
  if (allResults.length < storyLimit) {
    try {
      const recentStories = await (client as HackerNewsClient).searchStories(productName, {
        limit: 5,
        sort: "date",
      });
      // Fetch comments for recent stories
      for (const story of recentStories.stories) {
        if (seenStoryIds.has(story.id) || allResults.length >= storyLimit) continue;
        try {
          const comments = await client.fetchComments(story.id, { limit: commentsPerStory });
          addResults([{ story, comments }]);
        } catch {
          addResults([{ story, comments: [] }]);
        }
      }
    } catch (error) {
      console.warn(`Failed HN date search for "${productName}":`, error);
    }
  }

  // Third: query variations for breadth
  for (const query of queries.slice(1)) {
    if (allResults.length >= storyLimit) break;
    try {
      const results = await client.searchWithComments(query, {
        storyLimit: 3,
        commentsPerStory,
      });
      addResults(results);
    } catch (error) {
      console.warn(`Failed HN search for "${query}":`, error);
    }
  }

  // Filter to software-relevant content
  const filtered = allResults.filter(({ story, comments }) => {
    const storyText = [story.title, story.storyText || ""].join(" ");
    const storyRelevant = isLikelySoftwareContent(storyText, productName);
    const hasRelevantComments = comments.some(c =>
      isLikelySoftwareContent(c.text, productName)
    );
    return storyRelevant || hasRelevantComments;
  });

  if (filtered.length < 3 && allResults.length > 0) {
    return allResults.slice(0, storyLimit);
  }

  return filtered.slice(0, storyLimit);
}

// ============================================================================
// Factory
// ============================================================================

export function createHackerNewsClient(config?: HackerNewsClientConfig): IHackerNewsClient {
  return new HackerNewsClient(config);
}
