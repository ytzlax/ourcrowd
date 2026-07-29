import type { RawMention } from "../data_layer/base_data_provider.js";
import type { JsonSchema } from "../llm/types.js";
import { SentimentType } from "./sentiment_type.js";

export interface AnalyzedMention {
  mention: RawMention;
  companyName: string;
  isRelevant: boolean;
  sentiment: SentimentType;
  summary: string;
}

export interface RawSentimentDecision extends Record<string, unknown> {
  is_relevant: boolean;
  sentiment: string;
  summary: string;
}

export const SENTIMENT_DECISION_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    is_relevant: { type: "boolean" },
    sentiment: {
      type: "string",
      enum: [
        SentimentType.POSITIVE,
        SentimentType.NEGATIVE,
        SentimentType.NEUTRAL,
      ],
    },
    summary: { type: "string" },
  },
  required: ["is_relevant", "sentiment", "summary"],
};

export interface RawBatchSentimentItem extends Record<string, unknown> {
  index: number;
  is_relevant: boolean;
  sentiment: string;
  summary: string;
}

export const BATCH_SENTIMENT_DECISION_SCHEMA: JsonSchema = {
  type: "array",
  items: {
    type: "object",
    properties: {
      index: { type: "integer", description: "Zero-based index of the mention in the input list" },
      is_relevant: { type: "boolean" },
      sentiment: {
        type: "string",
        enum: [
          SentimentType.POSITIVE,
          SentimentType.NEGATIVE,
          SentimentType.NEUTRAL,
        ],
      },
      summary: { type: "string" },
    },
    required: ["index", "is_relevant", "sentiment", "summary"],
  },
};
