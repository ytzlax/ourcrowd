import { SentimentType } from "../analysis/sentiment_type.js";

export { SentimentType };

export enum MentionStatus {
  LAST_MENTIONED_X_DAYS_AGO = "LAST_MENTIONED_X_DAYS_AGO",
  NO_COVERAGE_FOUND = "NO_COVERAGE_FOUND",
}

export enum CompanyType {
  B2B = "B2B",
  B2C = "B2C",
  ENTERPRISE = "Enterprise",
  OPEN_SOURCE = "OpenSource",
}

export enum MediaPresence {
  HIGH_MAINSTREAM = "high_mainstream",
  NICHE_TECH = "niche_tech",
  LOW_PR = "low_pr",
}

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

export interface CompanyInput {
  id?: string;
  name: string;
  companyType?: CompanyType;
  mediaPresence?: MediaPresence;
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
  summary: string;
  score: number;
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

export enum QueuedMentionStatus {
  PENDING = "PENDING",
  PROCESSING = "PROCESSING",
  DONE = "DONE",
  FAILED = "FAILED",
}

export interface QueuedMention {
  id: string;
  companyId: string;
  companyName: string;
  title: string;
  url: string;
  snippet: string | null;
  publishedAt: IsoDateTimeString;
  provider: string;
  status: QueuedMentionStatus;
  fetchedAt: IsoDateTimeString;
  errorMessage: string | null;
  retryCount: number;
}

export interface QueuedMentionInput {
  id?: string;
  companyId: string;
  companyName: string;
  title: string;
  url: string;
  snippet: string | null;
  publishedAt: IsoDateTimeString;
  provider: string;
  status?: QueuedMentionStatus;
  fetchedAt?: IsoDateTimeString;
  errorMessage?: string | null;
  retryCount?: number;
}

export interface SaveQueuedMentionsResult {
  inserted: number;
  skipped: number;
}

export type QuarterlyMentionSortField = "publishedAt" | "sentiment" | "createdAt";
export type SortDirection = "asc" | "desc";

export interface QuarterlyMentionsQuery {
  companyId?: string;
  /** When set, only mentions with score >= this value. */
  minScore?: number;
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

export interface DashboardSummary {
  totalCompanies: number;
  quarterlyMentionCount: number;
  sentimentBreakdown: SentimentBreakdown;
}

export type CompanyStatusFilter = MentionStatus | "all";

export interface ListCompaniesQuery {
  search?: string;
  status?: CompanyStatusFilter;
  /** When > 1, only companies with at least one quarterly mention at/above this score. */
  minScore?: number;
}
