import { apiClient } from "./client";
import type {
  CompaniesQueryParams,
  CompaniesResponse,
  CompanyMentionsResponse,
  DashboardSummaryResponse,
} from "@/types";

export const dashboardQueryKeys = {
  all: ["dashboard"] as const,
  summary: () => [...dashboardQueryKeys.all, "summary"] as const,
  companies: (params: CompaniesQueryParams) =>
    [...dashboardQueryKeys.all, "companies", params] as const,
  companyMentions: (companyId: string) =>
    [...dashboardQueryKeys.all, "mentions", companyId] as const,
};

export async function fetchDashboardSummary(): Promise<DashboardSummaryResponse> {
  const { data } = await apiClient.get<DashboardSummaryResponse>(
    "/dashboard/summary",
  );
  return data;
}

export async function fetchCompanies(
  params: CompaniesQueryParams = {},
): Promise<CompaniesResponse> {
  const { data } = await apiClient.get<CompaniesResponse>("/companies", {
    params,
  });
  return data;
}

export async function fetchCompanyMentions(
  companyId: string,
): Promise<CompanyMentionsResponse> {
  const { data } = await apiClient.get<CompanyMentionsResponse>(
    `/companies/${companyId}/mentions`,
  );
  return data;
}
