import {
  RoutedDataFetcher,
  type RoutedFetchResult,
} from "../llm/routed_data_fetcher.js";
import type { CompanyMetadata } from "../llm/router_types.js";

export async function fetchCompanyMentions(
  company: CompanyMetadata,
  fetcher: RoutedDataFetcher = new RoutedDataFetcher(),
): Promise<RoutedFetchResult> {
  return fetcher.fetchForCompany(company);
}
