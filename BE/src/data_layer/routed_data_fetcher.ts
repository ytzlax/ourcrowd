import { getProviderAttemptOrder } from "./fallback_order.js";
import {
  DataProviderFactory,
  type ProviderFactoryConfig,
} from "./provider_factory.js";
import {
  DataProviderType,
  type Mention,
} from "./base_data_provider.js";
import type { CompanyMetadata, RouteDecision } from "./router_types.js";

export interface ProviderAttemptError {
  provider: DataProviderType;
  message: string;
}

export interface RoutedFetchResult {
  mentions: Mention[];
  provider: DataProviderType;
  routeDecision: RouteDecision;
  attemptedProviders: DataProviderType[];
  skippedProviders: DataProviderType[];
  errors: ProviderAttemptError[];
}

export interface RoutedDataFetcherConfig {
  providers?: ProviderFactoryConfig;
}

/**
 * Returns the set of URLs that are already known for the company
 * (e.g. present in mentions or q_mentions).
 */
export type AreUrlsKnown = (urls: string[]) => ReadonlySet<string>;

export interface FetchForCompanyOptions {
  areUrlsKnown?: AreUrlsKnown;
}

export class RoutedDataFetcher {
  private readonly providerFactory: DataProviderFactory;

  public constructor(config: RoutedDataFetcherConfig = {}) {
    this.providerFactory = new DataProviderFactory(config.providers);
  }

  public async fetchForCompany(
    company: CompanyMetadata,
    options: FetchForCompanyOptions = {},
  ): Promise<RoutedFetchResult> {
    const routeDecision = this.buildRouteDecision(company);
    const attemptOrder = getProviderAttemptOrder();

    const attemptedProviders: DataProviderType[] = [];
    const skippedProviders: DataProviderType[] = [];
    const errors: ProviderAttemptError[] = [];
    let hadSuccessfulFetch = false;
    let lastProvider = attemptOrder[0] ?? DataProviderType.GOOGLE_RSS;

    for (const providerType of attemptOrder) {
      const provider = this.providerFactory.getProvider(providerType);
      if (!provider) {
        skippedProviders.push(providerType);
        continue;
      }

      attemptedProviders.push(providerType);
      lastProvider = providerType;

      try {
        const mentions = await provider.fetchMentions(company.name);
        hadSuccessfulFetch = true;

        const usable = this.selectUsableMentions(mentions, options.areUrlsKnown);
        if (usable.length === 0) {
          continue;
        }

        return {
          mentions: usable,
          provider: providerType,
          routeDecision,
          attemptedProviders,
          skippedProviders,
          errors,
        };
      } catch (error) {
        errors.push({
          provider: providerType,
          message: this.formatError(error),
        });
      }
    }

    if (hadSuccessfulFetch) {
      return {
        mentions: [],
        provider: lastProvider,
        routeDecision,
        attemptedProviders,
        skippedProviders,
        errors,
      };
    }

    throw new Error(
      `[RoutedDataFetcher] All providers failed for "${company.name}": ${this.summarizeErrors(errors, skippedProviders)}`,
    );
  }

  private selectUsableMentions(
    mentions: Mention[],
    areUrlsKnown?: AreUrlsKnown,
  ): Mention[] {
    if (mentions.length === 0) {
      return [];
    }

    if (!areUrlsKnown) {
      return mentions;
    }

    const urls = mentions
      .map((mention) => mention.url.trim())
      .filter((url) => url.length > 0);
    const knownUrls = areUrlsKnown(urls);

    return mentions.filter((mention) => {
      const url = mention.url.trim();
      if (url.length === 0) {
        return true;
      }
      return !knownUrls.has(url);
    });
  }

  private buildRouteDecision(company: CompanyMetadata): RouteDecision {
    const [primary] = getProviderAttemptOrder();
    return {
      provider: primary ?? DataProviderType.GOOGLE_RSS,
      query: company.name,
      isAmbiguous: false,
    };
  }

  private formatError(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  private summarizeErrors(
    errors: ProviderAttemptError[],
    skippedProviders: DataProviderType[],
  ): string {
    const errorSummary = errors
      .map((entry) => `${entry.provider} (${entry.message})`)
      .join("; ");
    const skippedSummary =
      skippedProviders.length > 0
        ? `; skipped unavailable: ${skippedProviders.join(", ")}`
        : "";

    return `${errorSummary}${skippedSummary}`;
  }
}
