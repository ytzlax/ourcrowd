import { Badge } from "@/components/ui/badge";
import { SentimentType } from "@/types";
import type { SentimentType as SentimentValue } from "@/types";

interface SentimentBadgeProps {
  sentiment: SentimentValue;
}

export function SentimentBadge({ sentiment }: SentimentBadgeProps) {
  const variant =
    sentiment === SentimentType.POSITIVE
      ? "success"
      : sentiment === SentimentType.NEGATIVE
        ? "destructive"
        : "secondary";

  const label =
    sentiment === SentimentType.POSITIVE
      ? "Positive"
      : sentiment === SentimentType.NEGATIVE
        ? "Negative"
        : "Neutral";

  return <Badge variant={variant}>{label}</Badge>;
}
