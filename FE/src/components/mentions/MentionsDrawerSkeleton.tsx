import { Skeleton } from "@/components/ui/skeleton";

export function MentionsDrawerSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading mentions">
      {Array.from({ length: 3 }, (_, index) => (
        <div key={index} className="space-y-2 border-b border-border py-4">
          <Skeleton className="h-4 w-[80%]" />
          <Skeleton className="h-3 w-40" />
          <Skeleton className="h-16 w-full" />
        </div>
      ))}
    </div>
  );
}
