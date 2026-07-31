import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardHeader } from "@/components/ui/card";

export function SummaryCardsSkeleton() {
  return (
    <div
      className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
      aria-busy="true"
      aria-label="Loading dashboard summary"
    >
      {Array.from({ length: 3 }, (_, index) => (
        <Card key={index}>
          <CardHeader className="space-y-3">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-3 w-36" />
          </CardHeader>
        </Card>
      ))}
    </div>
  );
}
