import {
  RoutedDataFetcher,
  type RoutedFetchResult,
} from "../llm/routed_data_fetcher.js";

export async function fetchCompanyMentions(
  companyName: string,
  fetcher: RoutedDataFetcher = new RoutedDataFetcher(),
): Promise<RoutedFetchResult> {
  return fetcher.fetchForCompany({ name: companyName });
}
