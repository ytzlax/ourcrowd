import { useEffect, useRef } from "react";
import { AlertCircle, X } from "lucide-react";

import { MentionStatusBadge } from "@/components/companies/MentionStatusBadge";
import { useCompanyMentions } from "@/hooks/useDashboardQueries";
import type { CompanyWithStats } from "@/types";
import { MentionCard } from "./MentionCard";
import { MentionsDrawerSkeleton } from "./MentionsDrawerSkeleton";
import { MentionsEmpty } from "./MentionsEmpty";

const SCORE_MIN = 1;

interface MentionsDrawerProps {
  company: CompanyWithStats | null;
  minScore: number;
  onClose: () => void;
}

export function MentionsDrawer({
  company,
  minScore,
  onClose,
}: MentionsDrawerProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const open = company !== null;

  const { data, isPending, isError, error, refetch } = useCompanyMentions(
    company?.id ?? null,
  );

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }

    if (open && !dialog.open) {
      dialog.showModal();
      return;
    }

    if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }

    // Fallback light-dismiss for browsers without closedby support (e.g. Safari).
    if ("closedBy" in HTMLDialogElement.prototype) {
      return;
    }

    const onClick = (event: MouseEvent) => {
      if (event.target !== dialog) {
        return;
      }

      const rect = dialog.getBoundingClientRect();
      const insideContent =
        rect.top <= event.clientY &&
        event.clientY <= rect.top + rect.height &&
        rect.left <= event.clientX &&
        event.clientX <= rect.left + rect.width;

      if (!insideContent) {
        dialog.close();
      }
    };

    dialog.addEventListener("click", onClick);
    return () => dialog.removeEventListener("click", onClick);
  }, []);

  const mentions = data?.mentions ?? [];
  const filteredMentions = mentions.filter(
    (mention) => mention.score >= minScore,
  );
  const titleId = "mentions-drawer-title";

  return (
    <dialog
      ref={dialogRef}
      className="mentions-drawer"
      closedby="any"
      aria-labelledby={titleId}
      onClose={onClose}
    >
      {company ? (
        <div className="flex h-full flex-col">
          <header className="shrink-0 border-b border-border px-5 py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-2">
                <p className="text-xs font-semibold tracking-[0.12em] text-primary uppercase">
                  Quarterly coverage
                </p>
                <h2
                  id={titleId}
                  className="font-display text-xl font-semibold tracking-tight text-foreground"
                >
                  {company.name}
                </h2>
                <MentionStatusBadge company={company} />
                {minScore > SCORE_MIN ? (
                  <p className="text-xs text-muted-foreground">
                    Showing score {minScore}+
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Close mentions panel"
              >
                <X className="size-4" />
              </button>
            </div>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto px-5">
            {isPending ? <MentionsDrawerSkeleton /> : null}

            {isError ? (
              <div role="alert" className="py-10 text-center">
                <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                  <AlertCircle className="size-5" aria-hidden />
                </div>
                <p className="text-sm font-medium text-foreground">
                  Couldn’t load mentions
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {error?.message ?? "Unknown error"}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    void refetch();
                  }}
                  className="mt-4 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  Try again
                </button>
              </div>
            ) : null}

            {!isPending && !isError && mentions.length === 0 ? (
              <MentionsEmpty />
            ) : null}

            {!isPending &&
            !isError &&
            mentions.length > 0 &&
            filteredMentions.length === 0 ? (
              <MentionsEmpty filtered minScore={minScore} />
            ) : null}

            {!isPending && !isError && filteredMentions.length > 0 ? (
              <div>
                <p className="pt-4 text-xs text-muted-foreground">
                  {filteredMentions.length}{" "}
                  {filteredMentions.length === 1 ? "mention" : "mentions"}
                  {minScore > SCORE_MIN
                    ? ` with score ${minScore}+`
                    : " in the last 90 days"}
                </p>
                {filteredMentions.map((mention) => (
                  <MentionCard key={mention.id} mention={mention} />
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </dialog>
  );
}
