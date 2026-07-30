import { XMLParser } from "fast-xml-parser";
import {
  BaseDataProvider,
  DataProviderType,
  type RawMention,
} from "./base_data_provider.js";

interface GoogleRssItem {
  title?: string;
  link?: string;
  pubDate?: string;
  description?: string;
}

interface GoogleRssChannel {
  item?: GoogleRssItem[];
}

interface GoogleRssDocument {
  rss?: {
    channel?: GoogleRssChannel;
  };
}

export class GoogleRssProvider extends BaseDataProvider {
  protected readonly providerType = DataProviderType.GOOGLE_RSS;
  protected readonly url = "https://news.google.com/rss/search";

  private readonly xmlParser = new XMLParser({
    ignoreAttributes: true,
    trimValues: true,
    isArray: (tagName) => tagName === "item",
  });

  protected buildRequestUrl(query: string): string {
    console.log(`[GoogleRssProvider] Building request url for query: ${query}`);
    const exactQuery = `"${query}"`;
    const params = new URLSearchParams({
      q: exactQuery,
      hl: "en-US",
      gl: "US",
      ceid: "US:en",
    });
    return `${this.url}?${params.toString()}`;
  }

  protected getHeaders(): Record<string, string> {
    return { Accept: "application/rss+xml, application/xml, text/xml" };
  }

  protected parseResult(raw: unknown): RawMention[] {
    if (typeof raw !== "string") {
      return [];
    }

    const document = this.xmlParser.parse(raw) as GoogleRssDocument;
    const items = document.rss?.channel?.item ?? [];

    return items
      .map((item) => this.mapItemToMention(item))
      .filter((mention): mention is RawMention => mention !== null);
  }

  private mapItemToMention(item: GoogleRssItem): RawMention | null {
    const title = item.title?.trim();
    const url = item.link?.trim();
    if (!title || !url) {
      return null;
    }

    return {
      title,
      url,
      publishedAt: this.parsePubDate(item.pubDate),
      snippet: this.stripHtml(item.description ?? ""),
      source: this.providerType,
    };
  }

  private parsePubDate(value: string | undefined): Date | null {
    if (!value) {
      return null;
    }
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private stripHtml(value: string): string {
    return value.replace(/<[^>]*>/g, "").trim();
  }
}
