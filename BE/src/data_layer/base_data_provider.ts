export enum DataProviderType {
  GOOGLE_RSS = "GOOGLE_RSS",
  TAVILY = "TAVILY",
  NEWS_API = "NEWS_API",
}

export interface RawMention {
  title: string;
  url: string;
  publishedAt: Date | null;
  snippet: string;
  source: DataProviderType;
}

export abstract class BaseDataProvider {
  protected abstract readonly providerType: DataProviderType;
  protected abstract readonly url: string;
  protected query: string = "";

  public async fetchMentions(query: string): Promise<RawMention[]> {
    this.query = query;
    const requestUrl = this.buildRequestUrl(query);
    const body = this.buildRequestBody(query);
    const response = await fetch(requestUrl, {
      method: this.getRequestMethod(),
      headers: this.getHeaders(),
      ...(body !== undefined ? { body } : {}),
    });

    if (!response.ok) {
      throw new Error(
        `[${this.providerType}] fetch failed: ${response.status} ${response.statusText}`,
      );
    }

    const rawBody: unknown = await this.readResponseBody(response);
    return this.parseResult(rawBody);
  }

  protected abstract parseResult(raw: unknown): RawMention[];

  protected abstract buildRequestUrl(query: string): string;

  protected getRequestMethod(): "GET" | "POST" {
    return "GET";
  }

  protected buildRequestBody(_query: string): string | undefined {
    return undefined;
  }

  protected getHeaders(): Record<string, string> {
    return { Accept: "application/json" };
  }

  private async readResponseBody(response: Response): Promise<unknown> {
    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      return response.json();
    }
    return response.text();
  }
}
