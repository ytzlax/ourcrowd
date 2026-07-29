import type { RawMention } from "../data_layer/base_data_provider.js";
import { Llm } from "../llm/llm.js";
import type { CompanyMetadata } from "../llm/router_types.js";
import type { LlmConfig } from "../llm/types.js";
import {
  SENTIMENT_DECISION_SCHEMA,
  type AnalyzedMention,
  type RawSentimentDecision,
} from "./analysis_types.js";
import { normalizeMentionForAnalysis } from "./mention_normalizer.js";
import { SentimentType } from "./sentiment_type.js";

const SENTIMENT_SYSTEM_PROMPT =
  "You are a venture portfolio news sentiment analyst. " +
  "Evaluate whether a news mention is about the target portfolio company (not homonyms or unrelated topics). " +
  "Classify sentiment from the perspective of the company's business outlook. " +
  "Respond only with valid JSON matching the requested schema.";

export interface SentimentAnalyzerConfig {
  llm?: LlmConfig;
}

export class SentimentAnalyzer {
  private readonly llm: Llm;

  public constructor(config: SentimentAnalyzerConfig = {}) {
    this.llm = new Llm({
      ...config.llm,
      system: config.llm?.system ?? SENTIMENT_SYSTEM_PROMPT,
      options: { temperature: 0.1, ...config.llm?.options },
    });
  }

  public async analyzeMention(
    company: CompanyMetadata,
    mention: RawMention,
  ): Promise<AnalyzedMention> {
    const normalized = normalizeMentionForAnalysis(mention);
    this.llm.prompt = this.buildAnalysisPrompt(company, mention, normalized);
    const raw = await this.llm.invokeStructured<RawSentimentDecision>(SENTIMENT_DECISION_SCHEMA);
    return this.normalizeResult(company.name, mention, raw);
  }

  public async analyzeMentions(
    company: CompanyMetadata,
    mentions: RawMention[],
  ): Promise<AnalyzedMention[]> {
    const results: AnalyzedMention[] = [];

    for (const mention of mentions) {
      results.push(await this.analyzeMention(company, mention));
    }

    return results;
  }

  private buildAnalysisPrompt(
    company: CompanyMetadata,
    mention: RawMention,
    normalized: ReturnType<typeof normalizeMentionForAnalysis>,
  ): string {
    const metadataLines = [
      `Company name: ${company.name}`,
      company.domain ? `Domain: ${company.domain}` : null,
      company.sector ? `Sector: ${company.sector}` : null,
    ].filter((line): line is string => line !== null);

    const publishedLine = mention.publishedAt
      ? `Published: ${mention.publishedAt.toISOString()}`
      : null;

    const articleLines = [
      `Title: ${normalized.title}`,
      mention.url ? `URL: ${mention.url}` : null,
      publishedLine,
      "",
      "Content snippet:",
      normalized.combinedText,
    ].filter((line): line is string => line !== null);

    return [
      "Analyze the following news mention for the portfolio company.",
      "",
      "Company metadata:",
      ...metadataLines.map((line) => `- ${line}`),
      "",
      "Article:",
      ...articleLines,
      "",
      "Tasks:",
      "1. Determine if the article is actually about this specific company (not a homonym or unrelated topic).",
      "2. If relevant, classify sentiment as positive, negative, or neutral for the company's business outlook.",
      "3. Provide a one-sentence summary of the mention's key takeaway.",
      "",
      "Sentiment guidelines:",
      "- positive: funding, partnerships, product wins, growth, awards",
      "- negative: layoffs, lawsuits, failures, regulatory trouble, data breaches",
      "- neutral: factual reporting without clear positive/negative business impact",
      "",
      "Return JSON with:",
      "- is_relevant: boolean",
      "- sentiment: one of positive, negative, neutral (use neutral if not relevant)",
      "- summary: brief takeaway",
    ].join("\n");
  }

  private normalizeResult(
    companyName: string,
    mention: RawMention,
    raw: RawSentimentDecision,
  ): AnalyzedMention {
    return {
      mention,
      companyName,
      isRelevant: raw.is_relevant,
      sentiment: this.parseSentiment(raw.sentiment),
      summary: raw.summary.trim(),
    };
  }

  private parseSentiment(value: string): SentimentType {
    const normalized = value.trim().toLowerCase();

    if (Object.values(SentimentType).includes(normalized as SentimentType)) {
      return normalized as SentimentType;
    }

    throw new Error(`[SentimentAnalyzer] Invalid sentiment returned by LLM: "${value}"`);
  }
}
