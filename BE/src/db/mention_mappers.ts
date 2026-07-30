import type { AnalyzedMention } from "../analysis/analysis_types.js";
import {
  DataProviderType,
  type Mention,
  type RawMention,
} from "../data_layer/base_data_provider.js";
import type { Mention as DbMention, MentionInput, QueuedMention } from "./types.js";

export function dbMentionToAnalyzedMention(
  mention: DbMention,
  companyName: string,
  source: DataProviderType = DataProviderType.GOOGLE_RSS,
): AnalyzedMention {
  const rawMention: RawMention = {
    title: mention.title,
    url: mention.url,
    snippet: mention.snippet ?? "",
    publishedAt: new Date(mention.publishedAt),
    source,
  };

  return {
    mention: rawMention,
    companyName,
    isRelevant: mention.isRelevant,
    sentiment: mention.sentiment,
    summary: mention.summary,
  };
}

export function analyzedMentionToMentionInput(
  analyzed: AnalyzedMention,
  companyId: string,
): MentionInput {
  const publishedAt =
    analyzed.mention.publishedAt?.toISOString() ?? new Date().toISOString();

  return {
    companyId,
    title: analyzed.mention.title,
    url: analyzed.mention.url,
    snippet: analyzed.mention.snippet || null,
    publishedAt,
    sentiment: analyzed.sentiment,
    isRelevant: analyzed.isRelevant,
    summary: analyzed.summary,
    analyzedAt: new Date().toISOString(),
  };
}

export function queuedMentionToMention(queued: QueuedMention): Mention {
  return {
    title: queued.title,
    url: queued.url,
    snippet: queued.snippet ?? "",
    publishedAt: new Date(queued.publishedAt),
    source: parseProviderType(queued.provider),
  };
}

function parseProviderType(provider: string): DataProviderType {
  if (
    Object.values(DataProviderType).includes(provider as DataProviderType)
  ) {
    return provider as DataProviderType;
  }

  return DataProviderType.GOOGLE_RSS;
}
