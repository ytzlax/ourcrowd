import type { Mention, RawMention } from "../data_layer/base_data_provider.js";
import { Llm } from "../llm/llm.js";
import { LlmModel } from "../llm/llm_model.js";
import type { CompanyMetadata } from "../data_layer/router_types.js";
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
export const DEFAULT_RELEVANCE_SCORE_THRESHOLD = 7;

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
    this.llm.prompt = this.buildAnalysisPrompt(company, mention, normalized);
    const raw = await this.llm.invokeStructured<RawSentimentDecision>(SENTIMENT_DECISION_SCHEMA);
    console.log(`[SentimentAnalyzer result: ${mention.title.slice(0, 50)} - ${raw.score} `);
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
    mention: Mention,
    normalized: ReturnType<typeof normalizeMentionForAnalysis>,
  ): string {
    // const publishedLine = mention.publishedAt
    //   ? `Published: ${mention.publishedAt.toISOString()}`
    //   : null;

    const articleLines = [
      `Title: ${normalized.title}`,
      //publishedLine,
      "",
      "Content snippet:",
      normalized.combinedText,
    ].filter((line): line is string => line !== null);

    return `
    Analyze the following news mention for the portfolio company.
    Company detail:
    - Name: ${company.name}
    - Context : ${company.context}
    Article:
    ${articleLines.join("\n")}

     Tasks:
     1. Score how strongly the article is about this specific tech company/startup (${RELEVANCE_SCORE_MIN}-${RELEVANCE_SCORE_MAX}).
     2. Classify sentiment as positive, negative, or neutral for the company's business outlook.
     3. Provide a one-sentence summary of the mention's key takeaway (or 'N/A' if score is low).
     Relevance score guidelines (score ${RELEVANCE_SCORE_MIN}-${RELEVANCE_SCORE_MAX}):
     - 1-3: Unrelated — ${company.name} is not mentioned at all in the provided snippet, name used as a general noun/phrase/technical term, a different company/person with the same name, or only in a footer/tag cloud/disclaimer.
     - 4-6: Ambiguous or weak — company name appears but reporting on the company is unclear or incidental.
     - 7-10: Clearly about this company — article directly discusses, news-reports on, or features this company or its products/executives.
     Sentiment guidelines:
     - positive: funding, acquisitions, strategic partnerships, product launches, revenue growth, industry awards
     - negative: layoffs, lawsuits, security breaches, regulatory sanctions, product failures, financial loss
     - neutral: routine corporate announcements, balanced reporting, or general industry roundups

    Return JSON with:
    - score: integer ${RELEVANCE_SCORE_MIN}-${RELEVANCE_SCORE_MAX}
    - sentiment: 'positive' | 'negative' | 'neutral'
    - summary: brief takeaway
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
