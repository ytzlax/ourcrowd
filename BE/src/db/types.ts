import { SentimentType } from "../analysis/sentiment_type.js";

export { SentimentType };

export enum MentionStatus {
  LAST_MENTIONED_X_DAYS_AGO = "LAST_MENTIONED_X_DAYS_AGO",
  NO_COVERAGE_FOUND = "NO_COVERAGE_FOUND",
}

export type IsoDateTimeString = string;

export interface Company {
  id: string;
  name: string;
  domain: string;
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
  isRelevant: boolean;
  summary: string;
  analyzedAt: IsoDateTimeString;
  createdAt: IsoDateTimeString;
}

export interface CompanyInput {
  id?: string;
  name: string;
  domain: string;
  lastMentionedAt?: IsoDateTimeString | null;
  status?: MentionStatus;
}

export interface MentionInput {
  id?: string;
  companyId: string;
  title: string;
  url: string;
  snippet: string | null;
  publishedAt: IsoDateTimeString;
  sentiment: SentimentType;
  isRelevant: boolean;
  summary: string;
  analyzedAt?: IsoDateTimeString;
  createdAt?: IsoDateTimeString;
}

export interface CompanyMentionStatusResult {
  companyId: string;
  status: MentionStatus;
  lastMentionedAt: IsoDateTimeString | null;
  daysSinceLastMention: number | null;
}

export interface SaveMentionsResult {
  inserted: number;
  skipped: number;
}

export type QuarterlyMentionSortField = "publishedAt" | "sentiment" | "createdAt";
export type SortDirection = "asc" | "desc";

export interface QuarterlyMentionsQuery {
  companyId?: string;
  sortBy?: QuarterlyMentionSortField;
  sortDirection?: SortDirection;
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

export interface CompanyWithStats extends Company {
  daysSinceLastMention: number | null;
  sentimentCounts: SentimentCounts;
}

export enum AlertJobStatus {
  SUCCESS = "success",
  FAILED = "failed",
  PENDING = "pending",
}

export interface AlertStatus {
  /** Proxy derived from the latest mention.analyzedAt across the portfolio. */
  lastExecutedAt: IsoDateTimeString | null;
  status: AlertJobStatus;
}

export interface DashboardSummary {
  totalCompanies: number;
  quarterlyMentionCount: number;
  sentimentBreakdown: SentimentBreakdown;
  alertStatus: AlertStatus;
}

export type CompanyStatusFilter = MentionStatus | "all";

export interface ListCompaniesQuery {
  search?: string;
  status?: CompanyStatusFilter;
}
