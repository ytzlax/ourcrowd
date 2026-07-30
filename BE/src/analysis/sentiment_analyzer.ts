import type { Mention, RawMention } from "../data_layer/base_data_provider.js";
import { Llm } from "../llm/llm.js";
import { DEFAULT_LLM_MODEL } from "../llm/llm_model.js";
import type { CompanyMetadata } from "../data_layer/router_types.js";
import type { LlmConfig } from "../llm/types.js";
import {
  BATCH_SENTIMENT_DECISION_SCHEMA,
  SENTIMENT_DECISION_SCHEMA,
  type AnalyzedMention,
  type RawBatchSentimentItem,
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
      model: DEFAULT_LLM_MODEL,
      system: config.llm?.system ?? SENTIMENT_SYSTEM_PROMPT,
      options: { temperature: 0.1, ...config.llm?.options },
    });
  }

  public async analyzeMention(
    company: CompanyMetadata,
    mention: Mention,
  ): Promise<AnalyzedMention> {
    const normalized = normalizeMentionForAnalysis(mention);
    this.llm.prompt = this.buildAnalysisPrompt(company, mention, normalized);
    const raw = await this.llm.invokeStructured<RawSentimentDecision>(SENTIMENT_DECISION_SCHEMA);
    return this.normalizeResult(company.name, mention, raw);
  }

  public async analyzeMentions(
    company: CompanyMetadata,
    mentions: Mention[],
  ): Promise<AnalyzedMention[]> {
    if (mentions.length === 0) {
      return [];
    }

    if (mentions.length === 1) {
      return [await this.analyzeMention(company, mentions[0])];
    }

    return this.analyzeMentionsBatch(company, mentions);
  }

  private async analyzeMentionsBatch(
    company: CompanyMetadata,
    mentions: Mention[],
  ): Promise<AnalyzedMention[]> {
    this.llm.prompt = this.buildBatchAnalysisPrompt(company, mentions);
    const rawItems = await this.llm.invokeStructured<RawBatchSentimentItem[]>(
      BATCH_SENTIMENT_DECISION_SCHEMA,
    );

    const results: AnalyzedMention[] = [];

    for (let idx = 0; idx < mentions.length; idx++) {
      const mention = mentions[idx];
      const raw = this.resolveBatchItem(rawItems, idx);

      if (raw) {
        const result = this.normalizeResult(company.name, mention, raw);
        if (result.isRelevant) {
          results.push(result);
        }
        continue;
      }

      console.warn(
        `[SentimentAnalyzer] Batch missing index ${idx} for "${mention.title}"; falling back to single analysis`,
      );
      results.push(await this.analyzeMention(company, mention));
    }

    return results;
  }

  private resolveBatchItem(
    rawItems: RawBatchSentimentItem[],
    idx: number,
  ): RawBatchSentimentItem | undefined {
    const byIndex = rawItems.find((item) => Number(item.index) === idx);
    if (byIndex) {
      return byIndex;
    }

    const positional = rawItems[idx];
    if (positional && this.isUsableSentimentDecision(positional)) {
      return positional;
    }

    return undefined;
  }

  private isUsableSentimentDecision(
    item: RawBatchSentimentItem,
  ): item is RawBatchSentimentItem {
    return (
      typeof item.is_relevant === "boolean" &&
      typeof item.sentiment === "string" &&
      typeof item.summary === "string"
    );
  }

  private buildAnalysisPrompt(
    company: CompanyMetadata,
    mention: Mention,
    normalized: ReturnType<typeof normalizeMentionForAnalysis>,
  ): string {
    const metadataLines = [
      `Company name: ${company.name}`,
      company.sector ? `Sector/Domain: ${company.sector}` : null,
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
      "1. Determine if the article is genuinely about this specific tech company/startup.",
      "2. If relevant, classify sentiment as positive, negative, or neutral for the company's business outlook.",
      "3. Provide a one-sentence summary of the mention's key takeaway (or 'N/A' if not relevant).",
      "",
      "Relevance guidelines (is_relevant):",
      "- Set is_relevant = true IF: The article directly discusses, news-reports on, or features this specific company or its products/executives.",
      "- Set is_relevant = false IF:",
      "  * The name appears only as a general noun, phrase, or technical term (e.g., '3D signals', 'island', 'wave') rather than the company as a proper noun.",
      "  * The article is about an entirely different company/person with a similar or identical name.",
      "  * The company name is merely listed in a footer, tag cloud, or automated disclaimer without actual reporting on the company.",
      "",
      "Sentiment guidelines:",
      "- positive: funding, acquisitions, strategic partnerships, product launches, revenue growth, industry awards",
      "- negative: layoffs, lawsuits, security breaches, regulatory sanctions, product failures, financial loss",
      "- neutral: routine corporate announcements, balanced reporting, or general industry roundups",
      "",
      "Return JSON with:",
      "- is_relevant: boolean",
      "- sentiment: 'positive' | 'negative' | 'neutral' (use 'neutral' if is_relevant is false)",
      "- summary: brief takeaway",
    ].join("\n");
  }

  private buildBatchAnalysisPrompt(
    company: CompanyMetadata,
    mentions: Mention[],
  ): string {
    const metadataLines = [
      `Company name: ${company.name}`,
      company.sector ? `Sector: ${company.sector}` : null,
    ].filter((line): line is string => line !== null);

    const mentionBlocks = mentions.map((mention, idx) => {
      const normalized = normalizeMentionForAnalysis(mention);

      return [
        `[${idx}]`,
        `  Title: ${normalized.title}`,
        `  Content: ${normalized.combinedText}`,
      ].join("\n");
    });

    return [
      `Analyze the following ${mentions.length} news mentions for the portfolio company.`,
      "",
      "Company metadata:",
      ...metadataLines.map((line) => `- ${line}`),
      "",
      "Mentions:",
      ...mentionBlocks,
      "",
      "Tasks (for each mention):",
      "1. Determine if the article is actually about this specific company (not a homonym or unrelated topic).",
      "2. If relevant, classify sentiment as positive, negative, or neutral for the company's business outlook.",
      "3. Provide a one-sentence summary of the mention's key takeaway.",
      "",
      "Sentiment guidelines:",
      "- positive: funding, partnerships, product wins, growth, awards",
      "- negative: layoffs, lawsuits, failures, regulatory trouble, data breaches",
      "- neutral: factual reporting without clear positive/negative business impact",
      "",
      "Return a JSON array with one object per mention, each containing:",
      "- index: the mention index number from the list above",
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
