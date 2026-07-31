import { Building2, Newspaper, SmilePlus } from "lucide-react";

import { useDashboardSummary } from "@/hooks/useDashboardQueries";
import { formatInteger, formatPercent } from "@/lib/format";
import type { SentimentBreakdown } from "@/types";
import { MetricCard } from "./MetricCard";
import { SummaryCardsError } from "./SummaryCardsError";
import { SummaryCardsSkeleton } from "./SummaryCardsSkeleton";

export function SummaryCards() {
  const { data, isPending, isError, error, refetch, isFetching } =
    useDashboardSummary();

  if (isPending) {
    return <SummaryCardsSkeleton />;
  }

  if (isError || !data) {
    return (
      <SummaryCardsError
        message={error?.message ?? "Unknown error"}
        onRetry={() => {
          void refetch();
        }}
      />
    );
  }

  return (
    <div
      className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
      aria-busy={isFetching}
    >
      <MetricCard
        title="Tracked companies"
        description="Portfolio companies monitored"
        icon={Building2}
      >
        {formatInteger(data.totalCompanies)}
      </MetricCard>

      <MetricCard
        title="Quarterly mentions"
        description="Press coverage in the last 90 days"
        icon={Newspaper}
      >
        {formatInteger(data.quarterlyMentionCount)}
      </MetricCard>

      <MetricCard
        title="Sentiment breakdown"
        description="Share of quarterly mentions"
        icon={SmilePlus}
        footer={<SentimentBars breakdown={data.sentimentBreakdown} />}
      >
        {formatInteger(data.sentimentBreakdown.total)}
      </MetricCard>
    </div>
  );
}

function SentimentBars({ breakdown }: { breakdown: SentimentBreakdown }) {
  const segments = [
    {
      key: "positive",
      label: "Positive",
      count: breakdown.positive,
      percent: breakdown.positivePercent,
      className: "bg-success",
    },
    {
      key: "neutral",
      label: "Neutral",
      count: breakdown.neutral,
      percent: breakdown.neutralPercent,
      className: "bg-muted-foreground/40",
    },
    {
      key: "negative",
      label: "Negative",
      count: breakdown.negative,
      percent: breakdown.negativePercent,
      className: "bg-destructive",
    },
  ] as const;

  return (
    <div className="mt-3 space-y-2">
      <div className="flex h-2 overflow-hidden rounded-full bg-muted">
        {segments.map((segment) =>
          segment.percent > 0 ? (
            <div
              key={segment.key}
              className={segment.className}
              style={{ width: `${segment.percent}%` }}
              title={`${segment.label}: ${segment.count}`}
            />
          ) : null,
        )}
      </div>
      <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {segments.map((segment) => (
          <li key={segment.key}>
            <span className="font-medium text-foreground">{segment.count}</span>{" "}
            {segment.label} ({formatPercent(segment.percent)})
          </li>
        ))}
      </ul>
    </div>
  );
}
