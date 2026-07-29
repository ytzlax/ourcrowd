import type { SentimentBreakdown, SentimentCounts } from "@/types";

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
