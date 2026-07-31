/** Mirrors BE/src/analysis/sentiment_type.ts */
export const SentimentType = {
  POSITIVE: "positive",
  NEUTRAL: "neutral",
  NEGATIVE: "negative",
} as const;

export type SentimentType =
  (typeof SentimentType)[keyof typeof SentimentType];

/** Mirrors BE/src/db/types.ts */
export const MentionStatus = {
  LAST_MENTIONED_X_DAYS_AGO: "LAST_MENTIONED_X_DAYS_AGO",
  NO_COVERAGE_FOUND: "NO_COVERAGE_FOUND",
} as const;

export type MentionStatus =
  (typeof MentionStatus)[keyof typeof MentionStatus];

export const CompanyType = {
  B2B: "B2B",
  B2C: "B2C",
  ENTERPRISE: "Enterprise",
  OPEN_SOURCE: "OpenSource",
} as const;

export type CompanyType = (typeof CompanyType)[keyof typeof CompanyType];

export const MediaPresence = {
  HIGH_MAINSTREAM: "high_mainstream",
  NICHE_TECH: "niche_tech",
  LOW_PR: "low_pr",
} as const;

export type MediaPresence =
  (typeof MediaPresence)[keyof typeof MediaPresence];

export type IsoDateTimeString = string;

export interface Company {
  id: string;
  name: string;
  companyType: CompanyType;
  mediaPresence: MediaPresence;
  lastMentionedAt: IsoDateTimeString | null;
  status: MentionStatus;
  createdAt: IsoDateTimeString;
  updatedAt: IsoDateTimeString;
}

export interface Mention {
  id: string;
  companyId: string;
  title: string;
  url: string;
  snippet: string | null;
  publishedAt: IsoDateTimeString;
  sentiment: SentimentType;
  summary: string;
  /** Relevance score from analysis (1–10). */
  score: number;
  analyzedAt: IsoDateTimeString;
  createdAt: IsoDateTimeString;
}

export interface SentimentCounts {
  positive: number;
  neutral: number;
  negative: number;
}

export interface SentimentBreakdown extends SentimentCounts {
  total: number;
  positivePercent: number;
  neutralPercent: number;
  negativePercent: number;
}

export interface CompanyMentionStatusResult {
  companyId: string;
  status: MentionStatus;
  lastMentionedAt: IsoDateTimeString | null;
  daysSinceLastMention: number | null;
}

export interface CompanyWithStats extends Company {
  daysSinceLastMention: number | null;
  sentimentCounts: SentimentCounts;
}

export type CompanyStatusFilter = MentionStatus | "all";

export interface CompaniesQueryParams {
  search?: string;
  status?: CompanyStatusFilter;
  /** When > 1, only companies with at least one quarterly mention at/above this score. */
  minScore?: number;
}
