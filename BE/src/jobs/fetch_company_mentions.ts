import {
  RoutedDataFetcher,
  type FetchForCompanyOptions,
  type RoutedFetchResult,
} from "../data_layer/routed_data_fetcher.js";
import type { CompanyMetadata } from "../data_layer/router_types.js";

export async function fetchCompanyMentions(
  company: CompanyMetadata,
  fetcher: RoutedDataFetcher = new RoutedDataFetcher(),
  options: FetchForCompanyOptions = {},
): Promise<RoutedFetchResult> {
  return fetcher.fetchForCompany(company, options);
}
