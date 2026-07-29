import { SentimentType } from "../analysis/sentiment_type.js";
import type { Mention, SentimentBreakdown, SentimentCounts } from "./types.js";

export function emptySentimentCounts(): SentimentCounts {
  return {
    positive: 0,
    neutral: 0,
    negative: 0,
  };
}

export function countSentiments(mentions: Mention[]): SentimentCounts {
  const counts = emptySentimentCounts();

  for (const mention of mentions) {
    switch (mention.sentiment) {
      case SentimentType.POSITIVE:
        counts.positive += 1;
        break;
      case SentimentType.NEUTRAL:
        counts.neutral += 1;
        break;
      case SentimentType.NEGATIVE:
        counts.negative += 1;
        break;
    }
  }

  return counts;
}

export function toSentimentBreakdown(counts: SentimentCounts): SentimentBreakdown {
  const total = counts.positive + counts.neutral + counts.negative;

  return {
    ...counts,
    total,
    positivePercent: percentOf(counts.positive, total),
    neutralPercent: percentOf(counts.neutral, total),
    negativePercent: percentOf(counts.negative, total),
  };
}

function percentOf(part: number, total: number): number {
  if (total === 0) {
    return 0;
  }

  return Math.round((part / total) * 1000) / 10;
}
