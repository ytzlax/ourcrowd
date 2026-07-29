import { useQuery } from "@tanstack/react-query";

import {
  dashboardQueryKeys,
  fetchCompanies,
  fetchCompanyMentions,
  fetchDashboardSummary,
} from "@/api";
import type { CompaniesQueryParams } from "@/types";

export function useDashboardSummary() {
  return useQuery({
    queryKey: dashboardQueryKeys.summary(),
    queryFn: fetchDashboardSummary,
  });
}

export function useCompanies(params: CompaniesQueryParams = {}) {
  return useQuery({
    queryKey: dashboardQueryKeys.companies(params),
    queryFn: () => fetchCompanies(params),
  });
}

export function useCompanyMentions(companyId: string | null) {
  return useQuery({
    queryKey: dashboardQueryKeys.companyMentions(companyId ?? ""),
    queryFn: () => fetchCompanyMentions(companyId!),
    enabled: companyId !== null,
  });
}
