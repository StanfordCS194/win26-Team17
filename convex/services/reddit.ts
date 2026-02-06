/**
 * Reddit RSS Feed Client
 *
 * Uses Reddit's public RSS feeds (no auth required) to fetch posts and comments.
 */

// ============================================================================
// Types
// ============================================================================

export interface RedditPost {
  id: string;
  title: string;
  content: string;
  author: string;
  subreddit: string;
  createdAt: string;
  permalink: string;
}

export interface RedditComment {
  id: string;
  content: string;
  author: string;
  createdAt: string;
  permalink: string;
  postId: string;
}

export interface RedditSearchResult {
  posts: RedditPost[];
  query: string;
}

export interface RedditPostWithComments {
  post: RedditPost;
  comments: RedditComment[];
}

export interface SearchOptions {
  subreddit?: string;
  limit?: number;
  sort?: "relevance" | "hot" | "top" | "new";
  time?: "hour" | "day" | "week" | "month" | "year" | "all";
}

export class RedditApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public retryable: boolean = false
  ) {
    super(message);
    this.name = "RedditApiError";
  }
}

// ============================================================================
// Interface
// ============================================================================

export interface IRedditClient {
  searchPosts(query: string, options?: SearchOptions): Promise<RedditSearchResult>;
  fetchComments(permalink: string, options?: { limit?: number }): Promise<RedditComment[]>;
  searchWithComments(
    query: string,
    options?: { subreddit?: string; postLimit?: number; commentsPerPost?: number }
  ): Promise<RedditPostWithComments[]>;
}

// ============================================================================
// XML Parsing Helpers
// ============================================================================

function extractTagContent(xml: string, tagName: string): string | null {
  const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)</${tagName}>`, "i");
  const match = xml.match(regex);
  return match ? match[1].trim() : null;
}

function extractAttribute(xml: string, tagName: string, attrName: string): string | null {
  const regex = new RegExp(`<${tagName}[^>]*${attrName}="([^"]*)"`, "i");
  const match = xml.match(regex);
  return match ? match[1] : null;
}

function extractAllEntries(xml: string): string[] {
  const entries: string[] = [];
  const regex = /<entry>([\s\S]*?)<\/entry>/gi;
  let match;
  while ((match = regex.exec(xml)) !== null) {
    entries.push(match[1]);
  }
  return entries;
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

function stripHtml(html: string): string {
  const decoded = decodeHtmlEntities(html);
  return decoded
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractIdFromLink(link: string): string {
  const match = link.match(/comments\/([a-z0-9]+)/i);
  return match ? match[1] : link;
}

function parsePost(entry: string, defaultSubreddit?: string): RedditPost | null {
  const title = extractTagContent(entry, "title");
  const content = extractTagContent(entry, "content");
  const authorName = extractTagContent(entry, "name");
  const link = extractAttribute(entry, "link", "href");
  const updated = extractTagContent(entry, "updated") || extractTagContent(entry, "published");
  const category = extractAttribute(entry, "category", "label");

  if (!title || !link) return null;

  return {
    id: extractIdFromLink(link),
    title: decodeHtmlEntities(title),
    content: content ? stripHtml(content) : "",
    author: authorName?.replace("/u/", "") || "[unknown]",
    subreddit: category?.replace("r/", "") || defaultSubreddit || "",
    createdAt: updated || "",
    permalink: link,
  };
}

function parseComment(entry: string, postId: string): RedditComment | null {
  const content = extractTagContent(entry, "content");
  const authorName = extractTagContent(entry, "name");
  const link = extractAttribute(entry, "link", "href");
  const updated = extractTagContent(entry, "updated") || extractTagContent(entry, "published");
  const id = extractTagContent(entry, "id");

  if (!content || !link) return null;

  const cleanContent = stripHtml(content);
  if (cleanContent === "[deleted]" || cleanContent === "[removed]" || cleanContent.length < 10) {
    return null;
  }

  return {
    id: id?.replace("t1_", "") || extractIdFromLink(link),
    content: cleanContent,
    author: authorName?.replace("/u/", "") || "[unknown]",
    createdAt: updated || "",
    permalink: link,
    postId,
  };
}

// ============================================================================
// Client Implementation
// ============================================================================

export interface RedditClientConfig {
  userAgent?: string;
  cacheTtlMs?: number;
  maxRetries?: number;
  retryDelayMs?: number;
  requestDelayMs?: number;
}

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

export class RedditClient implements IRedditClient {
  private readonly userAgent: string;
  private readonly cacheTtlMs: number;
  private readonly maxRetries: number;
  private readonly retryDelayMs: number;
  private readonly requestDelayMs: number;
  private readonly cache: Map<string, CacheEntry<unknown>> = new Map();

  constructor(config: RedditClientConfig = {}) {
    this.userAgent = config.userAgent || "PulseCheck/1.0 (educational project)";
    this.cacheTtlMs = config.cacheTtlMs ?? 5 * 60 * 1000; // 5 minutes default
    this.maxRetries = config.maxRetries ?? 2;
    this.retryDelayMs = config.retryDelayMs ?? 1000;
    this.requestDelayMs = config.requestDelayMs ?? 300;
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

  private async fetchWithRetry(url: string): Promise<string> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await fetch(url, {
          headers: {
            "User-Agent": this.userAgent,
            Accept: "application/rss+xml, application/xml, text/xml",
          },
        });

        if (response.status === 429) {
          if (attempt < this.maxRetries) {
            await this.sleep(this.retryDelayMs * Math.pow(2, attempt));
            continue;
          }
          throw new RedditApiError("Rate limited by Reddit", 429, true);
        }

        if (!response.ok) {
          throw new RedditApiError(
            `Reddit RSS error: ${response.status}`,
            response.status,
            response.status >= 500
          );
        }

        return await response.text();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (error instanceof RedditApiError && !error.retryable) throw error;
        if (attempt < this.maxRetries) {
          await this.sleep(this.retryDelayMs * Math.pow(2, attempt));
        }
      }
    }

    throw lastError || new RedditApiError("Failed to fetch from Reddit");
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async searchPosts(query: string, options: SearchOptions = {}): Promise<RedditSearchResult> {
    const { subreddit, limit = 25, sort = "relevance", time = "year" } = options;

    const cacheKey = `search:${query}:${subreddit || ""}:${limit}:${sort}:${time}`;
    const cached = this.getCached<RedditSearchResult>(cacheKey);
    if (cached) return cached;

    const encodedQuery = encodeURIComponent(query);
    const url = subreddit
      ? `https://www.reddit.com/r/${subreddit}/search.rss?q=${encodedQuery}&restrict_sr=1&limit=${limit}&sort=${sort}&t=${time}`
      : `https://www.reddit.com/search.rss?q=${encodedQuery}&limit=${limit}&sort=${sort}&t=${time}`;

    const xml = await this.fetchWithRetry(url);
    const entries = extractAllEntries(xml);
    const posts = entries.map((e) => parsePost(e)).filter((p): p is RedditPost => p !== null);

    const result = { posts, query };
    this.setCache(cacheKey, result);
    return result;
  }

  async fetchComments(permalink: string, options: { limit?: number } = {}): Promise<RedditComment[]> {
    const { limit = 50 } = options;

    let path = permalink;
    if (path.startsWith("http")) {
      path = new URL(permalink).pathname;
    }
    path = path.replace(/\/$/, "");

    const cacheKey = `comments:${path}:${limit}`;
    const cached = this.getCached<RedditComment[]>(cacheKey);
    if (cached) return cached;

    const url = `https://www.reddit.com${path}.rss?limit=${limit}`;
    const xml = await this.fetchWithRetry(url);
    const entries = extractAllEntries(xml);
    const postId = extractIdFromLink(path);

    const comments = entries
      .slice(1)
      .map((e) => parseComment(e, postId))
      .filter((c): c is RedditComment => c !== null);

    this.setCache(cacheKey, comments);
    return comments;
  }

  async searchWithComments(
    query: string,
    options: { subreddit?: string; postLimit?: number; commentsPerPost?: number } = {}
  ): Promise<RedditPostWithComments[]> {
    const { postLimit = 10, commentsPerPost = 30, subreddit } = options;

    const searchResult = await this.searchPosts(query, { subreddit, limit: postLimit });
    const results: RedditPostWithComments[] = [];

    for (const post of searchResult.posts) {
      try {
        const comments = await this.fetchComments(post.permalink, { limit: commentsPerPost });
        results.push({ post, comments });
        await this.sleep(this.requestDelayMs);
      } catch (error) {
        console.warn(`Failed to fetch comments for post ${post.id}:`, error);
        results.push({ post, comments: [] });
      }
    }

    return results;
  }

  clearCache(): void {
    this.cache.clear();
  }
}

// ============================================================================
// Default Instance (for backward compatibility)
// ============================================================================

const defaultClient = new RedditClient();

export const searchPosts = defaultClient.searchPosts.bind(defaultClient);
export const fetchComments = defaultClient.fetchComments.bind(defaultClient);
export const searchWithComments = defaultClient.searchWithComments.bind(defaultClient);

export function createRedditClient(config?: RedditClientConfig): IRedditClient {
  return new RedditClient(config);
}
