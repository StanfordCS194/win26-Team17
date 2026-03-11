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

    const selected = selectMentionsForClassification("Slack", mentions, 20);

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

    const selected = selectMentionsForClassification("Slack", mentions, 8);
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

    const selected = selectMentionsForClassification("Slack", mentions, 8);
    const repeatedAuthorCount = selected.filter(
      (item) => item.author === "repeat-author"
    ).length;

    expect(repeatedAuthorCount).toBeLessThanOrEqual(2);
  });

  it("prefers newer mentions within a source when sampling", () => {
    const mentions: RawMention[] = [
      mention(
        {
          source: "reddit",
          author: "older",
          date: "2021-01-01T10:00:00Z",
          text: "Older mention ".repeat(40),
        },
        1
      ),
      mention(
        {
          source: "reddit",
          author: "newer",
          date: "2025-01-01T10:00:00Z",
          text: "Newer mention ".repeat(10),
        },
        2
      ),
    ];

    const selected = selectMentionsForClassification("Slack", mentions, 1);

    expect(selected).toHaveLength(1);
    expect(selected[0].author).toBe("newer");
  });

  it("prefers mentions that explicitly name the product", () => {
    const mentions: RawMention[] = [
      mention(
        {
          source: "reddit",
          author: "generic",
          date: "2025-01-02T10:00:00Z",
          text: "This tool is decent once you learn the workflow.".repeat(6),
        },
        1
      ),
      mention(
        {
          source: "reddit",
          author: "specific",
          date: "2024-01-01T10:00:00Z",
          text: "Slack makes async team communication much easier for us.".repeat(4),
        },
        2
      ),
    ];

    const selected = selectMentionsForClassification("Slack", mentions, 1);

    expect(selected).toHaveLength(1);
    expect(selected[0].author).toBe("specific");
  });
});
