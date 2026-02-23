import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("Stack Overflow Client", () => {
  describe("searchQuestions", () => {
    beforeEach(() => {
      vi.stubGlobal("fetch", vi.fn());
    });

    afterEach(() => {
      vi.unstubAllGlobals();
      vi.resetModules();
    });

    it("should parse search results correctly", async () => {
      const mockResponse = {
        items: [
          {
            question_id: 12345,
            title: "How to use Notion API?",
            body: "<p>I want to integrate Notion into my workflow for project management.</p>",
            owner: { display_name: "testuser" },
            score: 42,
            answer_count: 3,
            creation_date: 1705312800,
            link: "https://stackoverflow.com/questions/12345",
            tags: ["notion", "api"],
          },
        ],
        has_more: false,
        quota_remaining: 290,
      };

      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockResponse),
        })
      );

      const { createStackOverflowClient } = await import("../../convex/services/stackoverflow");
      const client = createStackOverflowClient({ cacheTtlMs: 0 });
      const result = await client.searchQuestions("Notion");

      expect(result.query).toBe("Notion");
      expect(result.questions).toHaveLength(1);
      expect(result.questions[0].title).toBe("How to use Notion API?");
      expect(result.questions[0].author).toBe("testuser");
      expect(result.questions[0].score).toBe(42);
      expect(result.questions[0].id).toBe(12345);
      expect(result.questions[0].tags).toContain("notion");
    });

    it("should handle empty search results", async () => {
      const mockResponse = { items: [], has_more: false, quota_remaining: 290 };

      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockResponse),
        })
      );

      const { createStackOverflowClient } = await import("../../convex/services/stackoverflow");
      const client = createStackOverflowClient({ cacheTtlMs: 0 });
      const result = await client.searchQuestions("nonexistent_product_xyz");

      expect(result.questions).toHaveLength(0);
    });

    it("should decode HTML entities in body", async () => {
      const mockResponse = {
        items: [
          {
            question_id: 99999,
            title: "Test &amp; Question",
            body: "<p>Using &lt;Notion&gt; with &quot;quotes&quot; and &apos;apostrophes&apos;</p>",
            owner: { display_name: "htmluser" },
            score: 5,
            answer_count: 1,
            creation_date: 1705312800,
            link: "https://stackoverflow.com/questions/99999",
            tags: ["test"],
          },
        ],
        has_more: false,
        quota_remaining: 289,
      };

      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockResponse),
        })
      );

      const { createStackOverflowClient } = await import("../../convex/services/stackoverflow");
      const client = createStackOverflowClient({ cacheTtlMs: 0 });
      const result = await client.searchQuestions("test");

      expect(result.questions[0].title).toBe("Test & Question");
      expect(result.questions[0].body).not.toContain("<p>");
      expect(result.questions[0].body).toContain('<Notion>');
      expect(result.questions[0].body).toContain('"quotes"');
    });
  });

  describe("fetchAnswers", () => {
    beforeEach(() => {
      vi.stubGlobal("fetch", vi.fn());
    });

    afterEach(() => {
      vi.unstubAllGlobals();
      vi.resetModules();
    });

    it("should parse answers from API response", async () => {
      const mockResponse = {
        items: [
          {
            answer_id: 67890,
            body: "<p>You can use the Notion API by creating an integration token and using the official SDK for your language.</p>",
            owner: { display_name: "answerer1" },
            score: 15,
            is_accepted: true,
            creation_date: 1705399200,
            question_id: 12345,
          },
        ],
        has_more: false,
        quota_remaining: 288,
      };

      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockResponse),
        })
      );

      const { createStackOverflowClient } = await import("../../convex/services/stackoverflow");
      const client = createStackOverflowClient({ cacheTtlMs: 0 });
      const answers = await client.fetchAnswers(12345);

      expect(answers).toHaveLength(1);
      expect(answers[0].author).toBe("answerer1");
      expect(answers[0].isAccepted).toBe(true);
      expect(answers[0].score).toBe(15);
      expect(answers[0].body).toContain("Notion API");
      expect(answers[0].questionId).toBe(12345);
    });

    it("should filter out short answers", async () => {
      const mockResponse = {
        items: [
          {
            answer_id: 67890,
            body: "<p>This is a detailed answer about using the tool effectively in production environments.</p>",
            owner: { display_name: "valid" },
            score: 10,
            is_accepted: false,
            creation_date: 1705399200,
          },
          {
            answer_id: 67891,
            body: "<p>Yes</p>",
            owner: { display_name: "short_answerer" },
            score: 1,
            is_accepted: false,
            creation_date: 1705399300,
          },
        ],
        has_more: false,
        quota_remaining: 287,
      };

      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockResponse),
        })
      );

      const { createStackOverflowClient } = await import("../../convex/services/stackoverflow");
      const client = createStackOverflowClient({ cacheTtlMs: 0 });
      const answers = await client.fetchAnswers(12345);

      expect(answers).toHaveLength(1);
      expect(answers[0].author).toBe("valid");
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
        items: [
          {
            question_id: 12345,
            title: "Test Question",
            body: "<p>Test body</p>",
            owner: { display_name: "user" },
            score: 10,
            answer_count: 2,
            creation_date: 1705312800,
            link: "https://stackoverflow.com/questions/12345",
            tags: [],
          },
        ],
        has_more: false,
        quota_remaining: 290,
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse),
      });
      vi.stubGlobal("fetch", mockFetch);

      const { createStackOverflowClient } = await import("../../convex/services/stackoverflow");
      const client = createStackOverflowClient({ cacheTtlMs: 60000 });

      await client.searchQuestions("test");
      await client.searchQuestions("test");

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("should not use expired cache", async () => {
      const mockResponse = {
        items: [
          {
            question_id: 12345,
            title: "Test Question",
            body: "<p>Test body</p>",
            owner: { display_name: "user" },
            score: 10,
            answer_count: 2,
            creation_date: 1705312800,
            link: "https://stackoverflow.com/questions/12345",
            tags: [],
          },
        ],
        has_more: false,
        quota_remaining: 290,
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse),
      });
      vi.stubGlobal("fetch", mockFetch);

      const { createStackOverflowClient } = await import("../../convex/services/stackoverflow");
      const client = createStackOverflowClient({ cacheTtlMs: 1 });

      await client.searchQuestions("test");
      await new Promise((r) => setTimeout(r, 10));
      await client.searchQuestions("test");

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("should allow clearing cache", async () => {
      const mockResponse = {
        items: [
          {
            question_id: 12345,
            title: "Test Question",
            body: "<p>Test body</p>",
            owner: { display_name: "user" },
            score: 10,
            answer_count: 2,
            creation_date: 1705312800,
            link: "https://stackoverflow.com/questions/12345",
            tags: [],
          },
        ],
        has_more: false,
        quota_remaining: 290,
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse),
      });
      vi.stubGlobal("fetch", mockFetch);

      const { StackOverflowClient } = await import("../../convex/services/stackoverflow");
      const client = new StackOverflowClient({ cacheTtlMs: 60000 });

      await client.searchQuestions("test");
      client.clearCache();
      await client.searchQuestions("test");

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
      const mockResponse = { items: [], has_more: false, quota_remaining: 0 };

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

      const { createStackOverflowClient } = await import("../../convex/services/stackoverflow");
      const client = createStackOverflowClient({ maxRetries: 2, retryDelayMs: 10, cacheTtlMs: 0 });
      await client.searchQuestions("test");

      expect(callCount).toBe(2);
    });

    it("should retry on server error (5xx)", async () => {
      const mockResponse = { items: [], has_more: false, quota_remaining: 290 };

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

      const { createStackOverflowClient } = await import("../../convex/services/stackoverflow");
      const client = createStackOverflowClient({ maxRetries: 2, retryDelayMs: 10, cacheTtlMs: 0 });
      await client.searchQuestions("test");

      expect(callCount).toBe(2);
    });

    it("should not retry on client error (4xx except 429)", async () => {
      const mockFetch = vi.fn().mockResolvedValue({ ok: false, status: 404 });
      vi.stubGlobal("fetch", mockFetch);

      const { createStackOverflowClient, StackOverflowApiError } = await import(
        "../../convex/services/stackoverflow"
      );
      const client = createStackOverflowClient({ maxRetries: 2, retryDelayMs: 10 });

      await expect(client.searchQuestions("test")).rejects.toThrow(StackOverflowApiError);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe("searchWithAnswers", () => {
    beforeEach(() => {
      vi.stubGlobal("fetch", vi.fn());
    });

    afterEach(() => {
      vi.unstubAllGlobals();
      vi.resetModules();
    });

    it("should fetch questions then answers in batches", async () => {
      const searchResponse = {
        items: [
          {
            question_id: 100,
            title: "Question A about Notion software tool",
            body: "<p>Question A body about this app</p>",
            owner: { display_name: "userA" },
            score: 10,
            answer_count: 1,
            creation_date: 1705312800,
            link: "https://stackoverflow.com/questions/100",
            tags: ["notion"],
          },
          {
            question_id: 200,
            title: "Question B about Notion review",
            body: "<p>Question B body about the platform</p>",
            owner: { display_name: "userB" },
            score: 5,
            answer_count: 1,
            creation_date: 1705312900,
            link: "https://stackoverflow.com/questions/200",
            tags: ["notion"],
          },
        ],
        has_more: false,
        quota_remaining: 280,
      };

      const answersResponse = {
        items: [
          {
            answer_id: 999,
            body: "<p>This is a detailed answer with enough content to pass the filter.</p>",
            owner: { display_name: "answerer" },
            score: 8,
            is_accepted: true,
            creation_date: 1705399200,
          },
        ],
        has_more: false,
        quota_remaining: 279,
      };

      let callCount = 0;
      const mockFetch = vi.fn().mockImplementation(() => {
        callCount++;
        const response = callCount === 1 ? searchResponse : answersResponse;
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(response),
        });
      });
      vi.stubGlobal("fetch", mockFetch);

      const { createStackOverflowClient } = await import("../../convex/services/stackoverflow");
      const client = createStackOverflowClient({ cacheTtlMs: 0, requestDelayMs: 0 });
      const results = await client.searchWithAnswers("Notion", {
        questionLimit: 2,
        answersPerQuestion: 5,
      });

      expect(results).toHaveLength(2);
      expect(results[0].question.id).toBe(100);
      expect(results[0].answers).toHaveLength(1);
      // 1 search call + 2 answer calls (batched together)
      expect(callCount).toBe(3);
    });

    it("should gracefully handle failed answer fetches", async () => {
      const searchResponse = {
        items: [
          {
            question_id: 100,
            title: "Question A",
            body: "<p>Body</p>",
            owner: { display_name: "user" },
            score: 10,
            answer_count: 1,
            creation_date: 1705312800,
            link: "https://stackoverflow.com/questions/100",
            tags: [],
          },
        ],
        has_more: false,
        quota_remaining: 280,
      };

      let callCount = 0;
      const mockFetch = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve(searchResponse),
          });
        }
        // Answer fetch fails
        return Promise.resolve({ ok: false, status: 500 });
      });
      vi.stubGlobal("fetch", mockFetch);

      const { createStackOverflowClient } = await import("../../convex/services/stackoverflow");
      const client = createStackOverflowClient({ cacheTtlMs: 0, maxRetries: 0, requestDelayMs: 0 });
      const results = await client.searchWithAnswers("test", { questionLimit: 1 });

      // Should still return the question with empty answers
      expect(results).toHaveLength(1);
      expect(results[0].question.id).toBe(100);
      expect(results[0].answers).toHaveLength(0);
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

    it("should handle missing fields in question response", async () => {
      const mockResponse = {
        items: [
          {
            question_id: 55555,
            // missing: title, body, owner, score, answer_count, link, tags
            creation_date: 1705312800,
          },
        ],
        has_more: false,
        quota_remaining: 290,
      };

      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockResponse),
        })
      );

      const { createStackOverflowClient } = await import("../../convex/services/stackoverflow");
      const client = createStackOverflowClient({ cacheTtlMs: 0 });
      const result = await client.searchQuestions("test");

      expect(result.questions).toHaveLength(1);
      expect(result.questions[0].id).toBe(55555);
      expect(result.questions[0].title).toBe("");
      expect(result.questions[0].body).toBe("");
      expect(result.questions[0].author).toBe("[unknown]");
      expect(result.questions[0].score).toBe(0);
      expect(result.questions[0].tags).toEqual([]);
    });

    it("should handle missing fields in answer response", async () => {
      const mockResponse = {
        items: [
          {
            answer_id: 77777,
            body: "<p>This answer has enough content to pass the minimum length filter easily.</p>",
            // missing: owner, score, is_accepted, creation_date
          },
        ],
        has_more: false,
        quota_remaining: 290,
      };

      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockResponse),
        })
      );

      const { createStackOverflowClient } = await import("../../convex/services/stackoverflow");
      const client = createStackOverflowClient({ cacheTtlMs: 0 });
      const answers = await client.fetchAnswers(12345);

      expect(answers).toHaveLength(1);
      expect(answers[0].author).toBe("[unknown]");
      expect(answers[0].score).toBe(0);
      expect(answers[0].isAccepted).toBe(false);
      expect(answers[0].createdAt).toBe("");
    });
  });

  describe("API key", () => {
    beforeEach(() => {
      vi.stubGlobal("fetch", vi.fn());
    });

    afterEach(() => {
      vi.unstubAllGlobals();
      vi.resetModules();
    });

    it("should include API key in URL when configured", async () => {
      const mockResponse = { items: [], has_more: false, quota_remaining: 9990 };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse),
      });
      vi.stubGlobal("fetch", mockFetch);

      const { createStackOverflowClient } = await import("../../convex/services/stackoverflow");
      const client = createStackOverflowClient({ cacheTtlMs: 0, apiKey: "test-api-key-123" });
      await client.searchQuestions("test");

      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain("key=test-api-key-123");
      expect(calledUrl).toContain("site=stackoverflow");
    });

    it("should not include key param when no API key", async () => {
      const mockResponse = { items: [], has_more: false, quota_remaining: 290 };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse),
      });
      vi.stubGlobal("fetch", mockFetch);

      const { createStackOverflowClient } = await import("../../convex/services/stackoverflow");
      const client = createStackOverflowClient({ cacheTtlMs: 0 });
      await client.searchQuestions("test");

      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).not.toContain("key=");
    });
  });

  describe("error class", () => {
    it("should expose statusCode and retryable properties", async () => {
      const { StackOverflowApiError } = await import("../../convex/services/stackoverflow");

      const err = new StackOverflowApiError("Rate limited", 429, true);
      expect(err.message).toBe("Rate limited");
      expect(err.statusCode).toBe(429);
      expect(err.retryable).toBe(true);
      expect(err.name).toBe("StackOverflowApiError");
      expect(err instanceof Error).toBe(true);
    });

    it("should default retryable to false", async () => {
      const { StackOverflowApiError } = await import("../../convex/services/stackoverflow");

      const err = new StackOverflowApiError("Not found", 404);
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

      const { createStackOverflowClient, StackOverflowApiError } = await import(
        "../../convex/services/stackoverflow"
      );
      const client = createStackOverflowClient({ maxRetries: 1, retryDelayMs: 10, cacheTtlMs: 0 });

      await expect(client.searchQuestions("test")).rejects.toThrow(StackOverflowApiError);
      // initial + 1 retry = 2
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("should throw after exhausting all retries on 5xx", async () => {
      const mockFetch = vi.fn().mockResolvedValue({ ok: false, status: 502 });
      vi.stubGlobal("fetch", mockFetch);

      const { createStackOverflowClient } = await import("../../convex/services/stackoverflow");
      const client = createStackOverflowClient({ maxRetries: 1, retryDelayMs: 10, cacheTtlMs: 0 });

      await expect(client.searchQuestions("test")).rejects.toThrow();
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe("interface contract", () => {
    it("should implement IStackOverflowClient interface", async () => {
      const { createStackOverflowClient, StackOverflowClient } = await import(
        "../../convex/services/stackoverflow"
      );

      const client = createStackOverflowClient();
      expect(typeof client.searchQuestions).toBe("function");
      expect(typeof client.fetchAnswers).toBe("function");
      expect(typeof client.searchWithAnswers).toBe("function");

      const classInstance = new StackOverflowClient();
      expect(typeof classInstance.searchQuestions).toBe("function");
      expect(typeof classInstance.fetchAnswers).toBe("function");
      expect(typeof classInstance.searchWithAnswers).toBe("function");
    });
  });
});
