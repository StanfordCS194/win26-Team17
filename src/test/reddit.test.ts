import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("Reddit RSS Client", () => {
  describe("searchPosts", () => {
    beforeEach(() => {
      vi.stubGlobal("fetch", vi.fn());
    });

    afterEach(() => {
      vi.unstubAllGlobals();
      vi.resetModules();
    });

    it("should parse RSS search results correctly", async () => {
      const mockRss = `<?xml version="1.0" encoding="UTF-8"?>
        <feed xmlns="http://www.w3.org/2005/Atom">
          <entry>
            <author><name>/u/testuser</name></author>
            <category term="productivity" label="r/productivity"/>
            <content type="html">&lt;p&gt;This is a test post about Notion&lt;/p&gt;</content>
            <id>t3_abc123</id>
            <link href="https://www.reddit.com/r/productivity/comments/abc123/test_post/" />
            <updated>2024-01-15T10:00:00+00:00</updated>
            <title>Test Post Title</title>
          </entry>
        </feed>`;

      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          text: () => Promise.resolve(mockRss),
        })
      );

      const { createRedditClient } = await import("../../convex/services/reddit");
      const client = createRedditClient({ cacheTtlMs: 0 });
      const result = await client.searchPosts("Notion");

      expect(result.query).toBe("Notion");
      expect(result.posts).toHaveLength(1);
      expect(result.posts[0].title).toBe("Test Post Title");
      expect(result.posts[0].author).toBe("testuser");
      expect(result.posts[0].subreddit).toBe("productivity");
    });

    it("should handle empty search results", async () => {
      const mockRss = `<?xml version="1.0" encoding="UTF-8"?>
        <feed xmlns="http://www.w3.org/2005/Atom"></feed>`;

      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          text: () => Promise.resolve(mockRss),
        })
      );

      const { createRedditClient } = await import("../../convex/services/reddit");
      const client = createRedditClient({ cacheTtlMs: 0 });
      const result = await client.searchPosts("nonexistent");

      expect(result.posts).toHaveLength(0);
    });

    it("should throw RedditApiError on 429 rate limit", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({ ok: false, status: 429 })
      );

      const { createRedditClient, RedditApiError } = await import(
        "../../convex/services/reddit"
      );
      const client = createRedditClient({ maxRetries: 0 });

      await expect(client.searchPosts("test")).rejects.toThrow(RedditApiError);
    });

    it("should decode HTML entities", async () => {
      const mockRss = `<?xml version="1.0" encoding="UTF-8"?>
        <feed xmlns="http://www.w3.org/2005/Atom">
          <entry>
            <author><name>/u/user</name></author>
            <category term="test" label="r/test"/>
            <content type="html">&lt;p&gt;It&#39;s a &quot;great&quot; product &amp; I love it&lt;/p&gt;</content>
            <id>t3_xyz</id>
            <link href="https://www.reddit.com/r/test/comments/xyz/test/" />
            <updated>2024-01-15T10:00:00+00:00</updated>
            <title>Test &amp; Title</title>
          </entry>
        </feed>`;

      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          text: () => Promise.resolve(mockRss),
        })
      );

      const { createRedditClient } = await import("../../convex/services/reddit");
      const client = createRedditClient({ cacheTtlMs: 0 });
      const result = await client.searchPosts("test");

      expect(result.posts[0].title).toBe("Test & Title");
      expect(result.posts[0].content).toContain("It's a \"great\" product & I love it");
    });
  });

  describe("fetchComments", () => {
    beforeEach(() => {
      vi.stubGlobal("fetch", vi.fn());
    });

    afterEach(() => {
      vi.unstubAllGlobals();
      vi.resetModules();
    });

    it("should parse comments from RSS feed", async () => {
      const mockRss = `<?xml version="1.0" encoding="UTF-8"?>
        <feed xmlns="http://www.w3.org/2005/Atom">
          <entry>
            <author><name>/u/poster</name></author>
            <content type="html">&lt;p&gt;Original post&lt;/p&gt;</content>
            <id>t3_abc123</id>
            <link href="https://www.reddit.com/r/test/comments/abc123/test/" />
            <updated>2024-01-15T10:00:00+00:00</updated>
            <title>Test Post</title>
          </entry>
          <entry>
            <author><name>/u/commenter1</name></author>
            <content type="html">&lt;p&gt;This is a helpful comment&lt;/p&gt;</content>
            <id>t1_comment1</id>
            <link href="https://www.reddit.com/r/test/comments/abc123/test/comment1/" />
            <updated>2024-01-15T11:00:00+00:00</updated>
          </entry>
        </feed>`;

      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          text: () => Promise.resolve(mockRss),
        })
      );

      const { createRedditClient } = await import("../../convex/services/reddit");
      const client = createRedditClient({ cacheTtlMs: 0 });
      const comments = await client.fetchComments("/r/test/comments/abc123/test/");

      expect(comments).toHaveLength(1);
      expect(comments[0].author).toBe("commenter1");
      expect(comments[0].content).toContain("helpful comment");
    });

    it("should filter out deleted comments", async () => {
      const mockRss = `<?xml version="1.0" encoding="UTF-8"?>
        <feed xmlns="http://www.w3.org/2005/Atom">
          <entry>
            <author><name>/u/poster</name></author>
            <content type="html">Post</content>
            <id>t3_abc</id>
            <link href="https://www.reddit.com/r/test/comments/abc/test/" />
            <updated>2024-01-15T10:00:00+00:00</updated>
          </entry>
          <entry>
            <author><name>/u/valid</name></author>
            <content type="html">This is valid content here</content>
            <id>t1_c1</id>
            <link href="https://www.reddit.com/r/test/comments/abc/test/c1/" />
            <updated>2024-01-15T11:00:00+00:00</updated>
          </entry>
          <entry>
            <author><name>/u/deleted</name></author>
            <content type="html">[deleted]</content>
            <id>t1_c2</id>
            <link href="https://www.reddit.com/r/test/comments/abc/test/c2/" />
            <updated>2024-01-15T12:00:00+00:00</updated>
          </entry>
        </feed>`;

      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          text: () => Promise.resolve(mockRss),
        })
      );

      const { createRedditClient } = await import("../../convex/services/reddit");
      const client = createRedditClient({ cacheTtlMs: 0 });
      const comments = await client.fetchComments("/r/test/comments/abc/test/");

      expect(comments).toHaveLength(1);
      expect(comments[0].author).toBe("valid");
    });
  });

  describe("caching", () => {
    beforeEach(() => {
      vi.stubGlobal("fetch", vi.fn());
    });

    afterEach(() => {
      vi.unstubAllGlobals();
      vi.resetModules();
    });

    it("should cache search results", async () => {
      const mockRss = `<?xml version="1.0" encoding="UTF-8"?>
        <feed xmlns="http://www.w3.org/2005/Atom">
          <entry>
            <author><name>/u/user</name></author>
            <category label="r/test"/>
            <content type="html">Content</content>
            <id>t3_123</id>
            <link href="https://www.reddit.com/r/test/comments/123/post/" />
            <updated>2024-01-15T10:00:00+00:00</updated>
            <title>Test</title>
          </entry>
        </feed>`;

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve(mockRss),
      });
      vi.stubGlobal("fetch", mockFetch);

      const { createRedditClient } = await import("../../convex/services/reddit");
      const client = createRedditClient({ cacheTtlMs: 60000 });

      await client.searchPosts("test");
      await client.searchPosts("test");

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("should not use expired cache", async () => {
      const mockRss = `<?xml version="1.0" encoding="UTF-8"?>
        <feed xmlns="http://www.w3.org/2005/Atom">
          <entry>
            <author><name>/u/user</name></author>
            <category label="r/test"/>
            <content type="html">Content</content>
            <id>t3_123</id>
            <link href="https://www.reddit.com/r/test/comments/123/post/" />
            <updated>2024-01-15T10:00:00+00:00</updated>
            <title>Test</title>
          </entry>
        </feed>`;

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve(mockRss),
      });
      vi.stubGlobal("fetch", mockFetch);

      const { createRedditClient } = await import("../../convex/services/reddit");
      const client = createRedditClient({ cacheTtlMs: 1 }); // 1ms TTL

      await client.searchPosts("test");
      await new Promise((r) => setTimeout(r, 10)); // Wait for cache to expire
      await client.searchPosts("test");

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("should allow clearing cache", async () => {
      const mockRss = `<?xml version="1.0" encoding="UTF-8"?>
        <feed xmlns="http://www.w3.org/2005/Atom">
          <entry>
            <author><name>/u/user</name></author>
            <category label="r/test"/>
            <content type="html">Content</content>
            <id>t3_123</id>
            <link href="https://www.reddit.com/r/test/comments/123/post/" />
            <updated>2024-01-15T10:00:00+00:00</updated>
            <title>Test</title>
          </entry>
        </feed>`;

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve(mockRss),
      });
      vi.stubGlobal("fetch", mockFetch);

      const { RedditClient } = await import("../../convex/services/reddit");
      const client = new RedditClient({ cacheTtlMs: 60000 });

      await client.searchPosts("test");
      client.clearCache();
      await client.searchPosts("test");

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe("retry logic", () => {
    beforeEach(() => {
      vi.stubGlobal("fetch", vi.fn());
    });

    afterEach(() => {
      vi.unstubAllGlobals();
      vi.resetModules();
    });

    it("should retry on rate limit (429)", async () => {
      const mockRss = `<?xml version="1.0" encoding="UTF-8"?>
        <feed xmlns="http://www.w3.org/2005/Atom"></feed>`;

      let callCount = 0;
      const mockFetch = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({ ok: false, status: 429 });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          text: () => Promise.resolve(mockRss),
        });
      });
      vi.stubGlobal("fetch", mockFetch);

      const { createRedditClient } = await import("../../convex/services/reddit");
      const client = createRedditClient({ maxRetries: 2, retryDelayMs: 10, cacheTtlMs: 0 });
      await client.searchPosts("test");

      expect(callCount).toBe(2);
    });

    it("should retry on server error (5xx)", async () => {
      const mockRss = `<?xml version="1.0" encoding="UTF-8"?>
        <feed xmlns="http://www.w3.org/2005/Atom"></feed>`;

      let callCount = 0;
      const mockFetch = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({ ok: false, status: 503 });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          text: () => Promise.resolve(mockRss),
        });
      });
      vi.stubGlobal("fetch", mockFetch);

      const { createRedditClient } = await import("../../convex/services/reddit");
      const client = createRedditClient({ maxRetries: 2, retryDelayMs: 10, cacheTtlMs: 0 });
      await client.searchPosts("test");

      expect(callCount).toBe(2);
    });

    it("should not retry on client error (4xx except 429)", async () => {
      const mockFetch = vi.fn().mockResolvedValue({ ok: false, status: 404 });
      vi.stubGlobal("fetch", mockFetch);

      const { createRedditClient, RedditApiError } = await import(
        "../../convex/services/reddit"
      );
      const client = createRedditClient({ maxRetries: 2, retryDelayMs: 10 });

      await expect(client.searchPosts("test")).rejects.toThrow(RedditApiError);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe("interface contract", () => {
    it("should implement IRedditClient interface", async () => {
      const { createRedditClient, RedditClient } = await import(
        "../../convex/services/reddit"
      );

      const client = createRedditClient();
      expect(typeof client.searchPosts).toBe("function");
      expect(typeof client.fetchComments).toBe("function");
      expect(typeof client.searchWithComments).toBe("function");

      const classInstance = new RedditClient();
      expect(typeof classInstance.searchPosts).toBe("function");
      expect(typeof classInstance.fetchComments).toBe("function");
      expect(typeof classInstance.searchWithComments).toBe("function");
    });
  });

  // Integration tests - run manually with: npm test -- --run reddit.test.ts
  describe.skip("Integration Tests (hit real Reddit RSS)", () => {
    it("should search for real posts", async () => {
      const { createRedditClient } = await import("../../convex/services/reddit");
      const client = createRedditClient();
      const result = await client.searchPosts("Notion app", { limit: 3 });

      console.log(`Found ${result.posts.length} posts`);
      result.posts.forEach((p) => console.log(`- [${p.subreddit}] ${p.title}`));

      expect(result.posts.length).toBeGreaterThan(0);
    }, 10000);

    it("should fetch comments", async () => {
      const { createRedditClient } = await import("../../convex/services/reddit");
      const client = createRedditClient();

      const search = await client.searchPosts("Notion", { limit: 1 });
      const comments = await client.fetchComments(search.posts[0].permalink, { limit: 5 });

      console.log(`Found ${comments.length} comments`);
      comments.forEach((c) => console.log(`- ${c.author}: ${c.content.slice(0, 50)}...`));

      expect(comments.length).toBeGreaterThanOrEqual(0);
    }, 15000);
  });
});
