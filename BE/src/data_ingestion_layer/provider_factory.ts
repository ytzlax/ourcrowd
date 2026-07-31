import { BaseDataProvider, DataProviderType } from "./base_data_provider.js";
import { GoogleRssProvider } from "./google_rss_provider.js";
import { NewsApiProvider } from "./news_api_provider.js";
import { TavilySearchProvider } from "./tavily_search_provider.js";

export interface ProviderFactoryConfig {
  tavilyApiKey?: string;
  newsApiKey?: string;
}

export class DataProviderFactory {
  private readonly providers = new Map<DataProviderType, BaseDataProvider>();

  public constructor(config: ProviderFactoryConfig = {}) {
    this.providers.set(DataProviderType.GOOGLE_RSS, new GoogleRssProvider());

    const tavilyApiKey = config.tavilyApiKey ?? process.env.TAVILY_API_KEY ?? "";
    if (tavilyApiKey.trim()) {
      this.providers.set(
        DataProviderType.TAVILY,
        new TavilySearchProvider(tavilyApiKey),
      );
    }

    const newsApiKey = config.newsApiKey ?? process.env.NEWS_API_KEY ?? "";
    if (newsApiKey.trim()) {
      this.providers.set(
        DataProviderType.NEWS_API,
        new NewsApiProvider(newsApiKey),
      );
    }
  }

  public getProvider(type: DataProviderType): BaseDataProvider | null {
    return this.providers.get(type) ?? null;
  }

  public isAvailable(type: DataProviderType): boolean {
    return this.providers.has(type);
  }
}
