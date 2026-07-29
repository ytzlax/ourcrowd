import { DataProviderType } from "../data_layer/base_data_provider.js";
import { Llm } from "./llm.js";
import type { LlmConfig } from "./types.js";
import {
  ROUTE_DECISION_SCHEMA,
  type CompanyMetadata,
  type RawRouteDecision,
  type RouteDecision,
} from "./router_types.js";
import { LlmModel } from "./llm_model.js";

const ROUTER_SYSTEM_PROMPT =
  "You are a news search routing assistant for a venture portfolio monitoring system. " +
  "Choose the most cost-effective data provider and construct a precise search query. " +
  "Respond only with valid JSON matching the requested schema.";

export class LlmRouter {
  private readonly llm: Llm;

  public constructor(llmConfig: LlmConfig = {}) {
    this.llm = new Llm({
      ...llmConfig,
      model: LlmModel.LLAMA_3_2,
      system: llmConfig.system ?? ROUTER_SYSTEM_PROMPT,
      options: { temperature: 0.1, ...llmConfig.options },
    });
  }

  public async route(company: CompanyMetadata): Promise<RouteDecision> {
    this.llm.prompt = this.buildRoutingPrompt(company);
    const raw = await this.llm.invokeStructured<RawRouteDecision>(ROUTE_DECISION_SCHEMA);
    return this.normalizeDecision(raw, company.name);
  }

  private buildRoutingPrompt(company: CompanyMetadata): string {
    const metadataLines = [
      `Company name: ${company.name}`,
      company.domain ? `Domain: ${company.domain}` : null,
      company.sector ? `Sector: ${company.sector}` : null,
    ].filter((line): line is string => line !== null);

    return [
      "Decide how to fetch recent news mentions for this portfolio company.",
      "",
      "Company metadata:",
      ...metadataLines.map((line) => `- ${line}`),
      "",
      "Routing rules:",
      `- Use ${DataProviderType.GOOGLE_RSS} for unique, unambiguous company names (e.g. ZutaCore, BioCatch).`,
      `- Use ${DataProviderType.TAVILY} or ${DataProviderType.NEWS_API} for ambiguous/common names (e.g. Island, Peak, Near, Ro, Wave).`,
      "- Prefer GOOGLE_RSS when the name is distinctive enough for free RSS search.",
      "- Prefer TAVILY for ambiguous names when higher-precision web search is needed.",
      "- Use NEWS_API when a broad news archive query is better than web search.",
      "- Build a disambiguated query for ambiguous names by adding sector/domain/context terms.",
      '- Example: Island + Enterprise Browser -> `"Island" AND ("Enterprise Browser" OR "Cybersecurity")`',
      "",
      "Return JSON with:",
      "- provider: one of GOOGLE_RSS, TAVILY, NEWS_API",
      "- query: the final optimized search query string",
      "- is_ambiguous: true if the company name is likely to produce noisy unrelated results"
    ].join("\n");
  }

  private normalizeDecision(raw: RawRouteDecision, companyName: string): RouteDecision {
    const provider = this.parseProvider(raw.provider);
    const query = raw.query.trim();

    if (!query) {
      throw new Error(`[LlmRouter] LLM returned empty query for company "${companyName}"`);
    }

    return {
      provider,
      query,
      isAmbiguous: raw.is_ambiguous,
    };
  }

  private parseProvider(value: string): DataProviderType {
    const normalized = value.trim().toUpperCase();

    if (Object.values(DataProviderType).includes(normalized as DataProviderType)) {
      return normalized as DataProviderType;
    }

    throw new Error(`[LlmRouter] Invalid provider returned by LLM: "${value}"`);
  }
}
