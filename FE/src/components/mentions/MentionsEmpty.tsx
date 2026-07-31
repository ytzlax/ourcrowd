import { Newspaper } from "lucide-react";

interface MentionsEmptyProps {
  /** When true, mentions exist but none meet the score filter. */
  filtered?: boolean;
  minScore?: number;
}

export function MentionsEmpty({
  filtered = false,
  minScore,
}: MentionsEmptyProps) {
  return (
    <div className="flex flex-col items-center px-4 py-16 text-center">
      <div className="mb-3 flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Newspaper className="size-5" aria-hidden />
      </div>
      <p className="text-sm font-medium text-foreground">
        {filtered
          ? "No mentions at this score"
          : "No coverage found this quarter"}
      </p>
      <p className="mt-1 max-w-xs text-sm text-muted-foreground">
        {filtered
          ? `No mentions with score ${minScore ?? ""} or higher. Try lowering the minimum score.`
          : "There are no press mentions in the last 90 days for this company."}
      </p>
    </div>
  );
}
