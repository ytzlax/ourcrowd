import { DataProviderType } from "./base_data_provider.js";

/**
 * Fixed attempt order for every company fetch:
 * free RSS first, then NewsAPI, then Tavily as last resort.
 */
export const PROVIDER_CHAIN: readonly DataProviderType[] = [
  DataProviderType.GOOGLE_RSS,
  DataProviderType.NEWS_API,
  DataProviderType.TAVILY,
];

export function getProviderAttemptOrder(): DataProviderType[] {
  return [...PROVIDER_CHAIN];
}
