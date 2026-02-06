import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Reddit RSS Client Tests
 */

describe("Reddit RSS Client", () => {
  describe("searchPosts", () => {
    beforeEach(() => {
      vi.stubGlobal("fetch", vi.fn());
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("should parse RSS search results correctly", async () => {
      const mockRss = `<?xml version="1.0" encoding="UTF-8"?>
        <feed xmlns="http://www.w3.org/2005/Atom">
          <title>reddit.com: search results</title>
          <entry>
            <author><name>/u/testuser</name></author>
            <category term="productivity" label="r/productivity"/>
            <content type="html">&lt;p&gt;This is a test post about Notion&lt;/p&gt;</content>
            <id>t3_abc123</id>
            <link href="https://www.reddit.com/r/productivity/comments/abc123/test_post/" />
            <updated>2024-01-15T10:00:00+00:00</updated>
            <title>Test Post Title</title>
          </entry>
          <entry>
            <author><name>/u/anotheruser</name></author>
            <category term="software" label="r/software"/>
            <content type="html">&lt;p&gt;Second post content&lt;/p&gt;</content>
            <id>t3_def456</id>
            <link href="https://www.reddit.com/r/software/comments/def456/second_post/" />
            <updated>2024-01-14T09:00:00+00:00</updated>
            <title>Second Post</title>
          </entry>
        </feed>`;

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve(mockRss),
      });
      vi.stubGlobal("fetch", mockFetch);

      const { searchPosts } = await import("../../convex/services/reddit");
      const result = await searchPosts("Notion");

      expect(result.query).toBe("Notion");
      expect(result.posts).toHaveLength(2);
      expect(result.posts[0].title).toBe("Test Post Title");
      expect(result.posts[0].author).toBe("testuser");
      expect(result.posts[0].subreddit).toBe("productivity");
      expect(result.posts[0].content).toContain("test post about Notion");
      expect(result.posts[1].title).toBe("Second Post");
    });

    it("should handle empty search results", async () => {
      const mockRss = `<?xml version="1.0" encoding="UTF-8"?>
        <feed xmlns="http://www.w3.org/2005/Atom">
          <title>reddit.com: search results</title>
        </feed>`;

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve(mockRss),
      });
      vi.stubGlobal("fetch", mockFetch);

      const { searchPosts } = await import("../../convex/services/reddit");
      const result = await searchPosts("nonexistentproduct123456");

      expect(result.posts).toHaveLength(0);
    });

    it("should throw RedditApiError on 429 rate limit", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
      });
      vi.stubGlobal("fetch", mockFetch);

      const { searchPosts, RedditApiError } = await import(
        "../../convex/services/reddit"
      );

      await expect(searchPosts("test")).rejects.toThrow(RedditApiError);
    });

    it("should decode HTML entities in content", async () => {
      // Note: In XML, & is encoded as &amp;, so "Test & Title" becomes "Test &amp; Title"
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

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve(mockRss),
      });
      vi.stubGlobal("fetch", mockFetch);

      const { searchPosts } = await import("../../convex/services/reddit");
      const result = await searchPosts("test");

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
    });

    it("should parse comments from RSS feed", async () => {
      const mockRss = `<?xml version="1.0" encoding="UTF-8"?>
        <feed xmlns="http://www.w3.org/2005/Atom">
          <title>Test Post : subreddit</title>
          <entry>
            <author><name>/u/poster</name></author>
            <content type="html">&lt;p&gt;Original post content&lt;/p&gt;</content>
            <id>t3_abc123</id>
            <link href="https://www.reddit.com/r/test/comments/abc123/test/" />
            <updated>2024-01-15T10:00:00+00:00</updated>
            <title>Test Post</title>
          </entry>
          <entry>
            <author><name>/u/commenter1</name></author>
            <content type="html">&lt;p&gt;This is a helpful comment with good feedback&lt;/p&gt;</content>
            <id>t1_comment1</id>
            <link href="https://www.reddit.com/r/test/comments/abc123/test/comment1/" />
            <updated>2024-01-15T11:00:00+00:00</updated>
            <title>Comment Title</title>
          </entry>
          <entry>
            <author><name>/u/commenter2</name></author>
            <content type="html">&lt;p&gt;Another insightful comment here&lt;/p&gt;</content>
            <id>t1_comment2</id>
            <link href="https://www.reddit.com/r/test/comments/abc123/test/comment2/" />
            <updated>2024-01-15T12:00:00+00:00</updated>
            <title>Comment 2</title>
          </entry>
        </feed>`;

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve(mockRss),
      });
      vi.stubGlobal("fetch", mockFetch);

      const { fetchComments } = await import("../../convex/services/reddit");
      const comments = await fetchComments("/r/test/comments/abc123/test/");

      // Should skip the first entry (the post) and return only comments
      expect(comments).toHaveLength(2);
      expect(comments[0].author).toBe("commenter1");
      expect(comments[0].content).toContain("helpful comment");
      expect(comments[1].author).toBe("commenter2");
    });

    it("should filter out deleted and short comments", async () => {
      const mockRss = `<?xml version="1.0" encoding="UTF-8"?>
        <feed xmlns="http://www.w3.org/2005/Atom">
          <entry>
            <author><name>/u/poster</name></author>
            <content type="html">&lt;p&gt;Post&lt;/p&gt;</content>
            <id>t3_abc</id>
            <link href="https://www.reddit.com/r/test/comments/abc/test/" />
            <updated>2024-01-15T10:00:00+00:00</updated>
            <title>Post</title>
          </entry>
          <entry>
            <author><name>/u/valid</name></author>
            <content type="html">&lt;p&gt;This is a valid comment with enough content&lt;/p&gt;</content>
            <id>t1_c1</id>
            <link href="https://www.reddit.com/r/test/comments/abc/test/c1/" />
            <updated>2024-01-15T11:00:00+00:00</updated>
            <title>C1</title>
          </entry>
          <entry>
            <author><name>/u/deleted</name></author>
            <content type="html">[deleted]</content>
            <id>t1_c2</id>
            <link href="https://www.reddit.com/r/test/comments/abc/test/c2/" />
            <updated>2024-01-15T12:00:00+00:00</updated>
            <title>C2</title>
          </entry>
          <entry>
            <author><name>/u/short</name></author>
            <content type="html">ok</content>
            <id>t1_c3</id>
            <link href="https://www.reddit.com/r/test/comments/abc/test/c3/" />
            <updated>2024-01-15T13:00:00+00:00</updated>
            <title>C3</title>
          </entry>
        </feed>`;

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve(mockRss),
      });
      vi.stubGlobal("fetch", mockFetch);

      const { fetchComments } = await import("../../convex/services/reddit");
      const comments = await fetchComments("/r/test/comments/abc/test/");

      expect(comments).toHaveLength(1);
      expect(comments[0].author).toBe("valid");
    });
  });

  // Integration tests - run manually
  describe.skip("Integration Tests (hit real Reddit RSS)", () => {
    it("should search for real posts about Notion", async () => {
      const { searchPosts } = await import("../../convex/services/reddit");
      const result = await searchPosts("Notion app", { limit: 5 });

      console.log(`Found ${result.posts.length} posts for "Notion app"`);
      result.posts.forEach((post) => {
        console.log(`- [${post.subreddit}] ${post.title}`);
        console.log(`  Author: ${post.author}, Date: ${post.createdAt}`);
      });

      expect(result.posts.length).toBeGreaterThan(0);
    }, 10000);

    it("should fetch comments for a post", async () => {
      const { searchPosts, fetchComments } = await import(
        "../../convex/services/reddit"
      );

      const searchResult = await searchPosts("Notion", { limit: 1 });
      expect(searchResult.posts.length).toBeGreaterThan(0);

      const post = searchResult.posts[0];
      console.log(`Fetching comments for: ${post.title}`);

      const comments = await fetchComments(post.permalink, { limit: 10 });

      console.log(`Found ${comments.length} comments`);
      comments.slice(0, 3).forEach((c) => {
        console.log(`- ${c.author}: ${c.content.slice(0, 80)}...`);
      });

      expect(comments.length).toBeGreaterThanOrEqual(0);
    }, 15000);
  });
});
