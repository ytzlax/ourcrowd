import { getProviderAttemptOrder } from "../data_layer/fallback_order.js";
import {
  DataProviderFactory,
  type ProviderFactoryConfig,
} from "../data_layer/provider_factory.js";
import {
  DataProviderType,
  type RawMention,
} from "../data_layer/base_data_provider.js";
import { LlmRouter } from "./llm_router.js";
import type { LlmConfig } from "./types.js";
import type { CompanyMetadata, RouteDecision } from "./router_types.js";

export interface ProviderAttemptError {
  provider: DataProviderType;
  message: string;
}

export interface RoutedFetchResult {
  mentions: RawMention[];
  provider: DataProviderType;
  routeDecision: RouteDecision;
  attemptedProviders: DataProviderType[];
  skippedProviders: DataProviderType[];
  errors: ProviderAttemptError[];
}

export interface RoutedDataFetcherConfig {
  llm?: LlmConfig;
  providers?: ProviderFactoryConfig;
}

export class RoutedDataFetcher {
  private readonly router: LlmRouter;
  private readonly providerFactory: DataProviderFactory;

  public constructor(config: RoutedDataFetcherConfig = {}) {
    this.router = new LlmRouter(config.llm);
    this.providerFactory = new DataProviderFactory(config.providers);
  }

  public async fetchForCompany(company: CompanyMetadata): Promise<RoutedFetchResult> {
    const routeDecision = await this.router.route(company);
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
        const mentions = await provider.fetchMentions(routeDecision.query);
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
