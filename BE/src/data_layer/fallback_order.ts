import { DataProviderType } from "./base_data_provider.js";

const FALLBACK_ORDER: Record<DataProviderType, DataProviderType[]> = {
  [DataProviderType.GOOGLE_RSS]: [
    DataProviderType.TAVILY,
    DataProviderType.NEWS_API,
  ],
  [DataProviderType.TAVILY]: [
    DataProviderType.NEWS_API,
    DataProviderType.GOOGLE_RSS,
  ],
  [DataProviderType.NEWS_API]: [
    DataProviderType.TAVILY,
    DataProviderType.GOOGLE_RSS,
  ],
};

export function getProviderAttemptOrder(primary: DataProviderType): DataProviderType[] {
  const fallbacks = FALLBACK_ORDER[primary];
  return [primary, ...fallbacks];
}
