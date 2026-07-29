import type {
  AlertStatus,
  CompanyWithStats,
  Mention,
  SentimentBreakdown,
} from "./domain";

export interface DashboardSummaryResponse {
  totalCompanies: number;
  quarterlyMentionCount: number;
  sentimentBreakdown: SentimentBreakdown;
  alertStatus: AlertStatus;
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
