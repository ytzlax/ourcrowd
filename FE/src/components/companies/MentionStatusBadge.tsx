import { Badge } from "@/components/ui/badge";
import type { CompanyWithStats } from "@/types";
import {
  formatMentionStatusLabel,
  isInactiveCoverage,
} from "./mentionStatus";

interface MentionStatusBadgeProps {
  company: CompanyWithStats;
}

export function MentionStatusBadge({ company }: MentionStatusBadgeProps) {
  const inactive = isInactiveCoverage(company);

  return (
    <Badge variant={inactive ? "destructive" : "success"}>
      {formatMentionStatusLabel(company)}
    </Badge>
  );
}
