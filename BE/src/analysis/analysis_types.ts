import type { RawMention } from "../data_layer/base_data_provider.js";
import type { JsonSchema } from "../llm/types.js";
import { SentimentType } from "./sentiment_type.js";

/** Relevance score returned by the LLM (1 = unrelated, 10 = clearly about the company). */
export const RELEVANCE_SCORE_MIN = 1;
export const RELEVANCE_SCORE_MAX = 10;

export interface AnalyzedMention {
  mention: RawMention;
  publishedAt: Date | null;
  companyName: string;
  score: number;
  sentiment: SentimentType;
  summary: string;
}

export interface RawSentimentDecision extends Record<string, unknown> {
  score: number;
  sentiment: string;
  summary: string;
}

export const SENTIMENT_DECISION_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    score: {
      type: "integer",
      minimum: RELEVANCE_SCORE_MIN,
      maximum: RELEVANCE_SCORE_MAX,
    },
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
  required: ["score", "sentiment", "summary"],
};
