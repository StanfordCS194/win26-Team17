/**
 * Reddit RSS Feed Client
 *
 * Uses Reddit's public RSS feeds (no auth required) to fetch posts and comments.
 * Appends .rss to Reddit URLs to get Atom XML feeds.
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
// XML Parsing Helpers (lightweight, no dependencies)
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
  // Decode numeric entities first, then named entities (&amp; last to avoid double-decoding)
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
  // Decode HTML entities first
  const decoded = decodeHtmlEntities(html);
  // Remove HTML tags
  return decoded
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractIdFromLink(link: string): string {
  // Extract post ID from Reddit URL like /r/Notion/comments/1qhj2cs/...
  const match = link.match(/comments\/([a-z0-9]+)/i);
  return match ? match[1] : link;
}

// ============================================================================
// Core Fetch Function
// ============================================================================

const USER_AGENT = "PulseCheck/1.0 (educational project; sentiment analysis)";

async function fetchRss(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/rss+xml, application/xml, text/xml",
    },
  });

  if (response.status === 429) {
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
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Search Reddit for posts matching a query
 */
export async function searchPosts(
  query: string,
  options: {
    subreddit?: string;
    limit?: number;
    sort?: "relevance" | "hot" | "top" | "new";
    time?: "hour" | "day" | "week" | "month" | "year" | "all";
  } = {}
): Promise<RedditSearchResult> {
  const { subreddit, limit = 25, sort = "relevance", time = "year" } = options;

  const encodedQuery = encodeURIComponent(query);
  let url: string;

  if (subreddit) {
    url = `https://www.reddit.com/r/${subreddit}/search.rss?q=${encodedQuery}&restrict_sr=1&limit=${limit}&sort=${sort}&t=${time}`;
  } else {
    url = `https://www.reddit.com/search.rss?q=${encodedQuery}&limit=${limit}&sort=${sort}&t=${time}`;
  }

  const xml = await fetchRss(url);
  const entries = extractAllEntries(xml);

  const posts: RedditPost[] = entries
    .map((entry) => {
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
        subreddit: category?.replace("r/", "") || "",
        createdAt: updated || "",
        permalink: link,
      };
    })
    .filter((post): post is RedditPost => post !== null);

  return { posts, query };
}

/**
 * Fetch comments for a specific post
 */
export async function fetchComments(
  permalink: string,
  options: { limit?: number } = {}
): Promise<RedditComment[]> {
  const { limit = 50 } = options;

  // Clean permalink and build RSS URL
  let path = permalink;
  if (path.startsWith("http")) {
    path = new URL(permalink).pathname;
  }
  // Remove trailing slash if present
  path = path.replace(/\/$/, "");

  const url = `https://www.reddit.com${path}.rss?limit=${limit}`;
  const xml = await fetchRss(url);
  const entries = extractAllEntries(xml);

  // Extract post ID from permalink
  const postId = extractIdFromLink(path);

  // First entry is the post itself, rest are comments
  const comments: RedditComment[] = entries
    .slice(1) // Skip the first entry (the post)
    .map((entry) => {
      const content = extractTagContent(entry, "content");
      const authorName = extractTagContent(entry, "name");
      const link = extractAttribute(entry, "link", "href");
      const updated = extractTagContent(entry, "updated") || extractTagContent(entry, "published");
      const id = extractTagContent(entry, "id");

      if (!content || !link) return null;

      const cleanContent = stripHtml(content);
      // Skip deleted/removed comments
      if (
        cleanContent === "[deleted]" ||
        cleanContent === "[removed]" ||
        cleanContent.length < 10
      ) {
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
    })
    .filter((comment): comment is RedditComment => comment !== null);

  return comments;
}

/**
 * Search for posts and fetch their comments
 * This is the main function for gathering product feedback
 */
export async function searchWithComments(
  query: string,
  options: {
    subreddit?: string;
    postLimit?: number;
    commentsPerPost?: number;
  } = {}
): Promise<RedditPostWithComments[]> {
  const { postLimit = 10, commentsPerPost = 30, ...searchOptions } = options;

  // Search for posts
  const searchResult = await searchPosts(query, { ...searchOptions, limit: postLimit });

  // Fetch comments for each post
  const results: RedditPostWithComments[] = [];

  for (const post of searchResult.posts) {
    try {
      const comments = await fetchComments(post.permalink, { limit: commentsPerPost });
      results.push({ post, comments });

      // Small delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 300));
    } catch (error) {
      console.warn(`Failed to fetch comments for post ${post.id}:`, error);
      results.push({ post, comments: [] });
    }
  }

  return results;
}

/**
 * Fetch hot/new/top posts from a subreddit
 */
export async function fetchSubredditPosts(
  subreddit: string,
  options: {
    sort?: "hot" | "new" | "top";
    limit?: number;
  } = {}
): Promise<RedditPost[]> {
  const { sort = "hot", limit = 25 } = options;

  const url = `https://www.reddit.com/r/${subreddit}/${sort}.rss?limit=${limit}`;
  const xml = await fetchRss(url);
  const entries = extractAllEntries(xml);

  return entries
    .map((entry) => {
      const title = extractTagContent(entry, "title");
      const content = extractTagContent(entry, "content");
      const authorName = extractTagContent(entry, "name");
      const link = extractAttribute(entry, "link", "href");
      const updated = extractTagContent(entry, "updated") || extractTagContent(entry, "published");

      if (!title || !link) return null;

      return {
        id: extractIdFromLink(link),
        title: decodeHtmlEntities(title),
        content: content ? stripHtml(content) : "",
        author: authorName?.replace("/u/", "") || "[unknown]",
        subreddit,
        createdAt: updated || "",
        permalink: link,
      };
    })
    .filter((post): post is RedditPost => post !== null);
}
