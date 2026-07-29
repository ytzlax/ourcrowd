import { MentionStatus } from "@/types";
import type { CompanyWithStats } from "@/types";

const STALE_COVERAGE_DAYS = 90;

export function isInactiveCoverage(company: CompanyWithStats): boolean {
  if (company.status === MentionStatus.NO_COVERAGE_FOUND) {
    return true;
  }

  return (
    company.daysSinceLastMention !== null &&
    company.daysSinceLastMention > STALE_COVERAGE_DAYS
  );
}

export function formatMentionStatusLabel(company: CompanyWithStats): string {
  if (isInactiveCoverage(company)) {
    if (
      company.daysSinceLastMention !== null &&
      company.daysSinceLastMention > STALE_COVERAGE_DAYS
    ) {
      return `No coverage for ${company.daysSinceLastMention} days`;
    }

    return "No coverage found";
  }

  const days = company.daysSinceLastMention ?? 0;
  if (days === 0) {
    return "Mentioned today";
  }

  if (days === 1) {
    return "Mentioned 1 day ago";
  }

  return `Mentioned ${days} days ago`;
}
