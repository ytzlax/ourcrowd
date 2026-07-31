import type {
  CompanyWithStats,
  Mention,
  SentimentBreakdown,
} from "./domain";

export interface DashboardSummaryResponse {
  totalCompanies: number;
  quarterlyMentionCount: number;
  sentimentBreakdown: SentimentBreakdown;
}

export interface CompaniesResponse {
  companies: CompanyWithStats[];
}

export interface CompanyMentionsResponse {
  companyId: string;
  mentions: Mention[];
}

export interface ApiErrorResponse {
  message: string;
  code?: string;
}
