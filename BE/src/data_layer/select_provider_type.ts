import { CompanyType, MediaPresence } from "../db/types.js";
import { DataProviderType } from "./base_data_provider.js";

export interface ProviderRoutingCompany {
  companyType: CompanyType;
  mediaPresence: MediaPresence;
}

/**
 * Deterministic provider selection from company classification.
 * B2B / niche tech → Tavily; high-mainstream B2C → NewsAPI; else Google RSS.
 */
export function selectProviderType(company: ProviderRoutingCompany): DataProviderType {
  if (
    company.companyType === CompanyType.B2B ||
    company.mediaPresence === MediaPresence.NICHE_TECH
  ) {
    return DataProviderType.TAVILY;
  }

  if (
    company.companyType === CompanyType.B2C &&
    company.mediaPresence === MediaPresence.HIGH_MAINSTREAM
  ) {
    return DataProviderType.NEWS_API;
  }

  return DataProviderType.GOOGLE_RSS;
}
