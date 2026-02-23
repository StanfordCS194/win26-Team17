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

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function matchesWordBoundary(text: string, term: string): boolean {
  const pattern = new RegExp(`\\b${escapeRegex(term)}\\b`, "i");
  return pattern.test(text);
}

export function fuzzyMatchProduct(text: string, productName: string): boolean {
  const lower = text.toLowerCase();
  const productLower = productName.toLowerCase();
  const productWords = productLower.split(/\s+/);

  // Exact word-boundary match
  if (matchesWordBoundary(lower, productLower)) return true;

  // Match individual words for multi-word product names
  if (productWords.length > 1) {
    const allWordsMatch = productWords.every(word => matchesWordBoundary(lower, word));
    if (allWordsMatch) return true;
  }

  // Common variations: possessive, plural, hyphenated
  const variations = [
    productLower + "'s",
    productLower + "s",
    productLower.replace(/\s+/g, "-"),
    productLower.replace(/\s+/g, ""),
  ];

  for (const variant of variations) {
    if (matchesWordBoundary(lower, variant)) return true;
  }

  // Levenshtein-lite: allow 1 character difference for longer names (>5 chars)
  if (productLower.length > 5) {
    const words = lower.split(/\b/);
    for (const word of words) {
      const trimmed = word.trim();
      if (trimmed.length < productLower.length - 1 || trimmed.length > productLower.length + 1) continue;
      let diff = 0;
      const minLen = Math.min(trimmed.length, productLower.length);
      for (let i = 0; i < minLen; i++) {
        if (trimmed[i] !== productLower[i]) diff++;
      }
      diff += Math.abs(trimmed.length - productLower.length);
      if (diff <= 1) return true;
    }
  }

  return false;
}

export function isLikelySoftwareContent(text: string, productName: string): boolean {
  const lower = text.toLowerCase();

  if (!fuzzyMatchProduct(lower, productName)) return false;

  const keywordMatches = SOFTWARE_KEYWORDS.filter(kw => lower.includes(kw)).length;

  // Lower threshold if the product name appears as a standalone word (high confidence match)
  if (matchesWordBoundary(lower, productName.toLowerCase())) {
    return keywordMatches >= 1;
  }

  return keywordMatches >= 2;
}
