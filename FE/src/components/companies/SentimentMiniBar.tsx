import { toSentimentBreakdown } from "@/lib/sentiment";
import type { SentimentCounts } from "@/types";

interface SentimentMiniBarProps {
  counts: SentimentCounts;
}

export function SentimentMiniBar({ counts }: SentimentMiniBarProps) {
  const breakdown = toSentimentBreakdown(counts);

  if (breakdown.total === 0) {
    return (
      <span className="text-xs text-muted-foreground">No quarterly mentions</span>
    );
  }

  const segments = [
    {
      key: "positive",
      percent: breakdown.positivePercent,
      className: "bg-success",
      label: `${breakdown.positive} positive`,
    },
    {
      key: "neutral",
      percent: breakdown.neutralPercent,
      className: "bg-muted-foreground/40",
      label: `${breakdown.neutral} neutral`,
    },
    {
      key: "negative",
      percent: breakdown.negativePercent,
      className: "bg-destructive",
      label: `${breakdown.negative} negative`,
    },
  ] as const;

  return (
    <div className="min-w-36 space-y-1">
      <div
        className="flex h-1.5 overflow-hidden rounded-full bg-muted"
        title={`+${breakdown.positive} / ~${breakdown.neutral} / -${breakdown.negative}`}
      >
        {segments.map((segment) =>
          segment.percent > 0 ? (
            <div
              key={segment.key}
              className={segment.className}
              style={{ width: `${segment.percent}%` }}
              aria-label={segment.label}
            />
          ) : null,
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        {breakdown.positive}
        <span className="mx-1 text-border">·</span>
        {breakdown.neutral}
        <span className="mx-1 text-border">·</span>
        {breakdown.negative}
      </p>
    </div>
  );
}
