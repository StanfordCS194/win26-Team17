import type { ClassifiedMention } from "./scoring";

export interface ReportInsight {
  title: string;
  description: string;
  frequency: number;
  quotes: Array<{
    text: string;
    source: ClassifiedMention["source"];
    author: string;
    date: string;
    url: string;
  }>;
}

export interface SynthesizedReport {
  mode: "deterministic" | "llm";
  summary: string;
  strengths: ReportInsight[];
  issues: ReportInsight[];
}

type ThemeKey = "Price" | "Quality" | "Durability" | "Usability" | "General";
type SupportedSentiment = "positive" | "negative";

const MAX_THEMES_PER_SENTIMENT = 3;
const MAX_QUOTES_PER_INSIGHT = 5;

const THEME_COPY: Record<
  ThemeKey,
  Record<SupportedSentiment, { title: string; description: string }>
> = {
  Price: {
    positive: {
      title: "Good Value for Money",
      description:
        "Users describe the pricing and overall value as reasonable for what the product delivers.",
    },
    negative: {
      title: "Pricing & Value Friction",
      description:
        "Users raise concerns about pricing, free-tier limits, or whether the product feels worth the cost.",
    },
  },
  Quality: {
    positive: {
      title: "Reliable Product Quality",
      description:
        "Users call out product polish, stability, or overall quality as a meaningful strength.",
    },
    negative: {
      title: "Reliability & Quality Problems",
      description:
        "Users report bugs, instability, or a lack of polish that hurts confidence in the product.",
    },
  },
  Durability: {
    positive: {
      title: "Holds Up Over Time",
      description:
        "Users describe the product as dependable over longer periods of use.",
    },
    negative: {
      title: "Longevity Concerns",
      description:
        "Users question how well the product holds up over time or under sustained use.",
    },
  },
  Usability: {
    positive: {
      title: "Easy Daily Workflow",
      description:
        "Users consistently praise ease of use, navigation, and how smoothly the product fits into their workflow.",
    },
    negative: {
      title: "Workflow & UX Friction",
      description:
        "Users repeatedly describe the product as awkward, confusing, or frustrating to use day to day.",
    },
  },
  General: {
    positive: {
      title: "Positive Overall Experience",
      description:
        "Users express broad satisfaction with the product beyond any one specific feature area.",
    },
    negative: {
      title: "General Product Frustration",
      description:
        "Users express broad dissatisfaction with the product across multiple parts of the experience.",
    },
  },
};

function compareMentions(left: ClassifiedMention, right: ClassifiedMention): number {
  const leftIntensity = Math.abs(left.classification.sentimentScore - 50);
  const rightIntensity = Math.abs(right.classification.sentimentScore - 50);
  if (rightIntensity !== leftIntensity) {
    return rightIntensity - leftIntensity;
  }
  if (right.text.length !== left.text.length) {
    return right.text.length - left.text.length;
  }
  return right.date.localeCompare(left.date);
}

function buildInsights(
  mentions: ClassifiedMention[],
  sentiment: SupportedSentiment
): ReportInsight[] {
  const themedMentions = new Map<ThemeKey, ClassifiedMention[]>();

  for (const mention of mentions) {
    if (
      !mention.classification.relevant ||
      mention.classification.sentiment !== sentiment
    ) {
      continue;
    }

    const themeKeys: ThemeKey[] =
      mention.classification.aspects.length > 0
        ? (mention.classification.aspects as ThemeKey[])
        : ["General"];
    for (const themeKey of themeKeys) {
      const existing = themedMentions.get(themeKey) ?? [];
      existing.push(mention);
      themedMentions.set(themeKey, existing);
    }
  }

  return [...themedMentions.entries()]
    .map(([themeKey, items]) => ({
      themeKey,
      items: [...items].sort(compareMentions),
      avgIntensity:
        items.reduce(
          (sum, item) => sum + Math.abs(item.classification.sentimentScore - 50),
          0
        ) / items.length,
    }))
    .sort((left, right) => {
      if (right.items.length !== left.items.length) {
        return right.items.length - left.items.length;
      }
      return right.avgIntensity - left.avgIntensity;
    })
    .slice(0, MAX_THEMES_PER_SENTIMENT)
    .map(({ themeKey, items }) => ({
      title: THEME_COPY[themeKey][sentiment].title,
      description: THEME_COPY[themeKey][sentiment].description,
      frequency: items.length,
      quotes: items.slice(0, MAX_QUOTES_PER_INSIGHT).map((item) => ({
        text: item.text,
        source: item.source,
        author: item.author,
        date: item.date,
        url: item.url,
      })),
    }));
}

function describeOverallSentiment(overallScore: number | null): string {
  if (overallScore === null) return "undetermined (not enough data)";
  if (overallScore >= 65) return "predominantly positive";
  if (overallScore <= 35) return "predominantly negative";
  return "mixed";
}

function pickBestAspect(
  aspects: Array<{ name: string; score: number | null; mentions: number }>,
  direction: "highest" | "lowest"
): { name: string; score: number; mentions: number } | null {
  const scoredAspects = aspects.filter(
    (aspect): aspect is { name: string; score: number; mentions: number } =>
      aspect.score !== null && aspect.mentions > 0
  );
  if (scoredAspects.length === 0) {
    return null;
  }

  return [...scoredAspects].sort((left, right) =>
    direction === "highest" ? right.score - left.score : left.score - right.score
  )[0];
}

function buildSummary(
  productName: string,
  overallScore: number | null,
  aspects: Array<{ name: string; score: number | null; mentions: number }>,
  strengths: ReportInsight[],
  issues: ReportInsight[]
): string {
  const sentences = [
    overallScore !== null
      ? `Overall sentiment for ${productName} is ${describeOverallSentiment(overallScore)}, with a score of ${overallScore}/100.`
      : `Not enough data to determine overall sentiment for ${productName}.`,
  ];

  if (strengths[0] && issues[0]) {
    sentences.push(
      `${strengths[0].title} is the clearest strength, while ${issues[0].title.toLowerCase()} is the biggest source of friction.`
    );
    return sentences.join(" ");
  }

  const bestAspect = pickBestAspect(aspects, "highest");
  const worstAspect = pickBestAspect(aspects, "lowest");

  if (issues[0]) {
    sentences.push(
      `${issues[0].title} stands out as the main concern in the sampled feedback.`
    );
  } else if (strengths[0]) {
    sentences.push(
      `${strengths[0].title} stands out as the most consistent positive theme.`
    );
  } else if (bestAspect && worstAspect && bestAspect.name !== worstAspect.name) {
    sentences.push(
      `Feedback is strongest around ${bestAspect.name.toLowerCase()} and weakest around ${worstAspect.name.toLowerCase()}.`
    );
  } else {
    sentences.push(
      "The sampled feedback is mostly neutral or too diffuse to produce a strong theme split."
    );
  }

  return sentences.join(" ");
}

export function synthesizeReportDeterministically(
  productName: string,
  mentions: ClassifiedMention[],
  scores: {
    overallScore: number | null;
    aspects: Array<{ name: string; score: number | null; mentions: number }>;
  }
): SynthesizedReport {
  const relevantMentions = mentions.filter((mention) => mention.classification.relevant);

  if (relevantMentions.length === 0) {
    return {
      mode: "deterministic",
      summary: `No user feedback found for "${productName}".`,
      strengths: [],
      issues: [],
    };
  }

  const strengths = buildInsights(relevantMentions, "positive");
  const issues = buildInsights(relevantMentions, "negative");

  return {
    mode: "deterministic",
    summary: buildSummary(
      productName,
      scores.overallScore,
      scores.aspects,
      strengths,
      issues
    ),
    strengths,
    issues,
  };
}
