import {
  BaseDataProvider,
  DataProviderType,
  type RawMention,
} from "./base_data_provider.js";

interface NewsApiArticle {
  title?: string | null;
  url?: string | null;
  description?: string | null;
  publishedAt?: string | null;
}

interface NewsApiResponse {
  status?: string;
  articles?: NewsApiArticle[];
}

export class NewsApiProvider extends BaseDataProvider {
  protected readonly providerType = DataProviderType.NEWS_API;
  protected readonly url = "https://newsapi.org/v2/everything";

  private readonly apiKey: string;

  public constructor(apiKey: string) {
    super();
    if (!apiKey.trim()) {
      throw new Error("[NEWS_API] apiKey is required");
    }
    this.apiKey = apiKey;
  }

  protected buildRequestUrl(query: string): string {
    console.log(`[NewsApiProvider] Building request url for query: ${query}`);
    const params = new URLSearchParams({
      q: query,
      language: "en",
      sortBy: "publishedAt",
    });
    return `${this.url}?${params.toString()}`;
  }

  protected getHeaders(): Record<string, string> {
    return {
      Accept: "application/json",
      "X-Api-Key": this.apiKey,
    };
  }

  protected parseResult(raw: unknown): RawMention[] {
    if (!this.isNewsApiResponse(raw)) {
      return [];
    }

    const articles = raw.articles ?? [];
    return articles
      .map((article) => this.mapArticleToMention(article))
      .filter((mention): mention is RawMention => mention !== null);
  }

  private mapArticleToMention(article: NewsApiArticle): RawMention | null {
    const title = article.title?.trim();
    const url = article.url?.trim();
    if (!title || !url || title === "[Removed]") {
      return null;
    }

    return {
      title,
      url,
      publishedAt: this.parsePublishedAt(article.publishedAt),
      snippet: article.description?.trim() ?? "",
      source: this.providerType,
    };
  }

  private parsePublishedAt(value: string | null | undefined): Date | null {
    if (!value) {
      return null;
    }
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private isNewsApiResponse(raw: unknown): raw is NewsApiResponse {
    return typeof raw === "object" && raw !== null;
  }
}
