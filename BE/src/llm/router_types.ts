import { DataProviderType } from "../data_layer/base_data_provider.js";
import type { JsonSchema } from "./types.js";

export interface CompanyMetadata {
  name: string;
  domain?: string;
  sector?: string;
}

export interface RouteDecision {
  provider: DataProviderType;
  query: string;
  isAmbiguous: boolean;
  reasoning: string;
}

export interface RawRouteDecision extends Record<string, unknown> {
  provider: string;
  query: string;
  is_ambiguous: boolean;
  reasoning: string;
}

export const ROUTE_DECISION_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    provider: {
      type: "string",
      enum: [
        DataProviderType.GOOGLE_RSS,
        DataProviderType.TAVILY,
        DataProviderType.NEWS_API,
      ],
    },
    query: { type: "string" },
    is_ambiguous: { type: "boolean" },
    reasoning: { type: "string" },
  },
  required: ["provider", "query", "is_ambiguous", "reasoning"],
};
