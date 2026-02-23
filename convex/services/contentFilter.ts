/**
 * Shared content-filtering utilities for identifying software product discussions.
 * Used by Reddit, HackerNews, and other source clients.
 */

export const SOFTWARE_KEYWORDS = [
  "app", "software", "tool", "platform", "service", "product",
  "feature", "pricing", "subscription", "free tier", "alternative",
  "review", "compared", "vs", "switched", "migrated", "using",
  "workflow", "integration", "api", "plugin", "extension",
  "saas", "cloud", "web", "mobile", "desktop", "browser",
  "ux", "ui", "design", "dashboard", "login", "account",
];

export function fuzzyMatchProduct(text: string, productName: string): boolean {
  const lower = text.toLowerCase();
  const productLower = productName.toLowerCase();
  const productWords = productLower.split(/\s+/);

  // Exact match
  if (lower.includes(productLower)) return true;

  // Match individual words for multi-word product names
  if (productWords.length > 1) {
    const allWordsMatch = productWords.every(word => lower.includes(word));
    if (allWordsMatch) return true;
  }

  // Common variations: possessive, plural, hyphenated
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

  // Levenshtein-lite: allow 1 character difference for longer names (>4 chars)
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

export function isLikelySoftwareContent(text: string, productName: string): boolean {
  const lower = text.toLowerCase();

  if (!fuzzyMatchProduct(lower, productName)) return false;

  const keywordMatches = SOFTWARE_KEYWORDS.filter(kw => lower.includes(kw)).length;

  return keywordMatches >= 2;
}
