import { describe, it, expect } from "vitest";
import { deduplicateMentions } from "../../convex/services/dedup";

function mention(text: string) {
  return { text, author: "testuser", date: "2026-01-15", url: "https://example.com" };
}

describe("deduplicateMentions", () => {
  it("returns empty array for empty input", () => {
    expect(deduplicateMentions([])).toEqual([]);
  });

  it("preserves distinct mentions", () => {
    const mentions = [
      mention("This product has really great features and I love it."),
      mention("The pricing model is confusing and expensive for small teams."),
      mention("Customer support responded quickly and resolved my issue."),
    ];
    expect(deduplicateMentions(mentions)).toHaveLength(3);
  });

  it("removes exact duplicates", () => {
    const text = "This product has really great features and I love it.";
    const mentions = [mention(text), mention(text), mention(text)];
    expect(deduplicateMentions(mentions)).toHaveLength(1);
  });

  it("removes duplicates that differ only in whitespace", () => {
    const mentions = [
      mention("This product has really great features and I love it."),
      mention("This  product   has  really great  features and  I  love  it."),
    ];
    expect(deduplicateMentions(mentions)).toHaveLength(1);
  });

  it("removes duplicates that differ only in casing", () => {
    const mentions = [
      mention("This product has really great features and I love it."),
      mention("THIS PRODUCT HAS REALLY GREAT FEATURES AND I LOVE IT."),
    ];
    expect(deduplicateMentions(mentions)).toHaveLength(1);
  });

  it("removes substring duplicates (quoted content within larger text)", () => {
    const short = "The UI is intuitive and well designed for beginners.";
    const long = "I agree with this: The UI is intuitive and well designed for beginners. It really helps onboarding.";
    const mentions = [mention(short), mention(long)];
    // The short one is kept first, then the long one is detected as containing it
    expect(deduplicateMentions(mentions)).toHaveLength(1);
  });

  it("removes prefix-match duplicates (reposts with trailing differences)", () => {
    const prefix = "a".repeat(100);
    const mentions = [
      mention(prefix + " original ending here with some extra context."),
      mention(prefix + " different ending but same start content here."),
    ];
    expect(deduplicateMentions(mentions)).toHaveLength(1);
  });

  it("does not false-positive on short shared prefixes", () => {
    // Two mentions that share fewer than 100 chars of prefix
    const mentions = [
      mention("The product is good but could use some improvements in the dashboard area for analytics."),
      mention("The product is good but the pricing is too high compared to alternatives on the market today."),
    ];
    expect(deduplicateMentions(mentions)).toHaveLength(2);
  });

  it("filters out mentions shorter than 20 characters", () => {
    const mentions = [
      mention("Short text."),
      mention("Also tiny."),
      mention("This mention is long enough to pass the minimum length filter easily."),
    ];
    expect(deduplicateMentions(mentions)).toHaveLength(1);
  });

  it("preserves the first occurrence of duplicate content", () => {
    const mentions = [
      { text: "This product has really great features and I love it.", id: "first" },
      { text: "This product has really great features and I love it.", id: "second" },
    ];
    const result = deduplicateMentions(mentions);
    expect(result).toHaveLength(1);
    expect((result[0] as typeof mentions[0]).id).toBe("first");
  });

  it("handles mixed duplicates and unique content", () => {
    const mentions = [
      mention("Great product with excellent customer support and quick responses."),
      mention("Great product with excellent customer support and quick responses."),
      mention("Terrible pricing strategy that alienates small business customers."),
      mention("The mobile app needs significant performance improvements overall."),
      mention("The mobile app needs significant performance improvements overall."),
    ];
    const result = deduplicateMentions(mentions);
    expect(result).toHaveLength(3);
  });
});
