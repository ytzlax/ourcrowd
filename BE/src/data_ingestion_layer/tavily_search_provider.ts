import {
  BaseDataProvider,
  DataProviderType,
  type RawMention,
} from "./base_data_provider.js";

interface TavilyResult {
  title?: string | null;
  url?: string | null;
  content?: string | null;
  published_date?: string | null;
}

interface TavilySearchResponse {
  results?: TavilyResult[];
}

export class TavilySearchProvider extends BaseDataProvider {
  protected readonly providerType = DataProviderType.TAVILY;
  protected readonly url = "https://api.tavily.com/search";

  private readonly apiKey: string;

  public constructor(apiKey: string) {
    super();
    if (!apiKey.trim()) {
      throw new Error("[TAVILY] apiKey is required");
    }
    this.apiKey = apiKey;
  }

  protected buildRequestUrl(_query: string): string {
    console.log(`[TavilySearchProvider] Building request url for query: ${_query}`);
    return this.url;
  }

  protected getRequestMethod(): "GET" | "POST" {
    return "POST";
  }

  protected buildRequestBody(query: string): string {
    return JSON.stringify({
      query,
      topic: "news",
      search_depth: "basic",
      max_results: 10,
    });
  }

  protected getHeaders(): Record<string, string> {
    return {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.apiKey}`,
    };
  }

  protected parseResult(raw: unknown): RawMention[] {
    if (!this.isTavilyResponse(raw)) {
      return [];
    }

    const results = raw.results ?? [];
    return results
      .map((result) => this.mapResultToMention(result))
      .filter((mention): mention is RawMention => mention !== null);
  }

  private mapResultToMention(result: TavilyResult): RawMention | null {
    const title = result.title?.trim();
    const url = result.url?.trim();
    if (!title || !url) {
      return null;
    }

    return {
      title,
      url,
      publishedAt: this.parsePublishedDate(result.published_date),
      snippet: result.content?.trim() ?? "",
      source: this.providerType,
    };
  }

  private parsePublishedDate(value: string | null | undefined): Date | null {
    if (!value) {
      return null;
    }
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private isTavilyResponse(raw: unknown): raw is TavilySearchResponse {
    return typeof raw === "object" && raw !== null;
  }
}
