import type { RawMention, SourceName } from "./classifier";
import { fuzzyMatchProduct } from "./contentFilter";

const SOURCE_ORDER: SourceName[] = [
  "reddit",
  "hackernews",
  "stackoverflow",
  "devto",
];
const MAX_MENTIONS_PER_AUTHOR = 2;
const TEXT_LENGTH_CAP = 280;

function getDateValue(date: string): number {
  const parsed = Date.parse(date);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function getAuthorKey(author: string): string {
  return author.trim().toLowerCase() || "[unknown]";
}

function sortMentions(
  mentions: RawMention[],
  productName: string
): RawMention[] {
  return [...mentions].sort((left, right) => {
    const rightMatchesProduct = fuzzyMatchProduct(right.text, productName);
    const leftMatchesProduct = fuzzyMatchProduct(left.text, productName);
    if (rightMatchesProduct !== leftMatchesProduct) {
      return Number(rightMatchesProduct) - Number(leftMatchesProduct);
    }

    const rightDate = getDateValue(right.date);
    const leftDate = getDateValue(left.date);
    if (rightDate !== leftDate) {
      return rightDate - leftDate;
    }

    const rightLength = Math.min(right.text.length, TEXT_LENGTH_CAP);
    const leftLength = Math.min(left.text.length, TEXT_LENGTH_CAP);
    if (rightLength !== leftLength) {
      return rightLength - leftLength;
    }
    return right.text.length - left.text.length;
  });
}

export function selectMentionsForClassification(
  productName: string,
  mentions: RawMention[],
  maxMentions: number
): RawMention[] {
  if (mentions.length <= maxMentions) {
    return mentions;
  }

  const groups = new Map<SourceName, RawMention[]>();
  for (const source of SOURCE_ORDER) {
    groups.set(source, []);
  }
  for (const mention of mentions) {
    groups.get(mention.source)?.push(mention);
  }
  for (const source of SOURCE_ORDER) {
    groups.set(source, sortMentions(groups.get(source) || [], productName));
  }

  const authorCounts = new Map<string, number>();
  const selected: RawMention[] = [];
  const deferred: RawMention[] = [];

  while (selected.length < maxMentions) {
    let madeProgress = false;

    for (const source of SOURCE_ORDER) {
      const group = groups.get(source);
      if (!group || group.length === 0) {
        continue;
      }

      while (group.length > 0) {
        const candidate = group.shift()!;
        const authorKey = getAuthorKey(candidate.author);
        const seenCount = authorCounts.get(authorKey) || 0;

        if (seenCount >= MAX_MENTIONS_PER_AUTHOR) {
          deferred.push(candidate);
          continue;
        }

        selected.push(candidate);
        authorCounts.set(authorKey, seenCount + 1);
        madeProgress = true;
        break;
      }

      if (selected.length >= maxMentions) {
        break;
      }
    }

    if (!madeProgress) {
      break;
    }
  }

  if (selected.length >= maxMentions) {
    return selected.slice(0, maxMentions);
  }

  const remaining = sortMentions(
    [
      ...deferred,
      ...SOURCE_ORDER.flatMap((source) => groups.get(source) || []),
    ],
    productName
  );

  for (const mention of remaining) {
    if (selected.length >= maxMentions) {
      break;
    }
    selected.push(mention);
  }

  return selected;
}
