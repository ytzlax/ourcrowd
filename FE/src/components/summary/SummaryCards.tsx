import {
  Activity,
  Building2,
  Newspaper,
  SmilePlus,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { useDashboardSummary } from "@/hooks/useDashboardQueries";
import {
  formatDateTime,
  formatInteger,
  formatPercent,
  formatRelativeFromNow,
} from "@/lib/format";
import type { AlertStatus, SentimentBreakdown } from "@/types";
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
      className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
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

      <MetricCard
        title="Daily alert status"
        description={alertDescription(data.alertStatus)}
        icon={Activity}
        footer={<AlertBadge status={data.alertStatus} />}
      >
        {data.alertStatus.lastExecutedAt
          ? formatRelativeFromNow(data.alertStatus.lastExecutedAt)
          : "—"}
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

function AlertBadge({ status }: { status: AlertStatus }) {
  const variant =
    status.status === "success"
      ? "success"
      : status.status === "failed"
        ? "destructive"
        : "warning";

  const label =
    status.status === "success"
      ? "Success"
      : status.status === "failed"
        ? "Failed"
        : "Pending";

  return (
    <div className="mt-3">
      <Badge variant={variant}>{label}</Badge>
    </div>
  );
}

function alertDescription(status: AlertStatus): string {
  if (!status.lastExecutedAt) {
    return "No analysis runs recorded yet";
  }

  return `Last run ${formatDateTime(status.lastExecutedAt)}`;
}
