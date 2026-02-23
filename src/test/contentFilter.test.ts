import { describe, it, expect } from "vitest";
import {
  fuzzyMatchProduct,
  isLikelySoftwareContent,
  SOFTWARE_KEYWORDS,
} from "../../convex/services/contentFilter";

describe("contentFilter", () => {
  describe("fuzzyMatchProduct", () => {
    it("should match exact product name (case-insensitive)", () => {
      expect(fuzzyMatchProduct("I love using Notion for notes", "Notion")).toBe(true);
      expect(fuzzyMatchProduct("NOTION is great", "notion")).toBe(true);
      expect(fuzzyMatchProduct("notion is great", "NOTION")).toBe(true);
    });

    it("should match with word boundaries (not substring)", () => {
      // "Notion" as a standalone word matches
      expect(fuzzyMatchProduct("I use Notion daily", "Notion")).toBe(true);
      // "Notional" contains "Notion" but word-boundary check should fail
      // matchesWordBoundary uses \b so "Notional" won't match \bNotion\b
      expect(fuzzyMatchProduct("The notional value is high", "Notion")).toBe(false);
    });

    it("should match possessive forms", () => {
      expect(fuzzyMatchProduct("Notion's interface is clean", "Notion")).toBe(true);
      expect(fuzzyMatchProduct("Slack's features are great", "Slack")).toBe(true);
    });

    it("should match plural forms", () => {
      expect(fuzzyMatchProduct("I use multiple Notions workspaces", "Notion")).toBe(true);
    });

    it("should match hyphenated versions of multi-word products", () => {
      expect(
        fuzzyMatchProduct("visual-studio-code is my editor", "Visual Studio Code")
      ).toBe(true);
    });

    it("should match concatenated versions of multi-word products", () => {
      expect(
        fuzzyMatchProduct("I prefer visualstudiocode over others", "Visual Studio Code")
      ).toBe(true);
    });

    it("should match multi-word products when all words present", () => {
      expect(
        fuzzyMatchProduct("I use Visual Studio Code daily", "Visual Studio Code")
      ).toBe(true);
    });

    it("should allow 1 character typo for names longer than 5 chars", () => {
      // "Notiom" vs "Notion" - 1 char difference at position 5
      expect(fuzzyMatchProduct("I use Notiom every day", "Notion")).toBe(true);
      // 1 char missing
      expect(fuzzyMatchProduct("I use Notio every day", "Notion")).toBe(true);
    });

    it("should NOT allow fuzzy matching for short names (<=5 chars)", () => {
      // "Slacl" is 1 char off from "Slack" but Slack is only 5 chars
      expect(fuzzyMatchProduct("I use Slacl for chat", "Slack")).toBe(false);
    });

    it("should not match completely unrelated text", () => {
      expect(fuzzyMatchProduct("I love apples and oranges", "Notion")).toBe(false);
      expect(fuzzyMatchProduct("The weather is nice today", "Slack")).toBe(false);
    });

    it("should not match empty text", () => {
      expect(fuzzyMatchProduct("", "Notion")).toBe(false);
    });

    it("should handle empty product name gracefully", () => {
      // Empty product name regex would match everything - but includes() would return true
      // The function should at least not throw
      expect(() => fuzzyMatchProduct("some text", "")).not.toThrow();
    });
  });

  describe("isLikelySoftwareContent", () => {
    it("should return false when product name not present at all", () => {
      expect(
        isLikelySoftwareContent("This is a general article about apps and software", "Notion")
      ).toBe(false);
    });

    it("should return true for word-boundary match + 1 software keyword", () => {
      // Lower threshold: word-boundary match + 1 keyword
      expect(
        isLikelySoftwareContent("Notion is a great app for notes", "Notion")
      ).toBe(true);
    });

    it("should return true for fuzzy match + 2 software keywords", () => {
      // Higher threshold path: fuzzy match + 2 keywords
      // "Notiom" is a fuzzy match, "software" and "tool" are 2 keywords
      expect(
        isLikelySoftwareContent("Notiom is a software tool for productivity", "Notion")
      ).toBe(true);
    });

    it("should return false for fuzzy match + only 1 keyword (below threshold)", () => {
      // Fuzzy match but only 1 software keyword - should fail the >= 2 threshold
      // Need to make sure the product name itself doesn't match with word-boundary
      // "Notiom" (fuzzy) + only "app" keyword = 1 keyword, need exactly 1 to test < 2 threshold
      // But if word-boundary also matches, the lower threshold (>=1) applies
      // Use a case where word-boundary fails but fuzzy matches
      expect(
        isLikelySoftwareContent("The Notiom meeting was about budgets", "Notion")
      ).toBe(false);
    });

    it("should return false for product match but zero keywords", () => {
      // Notion present but no SOFTWARE_KEYWORDS
      expect(
        isLikelySoftwareContent("Notion is a concept in philosophy", "Notion")
      ).toBe(false);
    });

    it("should be case insensitive", () => {
      expect(
        isLikelySoftwareContent("NOTION is a great APP for teams", "notion")
      ).toBe(true);
    });

    it("should handle long text with multiple keywords", () => {
      const text =
        "I switched from Notion to another platform because the pricing was too expensive. " +
        "The subscription model and the api integration were not great. " +
        "Looking for a better alternative with a free tier.";
      expect(isLikelySoftwareContent(text, "Notion")).toBe(true);
    });
  });

  describe("SOFTWARE_KEYWORDS constant", () => {
    it("should be a non-empty array of strings", () => {
      expect(Array.isArray(SOFTWARE_KEYWORDS)).toBe(true);
      expect(SOFTWARE_KEYWORDS.length).toBeGreaterThan(0);
      for (const kw of SOFTWARE_KEYWORDS) {
        expect(typeof kw).toBe("string");
      }
    });

    it("should contain expected core keywords", () => {
      const expected = ["app", "software", "tool", "platform", "service", "api", "saas"];
      for (const kw of expected) {
        expect(SOFTWARE_KEYWORDS).toContain(kw);
      }
    });

    it("should be all lowercase", () => {
      for (const kw of SOFTWARE_KEYWORDS) {
        expect(kw).toBe(kw.toLowerCase());
      }
    });
  });
});
