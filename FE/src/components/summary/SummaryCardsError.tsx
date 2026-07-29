import { AlertCircle } from "lucide-react";

interface SummaryCardsErrorProps {
  message: string;
  onRetry: () => void;
}

export function SummaryCardsError({ message, onRetry }: SummaryCardsErrorProps) {
  return (
    <div
      role="alert"
      className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-6 text-center"
    >
      <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <AlertCircle className="size-5" aria-hidden />
      </div>
      <p className="text-sm font-medium text-foreground">
        Couldn’t load dashboard summary
      </p>
      <p className="mt-1 text-sm text-muted-foreground">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        Try again
      </button>
    </div>
  );
}
