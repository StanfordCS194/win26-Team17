import { describe, it, expect } from "vitest";

// Test the fuzzy matching logic (copied from reddit.ts for testing)
function fuzzyMatchProduct(text: string, productName: string): boolean {
  const lower = text.toLowerCase();
  const productLower = productName.toLowerCase();
  const productWords = productLower.split(/\s+/);

  if (lower.includes(productLower)) return true;

  if (productWords.length > 1) {
    const allWordsMatch = productWords.every(word => lower.includes(word));
    if (allWordsMatch) return true;
  }

  const variations = [
    productLower + "'s",
    productLower + "s",
    productLower + "'",
    productLower.replace(/\s+/g, "-"),
    productLower.replace(/\s+/g, ""),
  ];

  for (const variant of variations) {
    if (lower.includes(variant)) return true;
  }

  if (productLower.length > 4) {
    const words = lower.split(/\s+/);
    for (const word of words) {
      if (word.length >= productLower.length - 1 && word.length <= productLower.length + 1) {
        let diff = 0;
        const minLen = Math.min(word.length, productLower.length);
        for (let i = 0; i < minLen; i++) {
          if (word[i] !== productLower[i]) diff++;
        }
        diff += Math.abs(word.length - productLower.length);
        if (diff <= 1) return true;
      }
    }
  }

  return false;
}

// Test validation logic
function validateProductName(name: string): { valid: boolean; error?: string; normalized?: string } {
  const trimmed = name.trim();

  if (trimmed.length < 2) {
    return { valid: false, error: "Product name must be at least 2 characters" };
  }

  if (trimmed.length > 100) {
    return { valid: false, error: "Product name must be less than 100 characters" };
  }

  const sanitized = trimmed.replace(/[<>{}[\]\\]/g, "").trim();

  if (sanitized.length === 0) {
    return { valid: false, error: "Product name contains invalid characters" };
  }

  return { valid: true, normalized: sanitized };
}

describe("Fuzzy Matching", () => {
  it("should match exact product name", () => {
    expect(fuzzyMatchProduct("I love using Notion for notes", "Notion")).toBe(true);
    expect(fuzzyMatchProduct("Slack is great for teams", "Slack")).toBe(true);
  });

  it("should match possessive forms", () => {
    expect(fuzzyMatchProduct("Notion's interface is clean", "Notion")).toBe(true);
    expect(fuzzyMatchProduct("I like Slack's features", "Slack")).toBe(true);
  });

  it("should match plural/typo forms", () => {
    expect(fuzzyMatchProduct("Using multiple Notions", "Notion")).toBe(true);
  });

  it("should match multi-word products", () => {
    expect(fuzzyMatchProduct("I use Visual Studio Code daily", "Visual Studio Code")).toBe(true);
    // Note: current implementation matches if all words are present (order-independent)
    expect(fuzzyMatchProduct("Visual Code Studio is good", "Visual Studio Code")).toBe(true);
  });

  it("should match hyphenated versions", () => {
    expect(fuzzyMatchProduct("visual-studio-code is my editor", "Visual Studio Code")).toBe(true);
  });

  it("should match with 1 character typo for longer names", () => {
    expect(fuzzyMatchProduct("I use Notiom every day", "Notion")).toBe(true); // 1 char diff: m vs n
    expect(fuzzyMatchProduct("I use Notio every day", "Notion")).toBe(true); // 1 char missing
  });

  it("should not match unrelated text", () => {
    expect(fuzzyMatchProduct("I love apples and oranges", "Notion")).toBe(false);
    expect(fuzzyMatchProduct("The weather is nice today", "Slack")).toBe(false);
  });

  it("should be case insensitive", () => {
    expect(fuzzyMatchProduct("NOTION is great", "notion")).toBe(true);
    expect(fuzzyMatchProduct("notion is great", "NOTION")).toBe(true);
  });
});

describe("Product Name Validation", () => {
  it("should accept valid product names", () => {
    expect(validateProductName("Notion")).toEqual({ valid: true, normalized: "Notion" });
    expect(validateProductName("Visual Studio Code")).toEqual({ valid: true, normalized: "Visual Studio Code" });
    expect(validateProductName("  Slack  ")).toEqual({ valid: true, normalized: "Slack" });
  });

  it("should reject too short names", () => {
    expect(validateProductName("a").valid).toBe(false);
    expect(validateProductName("").valid).toBe(false);
  });

  it("should reject too long names", () => {
    const longName = "a".repeat(101);
    expect(validateProductName(longName).valid).toBe(false);
  });

  it("should sanitize dangerous characters", () => {
    expect(validateProductName("Notion<script>")).toEqual({ valid: true, normalized: "Notionscript" });
    expect(validateProductName("Slack{test}")).toEqual({ valid: true, normalized: "Slacktest" });
  });

  it("should reject names that are only dangerous characters", () => {
    expect(validateProductName("<>{}[]").valid).toBe(false);
  });
});
