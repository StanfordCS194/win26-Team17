import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("HackerNews Algolia Client", () => {
  describe("searchStories", () => {
    beforeEach(() => {
      vi.stubGlobal("fetch", vi.fn());
    });

    afterEach(() => {
      vi.unstubAllGlobals();
      vi.resetModules();
    });

    it("should parse JSON search results correctly", async () => {
      const mockResponse = {
        hits: [
          {
            objectID: "12345",
            title: "Notion vs Obsidian comparison",
            url: "https://example.com/article",
            author: "testuser",
            points: 42,
            num_comments: 15,
            created_at: "2024-01-15T10:00:00.000Z",
            story_text: null,
          },
        ],
      };

      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockResponse),
        })
      );

      const { createHackerNewsClient } = await import("../../convex/services/hackernews");
      const client = createHackerNewsClient({ cacheTtlMs: 0 });
      const result = await client.searchStories("Notion");

      expect(result.query).toBe("Notion");
      expect(result.stories).toHaveLength(1);
      expect(result.stories[0].title).toBe("Notion vs Obsidian comparison");
      expect(result.stories[0].author).toBe("testuser");
      expect(result.stories[0].points).toBe(42);
      expect(result.stories[0].id).toBe(12345);
    });

    it("should handle empty search results", async () => {
      const mockResponse = { hits: [] };

      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockResponse),
        })
      );

      const { createHackerNewsClient } = await import("../../convex/services/hackernews");
      const client = createHackerNewsClient({ cacheTtlMs: 0 });
      const result = await client.searchStories("nonexistent_product_xyz");

      expect(result.stories).toHaveLength(0);
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

    it("should parse comments from API response", async () => {
      const mockResponse = {
        hits: [
          {
            objectID: "99001",
            comment_text: "I've been using Notion for a year and it's fantastic for team collaboration.",
            author: "commenter1",
            created_at: "2024-01-15T11:00:00.000Z",
            story_id: 12345,
          },
        ],
      };

      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockResponse),
        })
      );

      const { createHackerNewsClient } = await import("../../convex/services/hackernews");
      const client = createHackerNewsClient({ cacheTtlMs: 0 });
      const comments = await client.fetchComments(12345);

      expect(comments).toHaveLength(1);
      expect(comments[0].author).toBe("commenter1");
      expect(comments[0].text).toContain("fantastic for team collaboration");
      expect(comments[0].storyId).toBe(12345);
    });

    it("should filter out short comments", async () => {
      const mockResponse = {
        hits: [
          {
            objectID: "99001",
            comment_text: "This is a long enough comment to pass the filter for testing purposes.",
            author: "valid",
            created_at: "2024-01-15T11:00:00.000Z",
            story_id: 12345,
          },
          {
            objectID: "99002",
            comment_text: "Short",
            author: "short_commenter",
            created_at: "2024-01-15T12:00:00.000Z",
            story_id: 12345,
          },
        ],
      };

      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockResponse),
        })
      );

      const { createHackerNewsClient } = await import("../../convex/services/hackernews");
      const client = createHackerNewsClient({ cacheTtlMs: 0 });
      const comments = await client.fetchComments(12345);

      expect(comments).toHaveLength(1);
      expect(comments[0].author).toBe("valid");
    });

    it("should strip HTML tags from comments", async () => {
      const mockResponse = {
        hits: [
          {
            objectID: "99001",
            comment_text: "<p>This is a <b>bold</b> comment with <a href='#'>links</a> and HTML tags.</p>",
            author: "htmluser",
            created_at: "2024-01-15T11:00:00.000Z",
            story_id: 12345,
          },
        ],
      };

      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockResponse),
        })
      );

      const { createHackerNewsClient } = await import("../../convex/services/hackernews");
      const client = createHackerNewsClient({ cacheTtlMs: 0 });
      const comments = await client.fetchComments(12345);

      expect(comments).toHaveLength(1);
      expect(comments[0].text).not.toContain("<p>");
      expect(comments[0].text).not.toContain("<b>");
      expect(comments[0].text).toContain("bold");
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
      const mockResponse = {
        hits: [
          {
            objectID: "12345",
            title: "Test Story",
            author: "user",
            points: 10,
            num_comments: 5,
            created_at: "2024-01-15T10:00:00.000Z",
          },
        ],
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse),
      });
      vi.stubGlobal("fetch", mockFetch);

      const { createHackerNewsClient } = await import("../../convex/services/hackernews");
      const client = createHackerNewsClient({ cacheTtlMs: 60000 });

      await client.searchStories("test");
      await client.searchStories("test");

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("should not use expired cache", async () => {
      const mockResponse = {
        hits: [
          {
            objectID: "12345",
            title: "Test Story",
            author: "user",
            points: 10,
            num_comments: 5,
            created_at: "2024-01-15T10:00:00.000Z",
          },
        ],
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse),
      });
      vi.stubGlobal("fetch", mockFetch);

      const { createHackerNewsClient } = await import("../../convex/services/hackernews");
      const client = createHackerNewsClient({ cacheTtlMs: 1 });

      await client.searchStories("test");
      await new Promise((r) => setTimeout(r, 10));
      await client.searchStories("test");

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("should allow clearing cache", async () => {
      const mockResponse = {
        hits: [
          {
            objectID: "12345",
            title: "Test Story",
            author: "user",
            points: 10,
            num_comments: 5,
            created_at: "2024-01-15T10:00:00.000Z",
          },
        ],
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse),
      });
      vi.stubGlobal("fetch", mockFetch);

      const { HackerNewsClient } = await import("../../convex/services/hackernews");
      const client = new HackerNewsClient({ cacheTtlMs: 60000 });

      await client.searchStories("test");
      client.clearCache();
      await client.searchStories("test");

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
      const mockResponse = { hits: [] };

      let callCount = 0;
      const mockFetch = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({ ok: false, status: 429 });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockResponse),
        });
      });
      vi.stubGlobal("fetch", mockFetch);

      const { createHackerNewsClient } = await import("../../convex/services/hackernews");
      const client = createHackerNewsClient({ maxRetries: 2, retryDelayMs: 10, cacheTtlMs: 0 });
      await client.searchStories("test");

      expect(callCount).toBe(2);
    });

    it("should retry on server error (5xx)", async () => {
      const mockResponse = { hits: [] };

      let callCount = 0;
      const mockFetch = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({ ok: false, status: 503 });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockResponse),
        });
      });
      vi.stubGlobal("fetch", mockFetch);

      const { createHackerNewsClient } = await import("../../convex/services/hackernews");
      const client = createHackerNewsClient({ maxRetries: 2, retryDelayMs: 10, cacheTtlMs: 0 });
      await client.searchStories("test");

      expect(callCount).toBe(2);
    });

    it("should not retry on client error (4xx except 429)", async () => {
      const mockFetch = vi.fn().mockResolvedValue({ ok: false, status: 404 });
      vi.stubGlobal("fetch", mockFetch);

      const { createHackerNewsClient, HackerNewsApiError } = await import(
        "../../convex/services/hackernews"
      );
      const client = createHackerNewsClient({ maxRetries: 2, retryDelayMs: 10 });

      await expect(client.searchStories("test")).rejects.toThrow(HackerNewsApiError);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe("error class", () => {
    it("should expose statusCode and retryable properties", async () => {
      const { HackerNewsApiError } = await import("../../convex/services/hackernews");

      const err = new HackerNewsApiError("Rate limited", 429, true);
      expect(err.message).toBe("Rate limited");
      expect(err.statusCode).toBe(429);
      expect(err.retryable).toBe(true);
      expect(err.name).toBe("HackerNewsApiError");
      expect(err instanceof Error).toBe(true);
    });

    it("should default retryable to false", async () => {
      const { HackerNewsApiError } = await import("../../convex/services/hackernews");

      const err = new HackerNewsApiError("Not found", 404);
      expect(err.retryable).toBe(false);
    });
  });

  describe("interface contract", () => {
    it("should implement IHackerNewsClient interface", async () => {
      const { createHackerNewsClient, HackerNewsClient } = await import(
        "../../convex/services/hackernews"
      );

      const client = createHackerNewsClient();
      expect(typeof client.searchStories).toBe("function");
      expect(typeof client.fetchComments).toBe("function");
      expect(typeof client.searchWithComments).toBe("function");

      const classInstance = new HackerNewsClient();
      expect(typeof classInstance.searchStories).toBe("function");
      expect(typeof classInstance.fetchComments).toBe("function");
      expect(typeof classInstance.searchWithComments).toBe("function");
    });
  });
});
