/**
 * Dev.to Client
 *
 * Uses the Dev.to API (free, no auth required for reads).
 * API docs: https://developers.forem.com/api/v1
 */

import { isLikelySoftwareContent } from "./contentFilter";

// ============================================================================
// Types
// ============================================================================

export interface DevToArticle {
  id: number;
  title: string;
  description: string;
  body: string;
  author: string;
  url: string;
  publishedAt: string;
  positiveReactions: number;
  commentsCount: number;
  tags: string[];
}

export interface DevToComment {
  id: number;
  body: string;
  author: string;
  createdAt: string;
  articleId: number;
}

export interface DevToSearchResult {
  articles: DevToArticle[];
  query: string;
}

export interface DevToArticleWithComments {
  article: DevToArticle;
  comments: DevToComment[];
}

export class DevToApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public retryable: boolean = false
  ) {
    super(message);
    this.name = "DevToApiError";
  }
}

// ============================================================================
// Interface
// ============================================================================

export interface IDevToClient {
  searchArticles(query: string, options?: { limit?: number }): Promise<DevToSearchResult>;
  fetchComments(articleId: number): Promise<DevToComment[]>;
  searchWithComments(
    query: string,
    options?: { articleLimit?: number }
  ): Promise<DevToArticleWithComments[]>;
}

// ============================================================================
// Client Implementation
// ============================================================================

const DEVTO_API_BASE = "https://dev.to/api";

export interface DevToClientConfig {
  cacheTtlMs?: number;
  maxRetries?: number;
  retryDelayMs?: number;
  requestDelayMs?: number;
}

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

interface DevToApiArticle {
  id: number;
  title?: string;
  description?: string;
  body_markdown?: string;
  body_html?: string;
  user?: { name?: string; username?: string };
  url?: string;
  published_at?: string;
  positive_reactions_count?: number;
  comments_count?: number;
  tag_list?: string[] | string;
}

interface DevToApiComment {
  id_code: string;
  body_html?: string;
  user?: { name?: string; username?: string };
  created_at?: string;
  children?: DevToApiComment[];
}

function stripHtml(text: string): string {
  return text
    .replace(/<[^>]*>/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, num: string) => String.fromCharCode(parseInt(num, 10)))
    .replace(/\s+/g, " ")
    .trim();
}

export class DevToClient implements IDevToClient {
  private readonly cacheTtlMs: number;
  private readonly maxRetries: number;
  private readonly retryDelayMs: number;
  private readonly requestDelayMs: number;
  private readonly cache: Map<string, CacheEntry<unknown>> = new Map();

  constructor(config: DevToClientConfig = {}) {
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

  private async fetchWithRetry(url: string): Promise<unknown> {
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
          throw new DevToApiError("Rate limited by Dev.to API", 429, true);
        }

        if (!response.ok) {
          throw new DevToApiError(
            `Dev.to API error: ${response.status}`,
            response.status,
            response.status >= 500
          );
        }

        return await response.json();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (error instanceof DevToApiError && !error.retryable) throw error;
        if (attempt < this.maxRetries) {
          await this.sleep(this.retryDelayMs * Math.pow(2, attempt));
        }
      }
    }

    throw lastError || new DevToApiError("Failed to fetch from Dev.to API");
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private parseArticle(item: DevToApiArticle): DevToArticle {
    const tags = Array.isArray(item.tag_list)
      ? item.tag_list
      : typeof item.tag_list === "string"
        ? item.tag_list.split(",").map((t) => t.trim()).filter(Boolean)
        : [];

    return {
      id: item.id,
      title: item.title || "",
      description: item.description || "",
      body: item.body_markdown || stripHtml(item.body_html || ""),
      author: item.user?.name || item.user?.username || "[unknown]",
      url: item.url || "",
      publishedAt: item.published_at || "",
      positiveReactions: item.positive_reactions_count || 0,
      commentsCount: item.comments_count || 0,
      tags,
    };
  }

  private flattenComments(
    comments: DevToApiComment[],
    articleId: number
  ): DevToComment[] {
    const result: DevToComment[] = [];

    const traverse = (list: DevToApiComment[]) => {
      for (const c of list) {
        const body = stripHtml(c.body_html || "");
        if (body.length >= 30) {
          result.push({
            id: parseInt(c.id_code, 10) || 0,
            body,
            author: c.user?.name || c.user?.username || "[unknown]",
            createdAt: c.created_at || "",
            articleId,
          });
        }
        if (c.children && c.children.length > 0) {
          traverse(c.children);
        }
      }
    };

    traverse(comments);
    return result;
  }

  async searchArticles(query: string, options: { limit?: number } = {}): Promise<DevToSearchResult> {
    const { limit = 30 } = options;

    const cacheKey = `devto:articles:${query}:${limit}`;
    const cached = this.getCached<DevToSearchResult>(cacheKey);
    if (cached) return cached;

    // Dev.to uses tag-based and text search via different params
    const tagQuery = query.toLowerCase().replace(/[\s.]+/g, "");
    const url = `${DEVTO_API_BASE}/articles?per_page=${limit}&top=365&tag=${encodeURIComponent(tagQuery)}`;

    const data = (await this.fetchWithRetry(url)) as DevToApiArticle[];
    const articles = (Array.isArray(data) ? data : []).map((item) => this.parseArticle(item));

    const result: DevToSearchResult = { articles, query };
    this.setCache(cacheKey, result);
    return result;
  }

  async fetchArticleById(articleId: number): Promise<DevToArticle> {
    const cacheKey = `devto:article:${articleId}`;
    const cached = this.getCached<DevToArticle>(cacheKey);
    if (cached) return cached;

    const url = `${DEVTO_API_BASE}/articles/${articleId}`;
    const data = (await this.fetchWithRetry(url)) as DevToApiArticle;
    const article = this.parseArticle(data);

    this.setCache(cacheKey, article);
    return article;
  }

  async fetchComments(articleId: number): Promise<DevToComment[]> {
    const cacheKey = `devto:comments:${articleId}`;
    const cached = this.getCached<DevToComment[]>(cacheKey);
    if (cached) return cached;

    const url = `${DEVTO_API_BASE}/comments?a_id=${articleId}`;

    const data = (await this.fetchWithRetry(url)) as DevToApiComment[];
    const comments = this.flattenComments(Array.isArray(data) ? data : [], articleId);

    this.setCache(cacheKey, comments);
    return comments;
  }

  async searchWithComments(
    query: string,
    options: { articleLimit?: number } = {}
  ): Promise<DevToArticleWithComments[]> {
    const { articleLimit = 10 } = options;

    const searchResult = await this.searchArticles(query, { limit: articleLimit });

    const batchSize = 3;
    const results: DevToArticleWithComments[] = [];

    for (let i = 0; i < searchResult.articles.length; i += batchSize) {
      const batch = searchResult.articles.slice(i, i + batchSize);
      const batchResults = await Promise.allSettled(
        batch.map(async (article) => {
          // Fetch full article (for body) and comments in parallel
          const [fullArticle, comments] = await Promise.all([
            this.fetchArticleById(article.id).catch(() => article),
            this.fetchComments(article.id),
          ]);
          return { article: fullArticle, comments };
        })
      );

      for (let j = 0; j < batchResults.length; j++) {
        const result = batchResults[j];
        if (result.status === "fulfilled") {
          results.push(result.value);
        } else {
          console.warn(`Failed to fetch Dev.to data for article ${batch[j].id}:`, result.reason);
          results.push({ article: batch[j], comments: [] });
        }
      }

      if (i + batchSize < searchResult.articles.length) {
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

function generateDevToQueries(productName: string): string[] {
  return [
    productName,
    `${productName} review`,
    `${productName} alternative`,
    `${productName} tutorial`,
  ];
}

export interface DevToSoftwareSearchOptions {
  articleLimit?: number;
}

export async function searchSoftwareProductDevTo(
  client: IDevToClient,
  productName: string,
  options: DevToSoftwareSearchOptions = {}
): Promise<DevToArticleWithComments[]> {
  const { articleLimit = 10 } = options;
  const allResults: DevToArticleWithComments[] = [];
  const seenIds = new Set<number>();

  const addResults = (results: DevToArticleWithComments[]) => {
    for (const result of results) {
      if (!seenIds.has(result.article.id)) {
        seenIds.add(result.article.id);
        allResults.push(result);
      }
    }
  };

  const queries = generateDevToQueries(productName);

  // Primary tag-based search
  try {
    const results = await client.searchWithComments(productName, {
      articleLimit: Math.min(articleLimit, 10),
    });
    addResults(results);
  } catch (error) {
    console.warn(`Failed Dev.to search for "${productName}":`, error);
  }

  // Query variations for breadth
  for (const query of queries.slice(1)) {
    if (allResults.length >= articleLimit) break;
    try {
      const results = await client.searchWithComments(query, {
        articleLimit: 3,
      });
      addResults(results);
    } catch (error) {
      console.warn(`Failed Dev.to search for "${query}":`, error);
    }
  }

  // Filter to software-relevant content
  const filtered = allResults.filter(({ article, comments }) => {
    const articleText = [article.title, article.description, article.body.slice(0, 500)].join(" ");
    const articleRelevant = isLikelySoftwareContent(articleText, productName);
    const hasRelevantComments = comments.some((c) =>
      isLikelySoftwareContent(c.body, productName)
    );
    return articleRelevant || hasRelevantComments;
  });

  if (filtered.length < 3 && allResults.length > 0) {
    return allResults.slice(0, articleLimit);
  }

  return filtered.slice(0, articleLimit);
}

// ============================================================================
// Factory
// ============================================================================

export function createDevToClient(config?: DevToClientConfig): IDevToClient {
  return new DevToClient(config);
}
