import { Search } from "lucide-react";

import { MentionStatus, type CompanyStatusFilter } from "@/types";

interface CompanyTableToolbarProps {
  search: string;
  status: CompanyStatusFilter;
  onSearchChange: (value: string) => void;
  onStatusChange: (value: CompanyStatusFilter) => void;
  resultCount: number;
}

export function CompanyTableToolbar({
  search,
  status,
  onSearchChange,
  onStatusChange,
  resultCount,
}: CompanyTableToolbarProps) {
  return (
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
  );
}
