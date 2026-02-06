// Doc: Natural_Language_Code/pipeline/info_pipeline.md

/**
 * Reddit OAuth API fetching.
 * Uses app-only (client_credentials) OAuth flow for reliable server-side access.
 * Requires REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET env vars.
 */

interface RedditPost {
  id: string;
  title: string;
  selftext: string;
  author: string;
  score: number;
  created_utc: number;
  permalink: string;
  num_comments: number;
  subreddit: string;
}

interface RedditComment {
  id: string;
  body: string;
  author: string;
  score: number;
  created_utc: number;
  permalink: string;
}

export interface RedditContent {
  posts: RedditPost[];
  comments: RedditComment[];
}

const USER_AGENT = "PulseCheck:v1.0.0 (by /u/pulsecheck_bot)";
const OAUTH_TOKEN_URL = "https://www.reddit.com/api/v1/access_token";
const OAUTH_API_BASE = "https://oauth.reddit.com";
const RATE_LIMIT_MS = 1100;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getAppOnlyToken(clientId: string, clientSecret: string): Promise<string> {
  const auth = btoa(`${clientId}:${clientSecret}`);

  const res = await fetch(OAUTH_TOKEN_URL, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": USER_AGENT,
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Reddit OAuth failed: ${res.status} — ${body.slice(0, 300)}`);
  }

  const data = await res.json();
  if (!data.access_token) {
    throw new Error(`Reddit OAuth: no access_token in response`);
  }
  return data.access_token;
}

async function fetchJSON(url: string, token: string): Promise<any> {
  const res = await fetch(url, {
    headers: {
      "Authorization": `Bearer ${token}`,
      "User-Agent": USER_AGENT,
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Reddit API error: ${res.status} ${res.statusText} — ${body.slice(0, 300)}`);
  }
  return res.json();
}

function parsePost(data: any): RedditPost {
  const d = data.data;
  return {
    id: d.id,
    title: d.title ?? "",
    selftext: d.selftext ?? "",
    author: d.author ?? "[deleted]",
    score: d.score ?? 0,
    created_utc: d.created_utc ?? 0,
    permalink: d.permalink ?? "",
    num_comments: d.num_comments ?? 0,
    subreddit: d.subreddit ?? "",
  };
}

function parseComment(data: any): RedditComment | null {
  const d = data.data;
  if (!d || !d.body || d.author === "AutoModerator") return null;
  return {
    id: d.id,
    body: d.body,
    author: d.author ?? "[deleted]",
    score: d.score ?? 0,
    created_utc: d.created_utc ?? 0,
    permalink: d.permalink ?? "",
  };
}

async function searchReddit(query: string, token: string, limit: number = 10): Promise<RedditPost[]> {
  const url = `${OAUTH_API_BASE}/search?q=${encodeURIComponent(query)}&sort=relevance&t=all&limit=${limit}&raw_json=1&type=link`;
  const data = await fetchJSON(url, token);
  const children = data?.data?.children ?? [];
  return children.map(parsePost);
}

async function fetchPostComments(permalink: string, token: string, limit: number = 15): Promise<RedditComment[]> {
  // permalink from Reddit looks like /r/subreddit/comments/id/title/
  const url = `${OAUTH_API_BASE}${permalink}.json?sort=top&limit=${limit}&raw_json=1`;
  const data = await fetchJSON(url, token);

  const comments: RedditComment[] = [];
  const commentListing = data?.[1]?.data?.children ?? [];
  for (const child of commentListing) {
    if (child.kind !== "t1") continue;
    const parsed = parseComment(child);
    if (parsed) comments.push(parsed);
  }
  return comments;
}

export async function fetchRedditDiscussions(
  productName: string,
  brandName: string
): Promise<RedditContent> {
  const clientId = process.env.REDDIT_CLIENT_ID;
  const clientSecret = process.env.REDDIT_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      "Reddit credentials not configured. Run:\n" +
      "  npx convex env set REDDIT_CLIENT_ID <id>\n" +
      "  npx convex env set REDDIT_CLIENT_SECRET <secret>"
    );
  }

  // Get OAuth token
  const token = await getAppOnlyToken(clientId, clientSecret);

  const searchTerms = [
    `${brandName} ${productName} review`,
    `${brandName} ${productName} worth it`,
    `${brandName} ${productName} pros cons`,
  ];

  const allPosts: RedditPost[] = [];
  const allComments: RedditComment[] = [];
  const seenPostIds = new Set<string>();
  const seenCommentIds = new Set<string>();

  for (const term of searchTerms) {
    const posts = await searchReddit(term, token, 8);
    await sleep(RATE_LIMIT_MS);

    for (const post of posts) {
      if (seenPostIds.has(post.id)) continue;
      seenPostIds.add(post.id);
      allPosts.push(post);
    }
  }

  // Fetch comments from the top posts (by score), up to 5 posts
  const topPosts = [...allPosts]
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  for (const post of topPosts) {
    const comments = await fetchPostComments(post.permalink, token, 10);
    await sleep(RATE_LIMIT_MS);

    for (const comment of comments) {
      if (seenCommentIds.has(comment.id)) continue;
      seenCommentIds.add(comment.id);
      allComments.push(comment);
    }
  }

  return { posts: allPosts, comments: allComments };
}

export function filterAndPreprocess(content: RedditContent): RedditContent {
  const filteredPosts = content.posts
    .filter((p) => {
      if (!p.selftext && !p.title) return false;
      if (p.score < 0) return false;
      if (p.selftext === "[removed]" || p.selftext === "[deleted]") return false;
      return true;
    })
    .sort((a, b) => b.score - a.score);

  const filteredComments = content.comments
    .filter((c) => {
      if (!c.body || c.body === "[removed]" || c.body === "[deleted]") return false;
      if (c.body.length < 15) return false;
      if (c.score < 0) return false;
      return true;
    })
    .sort((a, b) => b.score - a.score);

  return { posts: filteredPosts, comments: filteredComments };
}
