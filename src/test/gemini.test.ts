import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("Gemini Client", () => {
  describe("scoreOutputQuality", () => {
    // scoreOutputQuality is a public method on GeminiClient - test it directly
    let scoreOutputQuality: InstanceType<
      typeof import("../../convex/services/gemini").GeminiClient
    >["scoreOutputQuality"];

    beforeEach(async () => {
      const { GeminiClient } = await import("../../convex/services/gemini");
      const client = new GeminiClient({ apiKey: "test-key" });
      scoreOutputQuality = client.scoreOutputQuality.bind(client);
    });

    afterEach(() => {
      vi.resetModules();
    });

    it("should return high quality for well-formed output", () => {
      const parsed = {
        summary: "This product has strong positive feedback from users across communities.",
        overallScore: 75,
        strengths: [
          { title: "Excellent Collaboration Features", mentionIds: [0, 1, 2] },
          { title: "Intuitive User Interface", mentionIds: [3, 4] },
        ],
        issues: [
          { title: "High Pricing Concerns", mentionIds: [5, 6] },
          { title: "Slow Mobile Performance", mentionIds: [7, 8] },
        ],
        aspects: [{ mentionIds: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] }],
      };

      const quality = scoreOutputQuality(parsed, 10);
      expect(quality.overall).toBeGreaterThanOrEqual(0.6);
      expect(quality.reasons).toHaveLength(0);
      expect(quality.mentionCoverage).toBeGreaterThan(0.3);
      expect(quality.insightSpecificity).toBe(1);
      expect(quality.quoteAccuracy).toBe(1);
    });

    it("should detect low mention coverage", () => {
      const parsed = {
        summary: "Summary of the product feedback analysis results.",
        overallScore: 60,
        strengths: [{ title: "Good UI", mentionIds: [0] }],
        issues: [{ title: "Bad perf", mentionIds: [1] }],
        aspects: [{ mentionIds: [0, 1] }],
      };

      const quality = scoreOutputQuality(parsed, 20);
      expect(quality.mentionCoverage).toBeLessThan(0.3);
      expect(quality.reasons).toContainEqual(
        expect.stringContaining("Low mention coverage")
      );
    });

    it("should detect generic insight titles", () => {
      const parsed = {
        summary: "Summary of the product feedback analysis results.",
        overallScore: 60,
        strengths: [
          { title: "User Feedback", mentionIds: [0, 1, 2] },
          { title: "General Feedback", mentionIds: [3, 4] },
        ],
        issues: [
          { title: "Areas for Improvement", mentionIds: [5, 6] },
          { title: "Mixed Reviews", mentionIds: [7, 8] },
        ],
        aspects: [{ mentionIds: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] }],
      };

      const quality = scoreOutputQuality(parsed, 10);
      expect(quality.insightSpecificity).toBeLessThan(1);
      expect(quality.reasons).toContainEqual(
        expect.stringContaining("generic insight title")
      );
    });

    it("should detect out-of-bounds mentionIds", () => {
      const parsed = {
        summary: "Summary of the product feedback analysis results.",
        overallScore: 60,
        strengths: [{ title: "Good Feature", mentionIds: [0, 1, 99, -1] }],
        issues: [{ title: "Bad Feature", mentionIds: [2, 3] }],
        aspects: [{ mentionIds: [0, 1, 2, 3] }],
      };

      const quality = scoreOutputQuality(parsed, 10);
      expect(quality.quoteAccuracy).toBeLessThan(1);
      expect(quality.reasons).toContainEqual(
        expect.stringContaining("out-of-bounds mentionId")
      );
    });

    it("should detect missing strengths", () => {
      const parsed = {
        summary: "Summary of the product feedback analysis results.",
        overallScore: 60,
        strengths: [],
        issues: [
          { title: "Issue A", mentionIds: [0] },
          { title: "Issue B", mentionIds: [1] },
        ],
        aspects: [{ mentionIds: [0, 1] }],
      };

      const quality = scoreOutputQuality(parsed, 5);
      expect(quality.reasons).toContainEqual(
        expect.stringContaining("No strengths")
      );
    });

    it("should detect missing issues", () => {
      const parsed = {
        summary: "Summary of the product feedback analysis results.",
        overallScore: 60,
        strengths: [
          { title: "Strength A", mentionIds: [0] },
          { title: "Strength B", mentionIds: [1] },
        ],
        issues: [],
        aspects: [{ mentionIds: [0, 1] }],
      };

      const quality = scoreOutputQuality(parsed, 5);
      expect(quality.reasons).toContainEqual(
        expect.stringContaining("No issues")
      );
    });

    it("should detect short or missing summary", () => {
      const parsed = {
        summary: "Too short",
        overallScore: 60,
        strengths: [
          { title: "A", mentionIds: [0] },
          { title: "B", mentionIds: [1] },
        ],
        issues: [
          { title: "C", mentionIds: [2] },
          { title: "D", mentionIds: [3] },
        ],
        aspects: [{ mentionIds: [0, 1, 2, 3] }],
      };

      const quality = scoreOutputQuality(parsed, 5);
      expect(quality.reasons).toContainEqual(
        expect.stringContaining("Summary too short")
      );
    });

    it("should detect score out of range", () => {
      const parsed = {
        summary: "Summary of the product feedback analysis results.",
        overallScore: 150,
        strengths: [
          { title: "A", mentionIds: [0] },
          { title: "B", mentionIds: [1] },
        ],
        issues: [
          { title: "C", mentionIds: [2] },
          { title: "D", mentionIds: [3] },
        ],
        aspects: [{ mentionIds: [0, 1, 2, 3] }],
      };

      const quality = scoreOutputQuality(parsed, 5);
      expect(quality.reasons).toContainEqual(
        expect.stringContaining("Score out of range")
      );
    });

    it("should handle zero mentionCount edge case", () => {
      const parsed = {
        summary: "No data available for analysis of this product.",
        overallScore: 50,
        strengths: [],
        issues: [],
        aspects: [],
      };

      const quality = scoreOutputQuality(parsed, 0);
      // mentionCoverage = 0 (0/0), quoteAccuracy = 1 (0/0)
      expect(quality.mentionCoverage).toBe(0);
      expect(quality.quoteAccuracy).toBe(1);
    });

    it("should compute weighted overall score correctly", () => {
      // All-perfect case
      const parsed = {
        summary: "This is a detailed summary with enough length to pass validation.",
        overallScore: 75,
        strengths: [
          { title: "Specific Strength A", mentionIds: [0, 1] },
          { title: "Specific Strength B", mentionIds: [2, 3] },
        ],
        issues: [
          { title: "Specific Issue A", mentionIds: [4, 5] },
          { title: "Specific Issue B", mentionIds: [6, 7] },
        ],
        aspects: [{ mentionIds: [8, 9] }],
      };

      const quality = scoreOutputQuality(parsed, 10);
      // coverage = 10/10 = 1.0, specificity = 1.0, accuracy = 1.0, structural = 1.0
      // overall = 1.0*0.3 + 1.0*0.3 + 1.0*0.2 + 1.0*0.2 = 1.0
      expect(quality.overall).toBeCloseTo(1.0, 1);
    });
  });

  describe("analyzeProductFeedback", () => {
    beforeEach(() => {
      vi.stubGlobal("fetch", vi.fn());
    });

    afterEach(() => {
      vi.unstubAllGlobals();
      vi.resetModules();
    });

    it("should return default response for empty mentions", async () => {
      const { GeminiClient } = await import("../../convex/services/gemini");
      const client = new GeminiClient({ apiKey: "test-key" });
      const result = await client.analyzeProductFeedback("TestProduct", []);

      expect(result.summary).toContain("No user feedback found");
      expect(result.overallScore).toBe(50);
      expect(result.strengths).toHaveLength(0);
      expect(result.issues).toHaveLength(0);
      expect(result.aspects).toHaveLength(3);
      expect(result.aspects[0].name).toBe("Features");
    });

    it("should parse successful Gemini response", async () => {
      const geminiResponse = {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    summary: "TestProduct has positive reviews from the developer community.",
                    overallScore: 80,
                    strengths: [
                      {
                        title: "Great API Design",
                        description: "Users praise the API",
                        mentionIds: [0, 1],
                      },
                      {
                        title: "Active Community",
                        description: "Strong community support",
                        mentionIds: [2],
                      },
                    ],
                    issues: [
                      {
                        title: "Steep Learning Curve",
                        description: "New users struggle",
                        mentionIds: [3],
                      },
                      {
                        title: "Expensive Pricing",
                        description: "Cost is a concern",
                        mentionIds: [4],
                      },
                    ],
                    aspects: [
                      { name: "Features", score: 85, mentionIds: [0, 1] },
                      { name: "Ease of Use", score: 60, mentionIds: [3] },
                      { name: "Performance", score: 75, mentionIds: [2] },
                    ],
                  }),
                },
              ],
            },
          },
        ],
      };

      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: () => Promise.resolve(geminiResponse),
        })
      );

      const { GeminiClient } = await import("../../convex/services/gemini");
      const client = new GeminiClient({ apiKey: "test-key", maxRetries: 0 });

      const mentions = Array.from({ length: 5 }, (_, i) => ({
        text: `Mention ${i} about the product with enough text to be meaningful`,
        author: `user${i}`,
        date: "2024-01-15",
        url: `https://example.com/${i}`,
        isPositive: i < 3,
        source: "reddit",
      }));

      const result = await client.analyzeProductFeedback("TestProduct", mentions);

      expect(result.summary).toContain("positive reviews");
      expect(result.overallScore).toBe(80);
      expect(result.strengths).toHaveLength(2);
      expect(result.strengths[0].title).toBe("Great API Design");
      expect(result.strengths[0].quotes).toHaveLength(2);
      expect(result.issues).toHaveLength(2);
      expect(result.aspects).toHaveLength(3);
    });

    it("should clamp overallScore to 0-100 range", async () => {
      const geminiResponse = {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    summary: "A detailed enough summary for validation purposes here.",
                    overallScore: 150,
                    strengths: [{ title: "A", description: "B", mentionIds: [0] }],
                    issues: [{ title: "C", description: "D", mentionIds: [1] }],
                    aspects: [{ name: "Features", score: -20, mentionIds: [0] }],
                  }),
                },
              ],
            },
          },
        ],
      };

      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: () => Promise.resolve(geminiResponse),
        })
      );

      const { GeminiClient } = await import("../../convex/services/gemini");
      const client = new GeminiClient({ apiKey: "test-key", maxRetries: 0 });

      const mentions = [
        { text: "Good product text", author: "u", date: "d", url: "http://a", isPositive: true },
        { text: "Bad product text", author: "u", date: "d", url: "http://b", isPositive: false },
      ];

      const result = await client.analyzeProductFeedback("Test", mentions);
      expect(result.overallScore).toBe(100);
      expect(result.aspects[0].score).toBe(0);
    });

    it("should parse JSON wrapped in code fence", async () => {
      const jsonStr = JSON.stringify({
        summary: "A detailed enough summary for validation purposes here.",
        overallScore: 70,
        strengths: [{ title: "Good", description: "Yes", mentionIds: [0] }],
        issues: [{ title: "Bad", description: "No", mentionIds: [1] }],
        aspects: [{ name: "Features", score: 70, mentionIds: [0] }],
      });

      const geminiResponse = {
        candidates: [
          {
            content: {
              parts: [{ text: "```json\n" + jsonStr + "\n```" }],
            },
          },
        ],
      };

      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: () => Promise.resolve(geminiResponse),
        })
      );

      const { GeminiClient } = await import("../../convex/services/gemini");
      const client = new GeminiClient({ apiKey: "test-key", maxRetries: 0 });

      const mentions = [
        { text: "Good product text", author: "u", date: "d", url: "http://a", isPositive: true },
        { text: "Bad product text", author: "u", date: "d", url: "http://b", isPositive: false },
      ];

      const result = await client.analyzeProductFeedback("Test", mentions);
      expect(result.overallScore).toBe(70);
    });

    it("should filter out-of-bounds mentionIds from quotes", async () => {
      const geminiResponse = {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    summary: "A detailed enough summary for validation purposes here.",
                    overallScore: 70,
                    strengths: [
                      { title: "Good", description: "Yes", mentionIds: [0, 99, -1] },
                    ],
                    issues: [{ title: "Bad", description: "No", mentionIds: [1] }],
                    aspects: [{ name: "Features", score: 70, mentionIds: [0] }],
                  }),
                },
              ],
            },
          },
        ],
      };

      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: () => Promise.resolve(geminiResponse),
        })
      );

      const { GeminiClient } = await import("../../convex/services/gemini");
      const client = new GeminiClient({ apiKey: "test-key", maxRetries: 0 });

      const mentions = [
        { text: "Good product text", author: "u", date: "d", url: "http://a", isPositive: true },
        { text: "Bad product text", author: "u", date: "d", url: "http://b", isPositive: false },
      ];

      const result = await client.analyzeProductFeedback("Test", mentions);
      // Only mentionId 0 should survive (99 and -1 are out of bounds)
      expect(result.strengths[0].quotes).toHaveLength(1);
      expect(result.strengths[0].quotes[0].text).toBe("Good product text");
    });

    it("should limit mentions to 30 items", async () => {
      const geminiResponse = {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    summary: "A detailed enough summary for validation purposes here.",
                    overallScore: 70,
                    strengths: [{ title: "Good", description: "Yes", mentionIds: [0] }],
                    issues: [{ title: "Bad", description: "No", mentionIds: [1] }],
                    aspects: [{ name: "Features", score: 70, mentionIds: [0] }],
                  }),
                },
              ],
            },
          },
        ],
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(geminiResponse),
      });
      vi.stubGlobal("fetch", mockFetch);

      const { GeminiClient } = await import("../../convex/services/gemini");
      const client = new GeminiClient({ apiKey: "test-key", maxRetries: 0 });

      const mentions = Array.from({ length: 50 }, (_, i) => ({
        text: `Mention ${i} with enough content to be meaningful text`,
        author: `user${i}`,
        date: "2024-01-15",
        url: `https://example.com/${i}`,
        isPositive: true,
        source: "reddit",
      }));

      await client.analyzeProductFeedback("Test", mentions);

      // Verify the prompt only includes 30 mentions (check the request body)
      const requestBody = JSON.parse(
        (mockFetch.mock.calls[0][1] as { body: string }).body
      );
      const promptText = requestBody.contents[0].parts[0].text as string;
      // The prompt includes "30 user mentions (out of 50 total)"
      expect(promptText).toContain("30 user mentions");
      expect(promptText).toContain("50 total");
    });

    it("should truncate individual mention text to 300 chars", async () => {
      const geminiResponse = {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    summary: "A detailed enough summary for validation purposes here.",
                    overallScore: 70,
                    strengths: [{ title: "Good", description: "Yes", mentionIds: [0] }],
                    issues: [{ title: "Bad", description: "No", mentionIds: [1] }],
                    aspects: [{ name: "Features", score: 70, mentionIds: [0] }],
                  }),
                },
              ],
            },
          },
        ],
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(geminiResponse),
      });
      vi.stubGlobal("fetch", mockFetch);

      const { GeminiClient } = await import("../../convex/services/gemini");
      const client = new GeminiClient({ apiKey: "test-key", maxRetries: 0 });

      const mentions = [
        {
          text: "X".repeat(500),
          author: "user",
          date: "2024-01-15",
          url: "https://example.com/0",
          isPositive: true,
        },
      ];

      await client.analyzeProductFeedback("Test", mentions);

      const requestBody = JSON.parse(
        (mockFetch.mock.calls[0][1] as { body: string }).body
      );
      const promptText = requestBody.contents[0].parts[0].text as string;
      // The mention text in the prompt should be truncated to 300 chars
      expect(promptText).not.toContain("X".repeat(301));
    });
  });

  describe("generate (via analyzeProductFeedback)", () => {
    beforeEach(() => {
      vi.stubGlobal("fetch", vi.fn());
    });

    afterEach(() => {
      vi.unstubAllGlobals();
      vi.resetModules();
    });

    it("should throw GeminiApiError on non-ok response", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 500,
          text: () => Promise.resolve("Internal Server Error"),
        })
      );

      const { GeminiClient, GeminiApiError } = await import("../../convex/services/gemini");
      const client = new GeminiClient({ apiKey: "test-key", maxRetries: 0 });

      const mentions = [
        { text: "Some text here", author: "u", date: "d", url: "http://a", isPositive: true },
      ];

      await expect(
        client.analyzeProductFeedback("Test", mentions)
      ).rejects.toThrow(GeminiApiError);
    });

    it("should throw GeminiApiError when no text in response", async () => {
      const geminiResponse = {
        candidates: [{ content: { parts: [] } }],
      };

      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: () => Promise.resolve(geminiResponse),
        })
      );

      const { GeminiClient, GeminiApiError } = await import("../../convex/services/gemini");
      const client = new GeminiClient({ apiKey: "test-key", maxRetries: 0 });

      const mentions = [
        { text: "Some text here", author: "u", date: "d", url: "http://a", isPositive: true },
      ];

      await expect(
        client.analyzeProductFeedback("Test", mentions)
      ).rejects.toThrow(GeminiApiError);
    });

    it("should throw GeminiApiError on malformed JSON response", async () => {
      const geminiResponse = {
        candidates: [
          {
            content: {
              parts: [{ text: "This is not JSON at all, just random text" }],
            },
          },
        ],
      };

      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: () => Promise.resolve(geminiResponse),
        })
      );

      const { GeminiClient, GeminiApiError } = await import("../../convex/services/gemini");
      const client = new GeminiClient({ apiKey: "test-key", maxRetries: 0 });

      const mentions = [
        { text: "Some text here", author: "u", date: "d", url: "http://a", isPositive: true },
      ];

      await expect(
        client.analyzeProductFeedback("Test", mentions)
      ).rejects.toThrow(GeminiApiError);
    });
  });

  describe("retry behavior", () => {
    beforeEach(() => {
      vi.stubGlobal("fetch", vi.fn());
    });

    afterEach(() => {
      vi.unstubAllGlobals();
      vi.resetModules();
    });

    it("should retry when quality is below threshold", async () => {
      // First response: low quality (generic titles)
      const lowQualityResponse = JSON.stringify({
        summary: "A",
        overallScore: 50,
        strengths: [{ title: "User Feedback", description: "Generic", mentionIds: [0] }],
        issues: [{ title: "Areas for Improvement", description: "Generic", mentionIds: [1] }],
        aspects: [{ name: "Features", score: 50, mentionIds: [0] }],
      });

      // Second response: better quality
      const highQualityResponse = JSON.stringify({
        summary: "This product has strong reviews from technical users across communities.",
        overallScore: 75,
        strengths: [
          { title: "Excellent API Design", description: "Specific", mentionIds: [0, 1, 2] },
          { title: "Great Documentation", description: "Specific", mentionIds: [3, 4] },
        ],
        issues: [
          { title: "High Learning Curve", description: "Specific", mentionIds: [5, 6] },
          { title: "Expensive Enterprise Tier", description: "Specific", mentionIds: [7, 8] },
        ],
        aspects: [
          { name: "Features", score: 80, mentionIds: [0, 1] },
          { name: "Ease of Use", score: 60, mentionIds: [5, 6] },
          { name: "Performance", score: 70, mentionIds: [3, 4] },
        ],
      });

      let callCount = 0;
      vi.stubGlobal(
        "fetch",
        vi.fn().mockImplementation(() => {
          callCount++;
          const text = callCount === 1 ? lowQualityResponse : highQualityResponse;
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () =>
              Promise.resolve({
                candidates: [{ content: { parts: [{ text }] } }],
              }),
          });
        })
      );

      const { GeminiClient } = await import("../../convex/services/gemini");
      const client = new GeminiClient({ apiKey: "test-key", maxRetries: 1 });

      const mentions = Array.from({ length: 10 }, (_, i) => ({
        text: `Mention ${i} about the product with enough text to be meaningful`,
        author: `user${i}`,
        date: "2024-01-15",
        url: `https://example.com/${i}`,
        isPositive: i < 5,
      }));

      const result = await client.analyzeProductFeedback("Test", mentions);
      // Should have retried
      expect(callCount).toBe(2);
      // Should use the better result
      expect(result.strengths[0].title).toBe("Excellent API Design");
    });
  });

  describe("GeminiApiError", () => {
    it("should expose statusCode property", async () => {
      const { GeminiApiError } = await import("../../convex/services/gemini");
      const err = new GeminiApiError("API error", 429);
      expect(err.statusCode).toBe(429);
      expect(err.message).toBe("API error");
      expect(err.name).toBe("GeminiApiError");
      expect(err instanceof Error).toBe(true);
    });

    it("should handle missing statusCode", async () => {
      const { GeminiApiError } = await import("../../convex/services/gemini");
      const err = new GeminiApiError("No status");
      expect(err.statusCode).toBeUndefined();
    });
  });

  describe("createGeminiClient factory", () => {
    it("should create a GeminiClient instance", async () => {
      const { createGeminiClient } = await import("../../convex/services/gemini");
      const client = createGeminiClient("test-key");
      expect(typeof client.analyzeProductFeedback).toBe("function");
      expect(typeof client.scoreOutputQuality).toBe("function");
    });
  });
});
