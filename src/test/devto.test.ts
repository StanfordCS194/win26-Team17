import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("Dev.to Client", () => {
  describe("searchArticles", () => {
    beforeEach(() => {
      vi.stubGlobal("fetch", vi.fn());
    });

    afterEach(() => {
      vi.unstubAllGlobals();
      vi.resetModules();
    });

    it("should parse article search results correctly", async () => {
      const mockResponse = [
        {
          id: 12345,
          title: "Getting Started with Notion API",
          description: "A comprehensive guide to using Notion's API",
          body_markdown: "# Getting Started\n\nNotion's API allows you to build powerful integrations.",
          user: { name: "Test Author", username: "testauthor" },
          url: "https://dev.to/testauthor/getting-started-with-notion-api",
          published_at: "2024-01-15T10:00:00Z",
          positive_reactions_count: 42,
          comments_count: 5,
          tag_list: ["notion", "api", "javascript"],
        },
      ];

      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockResponse),
        })
      );

      const { createDevToClient } = await import("../../convex/services/devto");
      const client = createDevToClient({ cacheTtlMs: 0 });
      const result = await client.searchArticles("Notion");

      expect(result.query).toBe("Notion");
      expect(result.articles).toHaveLength(1);
      expect(result.articles[0].title).toBe("Getting Started with Notion API");
      expect(result.articles[0].author).toBe("Test Author");
      expect(result.articles[0].positiveReactions).toBe(42);
      expect(result.articles[0].id).toBe(12345);
      expect(result.articles[0].tags).toContain("notion");
    });

    it("should handle empty search results", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: () => Promise.resolve([]),
        })
      );

      const { createDevToClient } = await import("../../convex/services/devto");
      const client = createDevToClient({ cacheTtlMs: 0 });
      const result = await client.searchArticles("nonexistent_product_xyz");

      expect(result.articles).toHaveLength(0);
    });

    it("should handle tag_list as comma-separated string", async () => {
      const mockResponse = [
        {
          id: 11111,
          title: "Test Article",
          description: "Test",
          body_markdown: "Test body content",
          user: { name: "Author" },
          url: "https://dev.to/author/test",
          published_at: "2024-01-15T10:00:00Z",
          positive_reactions_count: 5,
          comments_count: 0,
          tag_list: "javascript, react, webdev",
        },
      ];

      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockResponse),
        })
      );

      const { createDevToClient } = await import("../../convex/services/devto");
      const client = createDevToClient({ cacheTtlMs: 0 });
      const result = await client.searchArticles("test");

      expect(result.articles[0].tags).toEqual(["javascript", "react", "webdev"]);
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

    it("should parse comments including nested children", async () => {
      const mockResponse = [
        {
          id_code: "1001",
          body_html: "<p>This is a great article about using Notion effectively in teams.</p>",
          user: { name: "commenter1", username: "c1" },
          created_at: "2024-01-15T11:00:00Z",
          children: [
            {
              id_code: "1002",
              body_html: "<p>I agree, Notion has been very useful for our team's project management needs.</p>",
              user: { name: "commenter2", username: "c2" },
              created_at: "2024-01-15T12:00:00Z",
              children: [],
            },
          ],
        },
      ];

      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockResponse),
        })
      );

      const { createDevToClient } = await import("../../convex/services/devto");
      const client = createDevToClient({ cacheTtlMs: 0 });
      const comments = await client.fetchComments(12345);

      expect(comments).toHaveLength(2);
      expect(comments[0].author).toBe("commenter1");
      expect(comments[0].body).toContain("great article");
      expect(comments[1].author).toBe("commenter2");
      expect(comments[1].body).toContain("project management");
    });

    it("should filter out short comments", async () => {
      const mockResponse = [
        {
          id_code: "1001",
          body_html: "<p>This is a sufficiently long comment that should pass the minimum length filter for testing.</p>",
          user: { name: "valid" },
          created_at: "2024-01-15T11:00:00Z",
          children: [],
        },
        {
          id_code: "1002",
          body_html: "<p>Thanks!</p>",
          user: { name: "short_commenter" },
          created_at: "2024-01-15T12:00:00Z",
          children: [],
        },
      ];

      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockResponse),
        })
      );

      const { createDevToClient } = await import("../../convex/services/devto");
      const client = createDevToClient({ cacheTtlMs: 0 });
      const comments = await client.fetchComments(12345);

      expect(comments).toHaveLength(1);
      expect(comments[0].author).toBe("valid");
    });

    it("should strip HTML tags from comments", async () => {
      const mockResponse = [
        {
          id_code: "1001",
          body_html: "<p>This is a <strong>bold</strong> comment with <a href='#'>links</a> and HTML tags that should be removed.</p>",
          user: { name: "htmluser" },
          created_at: "2024-01-15T11:00:00Z",
          children: [],
        },
      ];

      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockResponse),
        })
      );

      const { createDevToClient } = await import("../../convex/services/devto");
      const client = createDevToClient({ cacheTtlMs: 0 });
      const comments = await client.fetchComments(12345);

      expect(comments).toHaveLength(1);
      expect(comments[0].body).not.toContain("<p>");
      expect(comments[0].body).not.toContain("<strong>");
      expect(comments[0].body).toContain("bold");
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
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve([
          {
            id: 12345,
            title: "Test Article",
            description: "Test",
            body_markdown: "Test body",
            user: { name: "user" },
            url: "https://dev.to/user/test",
            published_at: "2024-01-15T10:00:00Z",
            positive_reactions_count: 5,
            comments_count: 0,
            tag_list: [],
          },
        ]),
      });
      vi.stubGlobal("fetch", mockFetch);

      const { createDevToClient } = await import("../../convex/services/devto");
      const client = createDevToClient({ cacheTtlMs: 60000 });

      await client.searchArticles("test");
      await client.searchArticles("test");

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("should not use expired cache", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve([
          {
            id: 12345,
            title: "Test Article",
            description: "Test",
            body_markdown: "Test body",
            user: { name: "user" },
            url: "https://dev.to/user/test",
            published_at: "2024-01-15T10:00:00Z",
            positive_reactions_count: 5,
            comments_count: 0,
            tag_list: [],
          },
        ]),
      });
      vi.stubGlobal("fetch", mockFetch);

      const { createDevToClient } = await import("../../convex/services/devto");
      const client = createDevToClient({ cacheTtlMs: 1 });

      await client.searchArticles("test");
      await new Promise((r) => setTimeout(r, 10));
      await client.searchArticles("test");

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("should allow clearing cache", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve([
          {
            id: 12345,
            title: "Test Article",
            description: "Test",
            body_markdown: "Test body",
            user: { name: "user" },
            url: "https://dev.to/user/test",
            published_at: "2024-01-15T10:00:00Z",
            positive_reactions_count: 5,
            comments_count: 0,
            tag_list: [],
          },
        ]),
      });
      vi.stubGlobal("fetch", mockFetch);

      const { DevToClient } = await import("../../convex/services/devto");
      const client = new DevToClient({ cacheTtlMs: 60000 });

      await client.searchArticles("test");
      client.clearCache();
      await client.searchArticles("test");

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
      let callCount = 0;
      const mockFetch = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({ ok: false, status: 429 });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve([]),
        });
      });
      vi.stubGlobal("fetch", mockFetch);

      const { createDevToClient } = await import("../../convex/services/devto");
      const client = createDevToClient({ maxRetries: 2, retryDelayMs: 10, cacheTtlMs: 0 });
      await client.searchArticles("test");

      expect(callCount).toBe(2);
    });

    it("should retry on server error (5xx)", async () => {
      let callCount = 0;
      const mockFetch = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({ ok: false, status: 503 });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve([]),
        });
      });
      vi.stubGlobal("fetch", mockFetch);

      const { createDevToClient } = await import("../../convex/services/devto");
      const client = createDevToClient({ maxRetries: 2, retryDelayMs: 10, cacheTtlMs: 0 });
      await client.searchArticles("test");

      expect(callCount).toBe(2);
    });

    it("should not retry on client error (4xx except 429)", async () => {
      const mockFetch = vi.fn().mockResolvedValue({ ok: false, status: 404 });
      vi.stubGlobal("fetch", mockFetch);

      const { createDevToClient, DevToApiError } = await import(
        "../../convex/services/devto"
      );
      const client = createDevToClient({ maxRetries: 2, retryDelayMs: 10 });

      await expect(client.searchArticles("test")).rejects.toThrow(DevToApiError);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe("searchWithComments", () => {
    beforeEach(() => {
      vi.stubGlobal("fetch", vi.fn());
    });

    afterEach(() => {
      vi.unstubAllGlobals();
      vi.resetModules();
    });

    it("should fetch articles then comments in batches", async () => {
      const articlesResponse = [
        {
          id: 100,
          title: "Article A about Notion software",
          description: "A review of Notion app",
          body_markdown: "Body A content",
          user: { name: "authorA" },
          url: "https://dev.to/authorA/article-a",
          published_at: "2024-01-15T10:00:00Z",
          positive_reactions_count: 10,
          comments_count: 1,
          tag_list: ["notion"],
        },
        {
          id: 200,
          title: "Article B about Notion tool",
          description: "Another Notion review",
          body_markdown: "Body B content",
          user: { name: "authorB" },
          url: "https://dev.to/authorB/article-b",
          published_at: "2024-01-15T11:00:00Z",
          positive_reactions_count: 5,
          comments_count: 1,
          tag_list: ["notion"],
        },
      ];

      const commentsResponse = [
        {
          id_code: "5001",
          body_html: "<p>This is a comment with enough content to pass the minimum filter.</p>",
          user: { name: "commenter" },
          created_at: "2024-01-16T10:00:00Z",
          children: [],
        },
      ];

      const fullArticle100 = {
        id: 100,
        title: "Article A about Notion",
        description: "Notion review",
        body_markdown: "Full body of article A about Notion",
        user: { name: "authorA" },
        url: "https://dev.to/authorA/article-a",
        published_at: "2024-01-15T10:00:00Z",
        positive_reactions_count: 10,
        comments_count: 2,
        tag_list: ["notion"],
      };
      const fullArticle200 = {
        id: 200,
        title: "Article B about Notion tool",
        description: "Another Notion review",
        body_markdown: "Full body of article B about Notion",
        user: { name: "authorB" },
        url: "https://dev.to/authorB/article-b",
        published_at: "2024-01-15T11:00:00Z",
        positive_reactions_count: 5,
        comments_count: 1,
        tag_list: ["notion"],
      };

      const mockFetch = vi.fn().mockImplementation((url: string) => {
        let response: unknown;
        if (url.includes("/comments")) {
          response = commentsResponse;
        } else if (url.includes("/articles/100")) {
          response = fullArticle100;
        } else if (url.includes("/articles/200")) {
          response = fullArticle200;
        } else {
          response = articlesResponse;
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(response),
        });
      });
      vi.stubGlobal("fetch", mockFetch);

      const { createDevToClient } = await import("../../convex/services/devto");
      const client = createDevToClient({ cacheTtlMs: 0, requestDelayMs: 0 });
      const results = await client.searchWithComments("Notion", { articleLimit: 2 });

      expect(results).toHaveLength(2);
      expect(results[0].article.id).toBe(100);
      expect(results[0].article.body).toBe("Full body of article A about Notion");
      expect(results[0].comments).toHaveLength(1);
      // 1 search + 2 article detail fetches + 2 comment fetches
      expect(mockFetch).toHaveBeenCalledTimes(5);
    });

    it("should gracefully handle failed comment fetches", async () => {
      const articlesResponse = [
        {
          id: 100,
          title: "Article A",
          description: "Desc",
          body_markdown: "Body",
          user: { name: "author" },
          url: "https://dev.to/author/a",
          published_at: "2024-01-15T10:00:00Z",
          positive_reactions_count: 1,
          comments_count: 1,
          tag_list: [],
        },
      ];

      const mockFetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes("/comments")) {
          // Comment fetch fails
          return Promise.resolve({ ok: false, status: 500 });
        }
        if (url.includes("/articles/100")) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve(articlesResponse[0]),
          });
        }
        // Search endpoint
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(articlesResponse),
        });
      });
      vi.stubGlobal("fetch", mockFetch);

      const { createDevToClient } = await import("../../convex/services/devto");
      const client = createDevToClient({ cacheTtlMs: 0, maxRetries: 0, requestDelayMs: 0 });
      const results = await client.searchWithComments("test", { articleLimit: 1 });

      expect(results).toHaveLength(1);
      expect(results[0].article.id).toBe(100);
      expect(results[0].comments).toHaveLength(0);
    });
  });

  describe("graceful defaults", () => {
    beforeEach(() => {
      vi.stubGlobal("fetch", vi.fn());
    });

    afterEach(() => {
      vi.unstubAllGlobals();
      vi.resetModules();
    });

    it("should handle missing fields in article response", async () => {
      const mockResponse = [
        {
          id: 99999,
          // missing: title, description, body_markdown, user, url, published_at, etc.
        },
      ];

      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockResponse),
        })
      );

      const { createDevToClient } = await import("../../convex/services/devto");
      const client = createDevToClient({ cacheTtlMs: 0 });
      const result = await client.searchArticles("test");

      expect(result.articles).toHaveLength(1);
      expect(result.articles[0].id).toBe(99999);
      expect(result.articles[0].title).toBe("");
      expect(result.articles[0].description).toBe("");
      expect(result.articles[0].author).toBe("[unknown]");
      expect(result.articles[0].positiveReactions).toBe(0);
      expect(result.articles[0].tags).toEqual([]);
    });

    it("should fallback to body_html when body_markdown is missing", async () => {
      const mockResponse = [
        {
          id: 88888,
          title: "HTML-only Article",
          description: "Test",
          body_html: "<p>This is the <strong>HTML</strong> body content of the article.</p>",
          user: { name: "Author" },
          url: "https://dev.to/author/html-article",
          published_at: "2024-01-15T10:00:00Z",
          positive_reactions_count: 3,
          comments_count: 0,
          tag_list: [],
        },
      ];

      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockResponse),
        })
      );

      const { createDevToClient } = await import("../../convex/services/devto");
      const client = createDevToClient({ cacheTtlMs: 0 });
      const result = await client.searchArticles("test");

      expect(result.articles[0].body).toContain("HTML");
      expect(result.articles[0].body).toContain("body content");
      expect(result.articles[0].body).not.toContain("<p>");
      expect(result.articles[0].body).not.toContain("<strong>");
    });

    it("should fallback to username when name is missing", async () => {
      const mockResponse = [
        {
          id: 77777,
          title: "Test",
          description: "Test",
          body_markdown: "Body",
          user: { username: "fallback_user" },
          url: "https://dev.to/fallback_user/test",
          published_at: "2024-01-15T10:00:00Z",
          positive_reactions_count: 1,
          comments_count: 0,
          tag_list: [],
        },
      ];

      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockResponse),
        })
      );

      const { createDevToClient } = await import("../../convex/services/devto");
      const client = createDevToClient({ cacheTtlMs: 0 });
      const result = await client.searchArticles("test");

      expect(result.articles[0].author).toBe("fallback_user");
    });
  });

  describe("deeply nested comments", () => {
    beforeEach(() => {
      vi.stubGlobal("fetch", vi.fn());
    });

    afterEach(() => {
      vi.unstubAllGlobals();
      vi.resetModules();
    });

    it("should flatten three levels of nested comments", async () => {
      const mockResponse = [
        {
          id_code: "1",
          body_html: "<p>Level 1 comment that is long enough to pass the minimum length filter.</p>",
          user: { name: "level1" },
          created_at: "2024-01-15T10:00:00Z",
          children: [
            {
              id_code: "2",
              body_html: "<p>Level 2 reply that is also long enough to pass the filter easily.</p>",
              user: { name: "level2" },
              created_at: "2024-01-15T11:00:00Z",
              children: [
                {
                  id_code: "3",
                  body_html: "<p>Level 3 deep reply that is also long enough to pass the filter.</p>",
                  user: { name: "level3" },
                  created_at: "2024-01-15T12:00:00Z",
                  children: [],
                },
              ],
            },
          ],
        },
      ];

      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockResponse),
        })
      );

      const { createDevToClient } = await import("../../convex/services/devto");
      const client = createDevToClient({ cacheTtlMs: 0 });
      const comments = await client.fetchComments(12345);

      expect(comments).toHaveLength(3);
      expect(comments[0].author).toBe("level1");
      expect(comments[1].author).toBe("level2");
      expect(comments[2].author).toBe("level3");
    });
  });

  describe("error class", () => {
    it("should expose statusCode and retryable properties", async () => {
      const { DevToApiError } = await import("../../convex/services/devto");

      const err = new DevToApiError("Rate limited", 429, true);
      expect(err.message).toBe("Rate limited");
      expect(err.statusCode).toBe(429);
      expect(err.retryable).toBe(true);
      expect(err.name).toBe("DevToApiError");
      expect(err instanceof Error).toBe(true);
    });

    it("should default retryable to false", async () => {
      const { DevToApiError } = await import("../../convex/services/devto");

      const err = new DevToApiError("Not found", 404);
      expect(err.retryable).toBe(false);
    });
  });

  describe("retry exhaustion", () => {
    beforeEach(() => {
      vi.stubGlobal("fetch", vi.fn());
    });

    afterEach(() => {
      vi.unstubAllGlobals();
      vi.resetModules();
    });

    it("should throw after exhausting all retries on 429", async () => {
      const mockFetch = vi.fn().mockResolvedValue({ ok: false, status: 429 });
      vi.stubGlobal("fetch", mockFetch);

      const { createDevToClient, DevToApiError } = await import("../../convex/services/devto");
      const client = createDevToClient({ maxRetries: 1, retryDelayMs: 10, cacheTtlMs: 0 });

      await expect(client.searchArticles("test")).rejects.toThrow(DevToApiError);
      // initial + 1 retry = 2
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("should throw after exhausting all retries on 5xx", async () => {
      const mockFetch = vi.fn().mockResolvedValue({ ok: false, status: 503 });
      vi.stubGlobal("fetch", mockFetch);

      const { createDevToClient } = await import("../../convex/services/devto");
      const client = createDevToClient({ maxRetries: 1, retryDelayMs: 10, cacheTtlMs: 0 });

      await expect(client.searchArticles("test")).rejects.toThrow();
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe("URL construction", () => {
    beforeEach(() => {
      vi.stubGlobal("fetch", vi.fn());
    });

    afterEach(() => {
      vi.unstubAllGlobals();
      vi.resetModules();
    });

    it("should convert query to lowercase tag format", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve([]),
      });
      vi.stubGlobal("fetch", mockFetch);

      const { createDevToClient } = await import("../../convex/services/devto");
      const client = createDevToClient({ cacheTtlMs: 0 });
      await client.searchArticles("Visual Studio Code");

      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain("tag=visualstudiocode");
    });
  });

  describe("interface contract", () => {
    it("should implement IDevToClient interface", async () => {
      const { createDevToClient, DevToClient } = await import(
        "../../convex/services/devto"
      );

      const client = createDevToClient();
      expect(typeof client.searchArticles).toBe("function");
      expect(typeof client.fetchComments).toBe("function");
      expect(typeof client.searchWithComments).toBe("function");

      const classInstance = new DevToClient();
      expect(typeof classInstance.searchArticles).toBe("function");
      expect(typeof classInstance.fetchComments).toBe("function");
      expect(typeof classInstance.searchWithComments).toBe("function");
    });
  });
});
