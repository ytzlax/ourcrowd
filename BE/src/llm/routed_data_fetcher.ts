import { getProviderAttemptOrder } from "../data_layer/fallback_order.js";
import {
  DataProviderFactory,
  type ProviderFactoryConfig,
} from "../data_layer/provider_factory.js";
import { selectProviderType } from "../data_layer/select_provider_type.js";
import {
  DataProviderType,
  type Mention,
} from "../data_layer/base_data_provider.js";
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

export class RoutedDataFetcher {
  private readonly providerFactory: DataProviderFactory;

  public constructor(config: RoutedDataFetcherConfig = {}) {
    this.providerFactory = new DataProviderFactory(config.providers);
  }

  public async fetchForCompany(company: CompanyMetadata): Promise<RoutedFetchResult> {
    const routeDecision = this.buildRouteDecision(company);
    const attemptOrder = getProviderAttemptOrder(routeDecision.provider);

    const attemptedProviders: DataProviderType[] = [];
    const skippedProviders: DataProviderType[] = [];
    const errors: ProviderAttemptError[] = [];

    for (const providerType of attemptOrder) {
      const provider = this.providerFactory.getProvider(providerType);
      if (!provider) {
        skippedProviders.push(providerType);
        continue;
      }

      attemptedProviders.push(providerType);

      try {
        const mentions = await provider.fetchMentions(company.name);
        return {
          mentions,
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

    throw new Error(
      `[RoutedDataFetcher] All providers failed for "${company.name}": ${this.summarizeErrors(errors, skippedProviders)}`,
    );
  }

  private buildRouteDecision(company: CompanyMetadata): RouteDecision {
    return {
      provider: selectProviderType(company),
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
