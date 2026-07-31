import type { Mention, RawMention } from "../data_ingestion_layer/base_data_provider.js";
import { Llm } from "../llm/llm.js";
import { LlmModel } from "../llm/llm_model.js";
import type { CompanyMetadata } from "../data_ingestion_layer/router_types.js";
import type { LlmConfig } from "../llm/types.js";
import {
  RELEVANCE_SCORE_MAX,
  RELEVANCE_SCORE_MIN,
  SENTIMENT_DECISION_SCHEMA,
  type AnalyzedMention,
  type RawSentimentDecision,
} from "./analysis_types.js";
import { normalizeMentionForAnalysis } from "./mention_normalizer.js";
import { SentimentType } from "./sentiment_type.js";

const SENTIMENT_SYSTEM_PROMPT =
  "You are a venture portfolio news sentiment analyst. " +
  "Score how strongly a news mention is about the target portfolio company (not homonyms or unrelated topics). " +
  "Classify sentiment from the perspective of the company's business outlook. " +
  "Respond only with valid JSON matching the requested schema.";

/** Mentions with score >= this value are treated as relevant and kept. */
export const DEFAULT_RELEVANCE_SCORE_THRESHOLD = 5;

export interface SentimentAnalyzerConfig {
  llm?: LlmConfig;
  relevanceScoreThreshold?: number;
}

export class SentimentAnalyzer {
  private readonly llm: Llm;
  private readonly relevanceScoreThreshold: number;

  public constructor(config: SentimentAnalyzerConfig = {}) {
    this.relevanceScoreThreshold =
      config.relevanceScoreThreshold ?? DEFAULT_RELEVANCE_SCORE_THRESHOLD;
    this.llm = new Llm({
      ...config.llm,
      model: LlmModel.LLAMA_3_2,
      system: config.llm?.system ?? SENTIMENT_SYSTEM_PROMPT,
      options: { temperature: 0, numPredict: 100, ...config.llm?.options },
    });
  }

  public async analyzeMention(
    company: CompanyMetadata,
    mention: Mention,
  ): Promise<AnalyzedMention> {
    const normalized = normalizeMentionForAnalysis(mention);
    this.llm.prompt = this.buildAnalysisPrompt(company, normalized);
    const raw = await this.llm.invokeStructured<RawSentimentDecision>(SENTIMENT_DECISION_SCHEMA);
    console.log(`[SentimentAnalyzer result: ${mention.title.slice(0, 50)} - ${raw.score}`);
    return this.normalizeResult(company.name, mention, raw);
  }

  public async analyzeMentions(
    company: CompanyMetadata,
    mentions: Mention[],
  ): Promise<AnalyzedMention[]> {
    const results: AnalyzedMention[] = [];

    for (const mention of mentions) {
      const result = await this.analyzeMention(company, mention);
      if (result.score >= this.relevanceScoreThreshold) {
        results.push(result);
      }
    }

    return results;
  }

  private buildAnalysisPrompt(
    company: CompanyMetadata,
    normalized: ReturnType<typeof normalizeMentionForAnalysis>,
  ): string {

    const articleLines = [
      `Title: ${normalized.title}`,
      "",
      "Content snippet:",
      normalized.combinedText,
    ].filter((line): line is string => line !== null);

    return `
    Analyze the following news mention for the portfolio company.
    
    Company detail:
    - Name: ${company.name}
    - Context: ${company.context}
    
    Article:
    ${articleLines.join("\n")}

    Tasks:
    1. Score how strongly the article is about this specific tech company (${RELEVANCE_SCORE_MIN}-${RELEVANCE_SCORE_MAX}).
    2. Classify sentiment as positive, negative, or neutral for the company's business outlook.
    3. Provide a one-sentence summary of the mention's key takeaway (or 'N/A' if score < 7).

    Guidelines:
    - Relevance (1-3: Unrelated / Same name used differently, 4-6: Incidental mention, 7-10: Directly about this company)
    - Sentiment (positive: funding/awards/growth, negative: layoffs/lawsuits/losses, neutral: routine updates)

    Examples:

    Example 1 (Low Relevance):
    Company: Apple
    Article: "How to make a delicious apple pie recipe at home."
    Output: {"score": 1, "sentiment": "neutral", "summary": "N/A"}

    Example 2 (High Relevance):
    Company: ${company.name}
    Article: "Title: ${company.name} raises $10M in Series A funding\nSnippet: Tech startup ${company.name} announced today it closed a new round of funding..."
    Output: {"score": 10, "sentiment": "positive", "summary": "${company.name} successfully raised $10M in Series A funding."}

    Return ONLY a valid JSON object with keys: "score", "sentiment", "summary". No extra explanation.
    `;
  }

  private normalizeResult(
    companyName: string,
    mention: RawMention,
    raw: RawSentimentDecision,
  ): AnalyzedMention {
    return {
      mention,
      companyName,
      score: this.parseScore(raw.score),
      sentiment: this.parseSentiment(raw.sentiment),
      summary: raw.summary.trim(),
      publishedAt: mention.publishedAt,
    };
  }

  private parseScore(value: number): number {
    const score = Math.round(Number(value));

    if (
      !Number.isFinite(score) ||
      score < RELEVANCE_SCORE_MIN ||
      score > RELEVANCE_SCORE_MAX
    ) {
      throw new Error(
        `[SentimentAnalyzer] Invalid score returned by LLM: "${String(value)}" ` +
        `(expected integer ${RELEVANCE_SCORE_MIN}-${RELEVANCE_SCORE_MAX})`,
      );
    }

    return score;
  }

  private parseSentiment(value: string): SentimentType {
    const normalized = value.trim().toLowerCase();

    if (Object.values(SentimentType).includes(normalized as SentimentType)) {
      return normalized as SentimentType;
    }

    throw new Error(`[SentimentAnalyzer] Invalid sentiment returned by LLM: "${value}"`);
  }
}
