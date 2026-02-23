/**
 * Reddit RSS Feed Client
 *
 * Uses Reddit's public RSS feeds (no auth required) to fetch posts and comments.
 */

import { isLikelySoftwareContent } from "./contentFilter";

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

    // Fetch comments in parallel batches of 3 to balance speed vs rate limiting
    const batchSize = 3;
    const results: RedditPostWithComments[] = [];

    for (let i = 0; i < searchResult.posts.length; i += batchSize) {
      const batch = searchResult.posts.slice(i, i + batchSize);
      const batchResults = await Promise.allSettled(
        batch.map(post =>
          this.fetchComments(post.permalink, { limit: commentsPerPost })
            .then(comments => ({ post, comments }))
        )
      );

      for (let j = 0; j < batchResults.length; j++) {
        const result = batchResults[j];
        if (result.status === "fulfilled") {
          results.push(result.value);
        } else {
          console.warn(`Failed to fetch comments for post ${batch[j].id}:`, result.reason);
          results.push({ post: batch[j], comments: [] });
        }
      }

      if (i + batchSize < searchResult.posts.length) {
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

// Subreddits where software product discussions happen
const SOFTWARE_SUBREDDITS = [
  "software",
  "SaaS",
  "productivity",
  "selfhosted",
  "webdev",
  "programming",
  "startups",
  "Entrepreneur",
  "smallbusiness",
  "technology",
  "techsupport",
  "apps",
  "Android",
  "iphone",
  "mac",
  "windows",
];

// Map well-known products to their dedicated subreddits
const PRODUCT_SUBREDDITS: Record<string, string[]> = {
  notion: ["Notion", "NotionSo"],
  slack: ["Slack"],
  figma: ["FigmaDesign", "figma"],
  discord: ["discordapp"],
  linear: ["linear"],
  obsidian: ["ObsidianMD"],
  todoist: ["todoist"],
  clickup: ["clickup"],
  asana: ["asana"],
  trello: ["trello"],
  airtable: ["Airtable"],
  monday: ["mondaydotcom"],
  jira: ["jira"],
  github: ["github"],
  vscode: ["vscode"],
  bitcoin: ["Bitcoin", "CryptoCurrency", "BitcoinBeginners"],
  ethereum: ["ethereum", "CryptoCurrency"],
  chatgpt: ["ChatGPT", "OpenAI"],
  cursor: ["cursor"],
  stripe: ["stripe"],
  shopify: ["shopify"],
  zoom: ["Zoom"],
  teams: ["MicrosoftTeams"],
  spotify: ["spotify"],
  netflix: ["netflix"],
};

function getProductSubreddits(productName: string): string[] {
  const key = productName.toLowerCase().trim();
  const exact = PRODUCT_SUBREDDITS[key];
  if (exact) return exact;
  for (const [k, v] of Object.entries(PRODUCT_SUBREDDITS)) {
    if (key.includes(k) || k.includes(key)) return v;
  }
  return [];
}

// Keywords that indicate software/product discussion
const SOFTWARE_KEYWORDS = [
  "app", "software", "tool", "platform", "service", "product",
  "feature", "pricing", "subscription", "free tier", "alternative",
  "review", "compared", "vs", "switched", "migrated", "using",
  "workflow", "integration", "api", "plugin", "extension",
  "saas", "cloud", "web", "mobile", "desktop", "browser",
  "ux", "ui", "design", "dashboard", "login", "account",
];

// Fuzzy match: check if text contains product name with common variations
function fuzzyMatchProduct(text: string, productName: string): boolean {
  const lower = text.toLowerCase();
  const productLower = productName.toLowerCase();
  const productWords = productLower.split(/\s+/);

  // Exact match
  if (lower.includes(productLower)) return true;

  // Match individual words for multi-word product names
  if (productWords.length > 1) {
    const allWordsMatch = productWords.every(word => lower.includes(word));
    if (allWordsMatch) return true;
  }

  // Common variations: possessive, plural, hyphenated
  const variations = [
    productLower + "'s",      // Notion's
    productLower + "s",       // Notions (typo/plural)
    productLower + "'",       // Slack'
    productLower.replace(/\s+/g, "-"), // multi-word hyphenated
    productLower.replace(/\s+/g, ""),  // multi-word combined
  ];

  for (const variant of variations) {
    if (lower.includes(variant)) return true;
  }

  // Levenshtein-lite: allow 1 character difference for longer names (>4 chars)
  if (productLower.length > 4) {
    const words = lower.split(/\s+/);
    for (const word of words) {
      if (word.length >= productLower.length - 1 && word.length <= productLower.length + 1) {
        let diff = 0;
        const minLen = Math.min(word.length, productLower.length);
        for (let i = 0; i < minLen; i++) {
          if (word[i] !== productLower[i]) diff++;
        }
        diff += Math.abs(word.length - productLower.length);
        if (diff <= 1) return true;
      }
    }
  }

  return false;
}

// isLikelySoftwareContent is imported from ./contentFilter

// Generate search queries that target software discussions
function generateSoftwareQueries(productName: string): string[] {
  return [
    `${productName} review`,
    `${productName} software`,
    `${productName} app`,
    `${productName} vs`,
    `${productName} alternative`,
    `${productName} pricing`,
  ];
}

export interface SoftwareSearchOptions {
  postLimit?: number;
  commentsPerPost?: number;
  includeGenericSearch?: boolean;
}

// Check if a single mention (post or comment text) is relevant to the product
export function isMentionRelevant(text: string, productName: string): boolean {
  return fuzzyMatchProduct(text.toLowerCase(), productName);
}

// Search specifically for software product feedback
export async function searchSoftwareProduct(
  client: IRedditClient,
  productName: string,
  options: SoftwareSearchOptions = {}
): Promise<RedditPostWithComments[]> {
  const { postLimit = 25, commentsPerPost = 25, includeGenericSearch = true } = options;
  const allResults: RedditPostWithComments[] = [];
  const seenPostIds = new Set<string>();

  const addResults = (results: RedditPostWithComments[]) => {
    for (const result of results) {
      if (!seenPostIds.has(result.post.id)) {
        seenPostIds.add(result.post.id);
        allResults.push(result);
      }
    }
  };

  const queries = generateSoftwareQueries(productName);

  // 1. Search product-specific subreddits first (highest signal)
  const productSubs = getProductSubreddits(productName);
  for (const subreddit of productSubs) {
    if (allResults.length >= postLimit) break;
    try {
      const results = await client.searchWithComments(productName, {
        subreddit,
        postLimit: 10,
        commentsPerPost,
      });
      addResults(results);
    } catch (error) {
      console.warn(`Failed to search r/${subreddit}:`, error);
    }
  }

  // 2. Search software-focused subreddits (broader net)
  for (const subreddit of SOFTWARE_SUBREDDITS.slice(0, 6)) {
    if (allResults.length >= postLimit) break;
    try {
      const results = await client.searchWithComments(productName, {
        subreddit,
        postLimit: 5,
        commentsPerPost,
      });
      addResults(results);
    } catch (error) {
      console.warn(`Failed to search r/${subreddit}:`, error);
    }
  }

  // 3. Targeted queries across all of Reddit
  if (allResults.length < postLimit && includeGenericSearch) {
    for (const query of queries.slice(0, 4)) {
      if (allResults.length >= postLimit) break;
      try {
        const results = await client.searchWithComments(query, {
          postLimit: 10,
          commentsPerPost,
        });
        addResults(results);
      } catch (error) {
        console.warn(`Failed to search "${query}":`, error);
      }
    }
  }

  // 4. Filter posts: keep posts where at least the title/content mentions the product
  const filtered = allResults.filter(({ post }) => {
    return fuzzyMatchProduct((post.title + " " + post.content).toLowerCase(), productName);
  });

  // 5. Within each post, filter comments to only keep relevant ones
  const withFilteredComments = filtered.map(({ post, comments }) => ({
    post,
    comments: comments.filter((c) => isMentionRelevant(c.content, productName)),
  }));

  return withFilteredComments.slice(0, postLimit);
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
