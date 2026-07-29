import { Building2 } from "lucide-react";

interface CompanyTableEmptyProps {
  hasFilters: boolean;
}

export function CompanyTableEmpty({ hasFilters }: CompanyTableEmptyProps) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card px-6 py-12 text-center">
      <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Building2 className="size-5" aria-hidden />
      </div>
      <p className="text-sm font-medium text-foreground">
        {hasFilters ? "No companies match your filters" : "No companies tracked yet"}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        {hasFilters
          ? "Try a different search term or status filter."
          : "Seed portfolio companies in the backend to populate this table."}
      </p>
    </div>
  );
}
