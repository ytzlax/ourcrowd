import { useDeferredValue, useState } from "react";

import { useCompanies } from "@/hooks/useDashboardQueries";
import { cn } from "@/lib/utils";
import {
  MentionStatus,
  type CompanyStatusFilter,
  type CompanyWithStats,
} from "@/types";
import { CompanyTableEmpty } from "./CompanyTableEmpty";
import { CompanyTableError } from "./CompanyTableError";
import { CompanyTableSkeleton } from "./CompanyTableSkeleton";
import { CompanyTableToolbar } from "./CompanyTableToolbar";
import { MentionStatusBadge } from "./MentionStatusBadge";
import { SentimentMiniBar } from "./SentimentMiniBar";

interface CompanyTableProps {
  selectedCompanyId: string | null;
  onSelectCompany: (company: CompanyWithStats) => void;
}

export function CompanyTable({
  selectedCompanyId,
  onSelectCompany,
}: CompanyTableProps) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<CompanyStatusFilter>("all");
  const deferredSearch = useDeferredValue(search.trim());

  const queryParams = {
    search: deferredSearch || undefined,
    status,
  };

  const { data, isPending, isError, error, refetch, isFetching } =
    useCompanies(queryParams);

  const companies = data?.companies ?? [];
  const hasFilters =
    deferredSearch.length > 0 || status !== "all";

  return (
    <div className="space-y-4">
      <CompanyTableToolbar
        search={search}
        status={status}
        onSearchChange={setSearch}
        onStatusChange={setStatus}
        resultCount={companies.length}
      />

      {isPending ? <CompanyTableSkeleton /> : null}

      {isError ? (
        <CompanyTableError
          message={error?.message ?? "Unknown error"}
          onRetry={() => {
            void refetch();
          }}
        />
      ) : null}

      {!isPending && !isError && companies.length === 0 ? (
        <CompanyTableEmpty hasFilters={hasFilters} />
      ) : null}

      {!isPending && !isError && companies.length > 0 ? (
        <div
          className="overflow-x-auto rounded-xl border border-border bg-card"
          aria-busy={isFetching}
        >
          <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
            <thead className="border-b border-border bg-muted/40 text-xs tracking-wide text-muted-foreground uppercase">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">
                  Company
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Mention status
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Sentiment
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Domain
                </th>
              </tr>
            </thead>
            <tbody>
              {companies.map((company) => {
                const selected = company.id === selectedCompanyId;

                return (
                  <tr
                    key={company.id}
                    tabIndex={0}
                    aria-selected={selected}
                    onClick={() => onSelectCompany(company)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onSelectCompany(company);
                      }
                    }}
                    className={cn(
                      "cursor-pointer border-b border-border last:border-b-0 outline-none transition-colors",
                      "hover:bg-muted/50 focus-visible:bg-muted/60",
                      selected && "bg-primary/5",
                    )}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">
                        {company.name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {coverageHint(company)}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <MentionStatusBadge company={company} />
                    </td>
                    <td className="px-4 py-3">
                      <SentimentMiniBar counts={company.sentimentCounts} />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {company.domain}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

function coverageHint(company: CompanyWithStats): string {
  if (company.status === MentionStatus.NO_COVERAGE_FOUND) {
    return "Awaiting relevant press coverage";
  }

  const days = company.daysSinceLastMention;
  if (days === null) {
    return "Coverage status unavailable";
  }

  return days === 0 ? "Last mention today" : `Last mention ${days}d ago`;
}
