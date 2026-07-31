import { ExternalLink } from "lucide-react";

import { formatDateTime } from "@/lib/format";
import { extractSourceDomain } from "@/lib/url";
import type { Mention } from "@/types";
import { SentimentBadge } from "./SentimentBadge";

interface MentionCardProps {
  mention: Mention;
}

export function MentionCard({ mention }: MentionCardProps) {
  const domain = extractSourceDomain(mention.url);
  const insight = mention.summary.trim() || mention.snippet?.trim() || null;

  return (
    <article className="space-y-3 border-b border-border py-4 last:border-b-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <a
            href={mention.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex items-start gap-1.5 font-medium text-foreground hover:text-primary"
          >
            <span className="leading-snug">{mention.title}</span>
            <ExternalLink
              className="mt-0.5 size-3.5 shrink-0 opacity-50 transition-opacity group-hover:opacity-100"
              aria-hidden
            />
            <span className="sr-only">(opens in new tab)</span>
          </a>
          <p className="text-xs text-muted-foreground">
            {domain}
            <span className="mx-1.5 text-border">·</span>
            {formatDateTime(mention.publishedAt)}
            <span className="mx-1.5 text-border">·</span>
            Score {mention.score}/10
          </p>
        </div>
        <SentimentBadge sentiment={mention.sentiment} />
      </div>

      {insight ? (
        <p className="text-sm leading-relaxed text-muted-foreground">
          {insight}
        </p>
      ) : (
        <p className="text-sm text-muted-foreground italic">
          No LLM insight available for this mention.
        </p>
      )}
    </article>
  );
}
