/**
 * Deduplication Module
 *
 * Removes near-identical mentions before classification.
 * Targets 90%+ accuracy on identical/near-identical posts per the PRD.
 */

/**
 * Normalize text for comparison: lowercase, collapse whitespace, trim.
 */
function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Check if two normalized strings are near-duplicates.
 * Returns true if:
 * - Exact match after normalization
 * - One is a substring of the other (handles quoted content)
 * - First 100 characters match (catches reposts with minor trailing differences)
 */
function isDuplicate(a: string, b: string): boolean {
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;
  if (a.length >= 100 && b.length >= 100 && a.slice(0, 100) === b.slice(0, 100))
    return true;
  return false;
}

/**
 * Deduplicate mentions by text content.
 * Filters out mentions shorter than 20 characters after normalization.
 * Preserves the first occurrence of each unique piece of content.
 */
export function deduplicateMentions<T extends { text: string }>(
  mentions: T[]
): T[] {
  const seen: string[] = [];
  const results: T[] = [];

  for (const mention of mentions) {
    const normalized = normalize(mention.text);

    if (normalized.length < 20) continue;

    const duplicate = seen.some((seenText) => isDuplicate(normalized, seenText));

    if (!duplicate) {
      seen.push(normalized);
      results.push(mention);
    }
  }

  return results;
}
