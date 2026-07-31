import { Search } from "lucide-react";

import { MentionStatus, type CompanyStatusFilter } from "@/types";

const SCORE_MIN = 1;
const SCORE_MAX = 10;

interface CompanyTableToolbarProps {
  search: string;
  status: CompanyStatusFilter;
  minScore: number;
  onSearchChange: (value: string) => void;
  onStatusChange: (value: CompanyStatusFilter) => void;
  onMinScoreChange: (value: number) => void;
  resultCount: number;
}

export function CompanyTableToolbar({
  search,
  status,
  minScore,
  onSearchChange,
  onStatusChange,
  onMinScoreChange,
  resultCount,
}: CompanyTableToolbarProps) {
  const scoreFilterId = "portfolio-min-score";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="relative min-w-0 flex-1 sm:max-w-sm">
          <label htmlFor="company-search" className="sr-only">
            Search companies
          </label>
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <input
            id="company-search"
            type="search"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search by name"
            className="h-9 w-full rounded-md border border-border bg-card pr-3 pl-9 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary/30"
          />
        </div>

        <div className="flex items-center gap-3">
          <div>
            <label
              htmlFor="company-status-filter"
              className="mb-1 block text-xs font-medium text-muted-foreground"
            >
              Status
            </label>
            <select
              id="company-status-filter"
              value={status}
              onChange={(event) =>
                onStatusChange(event.target.value as CompanyStatusFilter)
              }
              className="h-9 rounded-md border border-border bg-card px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            >
              <option value="all">All statuses</option>
              <option value={MentionStatus.LAST_MENTIONED_X_DAYS_AGO}>
                Recent coverage
              </option>
              <option value={MentionStatus.NO_COVERAGE_FOUND}>
                No coverage
              </option>
            </select>
          </div>
          <p className="pb-1.5 text-xs text-muted-foreground">
            {resultCount} {resultCount === 1 ? "company" : "companies"}
          </p>
        </div>
      </div>

      <div className="max-w-sm space-y-2">
        <div className="flex items-center justify-between gap-3">
          <label
            htmlFor={scoreFilterId}
            className="text-xs font-medium text-muted-foreground"
          >
            Minimum mention score
          </label>
          <span
            className="text-xs font-medium tabular-nums text-foreground"
            aria-live="polite"
          >
            {minScore}+
          </span>
        </div>
        <input
          id={scoreFilterId}
          type="range"
          min={SCORE_MIN}
          max={SCORE_MAX}
          step={1}
          value={minScore}
          onChange={(event) =>
            onMinScoreChange(Number.parseInt(event.target.value, 10))
          }
          className="h-2 w-full cursor-pointer accent-primary"
          aria-valuemin={SCORE_MIN}
          aria-valuemax={SCORE_MAX}
          aria-valuenow={minScore}
          aria-valuetext={`Minimum score ${minScore} of ${SCORE_MAX}`}
        />
        <div className="flex justify-between text-[0.65rem] text-muted-foreground">
          <span>{SCORE_MIN}</span>
          <span>{SCORE_MAX}</span>
        </div>
      </div>
    </div>
  );
}
