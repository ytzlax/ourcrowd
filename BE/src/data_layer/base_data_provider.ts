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

export interface Mention extends Pick<RawMention, "title" | "snippet"> { }
export abstract class BaseDataProvider {
  protected abstract readonly providerType: DataProviderType;
  protected abstract readonly url: string;
  protected query: string = "";

  private getMaxMentionsPerCompany(): number {
    const raw = process.env.MENTIONS_LIMIT_PER_COMPANY;
    if (!raw) {
      return 5;
    }

    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return 5;
    }

    return parsed;
  }

  private selectMostRecentMentions(mentions: RawMention[]): RawMention[] {
    const maxMentions = this.getMaxMentionsPerCompany();

    const dated = mentions.filter(
      (mention) => mention.publishedAt !== null && !Number.isNaN(mention.publishedAt.getTime()),
    );

    const indexed = dated.map((mention, idx) => ({
      mention,
      idx,
      time: mention.publishedAt!.getTime(),
    }));

    indexed.sort((a, b) => {
      if (a.time !== b.time) {
        return b.time - a.time;
      }

      const urlCompare = a.mention.url.localeCompare(b.mention.url);
      if (urlCompare !== 0) {
        return urlCompare;
      }

      // Deterministic fallback to avoid relying on sort stability.
      return a.idx - b.idx;
    });

    return indexed.slice(0, maxMentions).map((entry) => entry.mention);
  }

  public async fetchMentions(query: string): Promise<Mention[]> {
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
    const mentions = this.parseResult(rawBody);
    return this.selectMostRecentMentions(mentions).map(mention => ({
      title: mention.title,
      snippet: mention.snippet
    }));
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
