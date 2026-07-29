import { Skeleton } from "@/components/ui/skeleton";

export function CompanyTableSkeleton() {
  return (
    <div
      className="overflow-hidden rounded-xl border border-border bg-card"
      aria-busy="true"
      aria-label="Loading companies"
    >
      <div className="border-b border-border px-4 py-3">
        <Skeleton className="h-4 w-40" />
      </div>
      <ul className="divide-y divide-border">
        {Array.from({ length: 4 }, (_, index) => (
          <li key={index} className="grid gap-3 px-4 py-4 sm:grid-cols-4">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-2 w-full" />
            <Skeleton className="h-4 w-24" />
          </li>
        ))}
      </ul>
    </div>
  );
}
