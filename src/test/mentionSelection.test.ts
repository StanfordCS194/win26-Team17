import { describe, expect, it } from "vitest";
import { selectMentionsForClassification } from "../../convex/services/mentionSelection";
import type { RawMention } from "../../convex/services/classifier";

function mention(
  overrides: Partial<RawMention> = {},
  index = 0
): RawMention {
  return {
    text: `Mention ${index} `.repeat(20),
    author: `author-${index}`,
    date: `2024-01-${String((index % 9) + 1).padStart(2, "0")}T10:00:00Z`,
    url: `https://example.com/${index}`,
    source: "reddit",
    ...overrides,
  };
}

describe("selectMentionsForClassification", () => {
  it("caps the total number of mentions", () => {
    const mentions = Array.from({ length: 100 }, (_, index) => mention({}, index));

    const selected = selectMentionsForClassification(mentions, 20);

    expect(selected).toHaveLength(20);
  });

  it("keeps multiple sources represented when sampling", () => {
    const mentions: RawMention[] = [
      ...Array.from({ length: 10 }, (_, index) =>
        mention({ source: "reddit", author: `reddit-${index}` }, index)
      ),
      ...Array.from({ length: 10 }, (_, index) =>
        mention({ source: "hackernews", author: `hn-${index}` }, index + 10)
      ),
      ...Array.from({ length: 10 }, (_, index) =>
        mention({ source: "stackoverflow", author: `so-${index}` }, index + 20)
      ),
      ...Array.from({ length: 10 }, (_, index) =>
        mention({ source: "devto", author: `dev-${index}` }, index + 30)
      ),
    ];

    const selected = selectMentionsForClassification(mentions, 8);
    const selectedSources = new Set(selected.map((item) => item.source));

    expect(selectedSources).toEqual(
      new Set(["reddit", "hackernews", "stackoverflow", "devto"])
    );
  });

  it("limits domination by a single author when sampling", () => {
    const mentions: RawMention[] = [
      ...Array.from({ length: 10 }, (_, index) =>
        mention({ author: "repeat-author", source: "reddit" }, index)
      ),
      ...Array.from({ length: 10 }, (_, index) =>
        mention({ author: `other-${index}`, source: "hackernews" }, index + 10)
      ),
    ];

    const selected = selectMentionsForClassification(mentions, 8);
    const repeatedAuthorCount = selected.filter(
      (item) => item.author === "repeat-author"
    ).length;

    expect(repeatedAuthorCount).toBeLessThanOrEqual(2);
  });
});
