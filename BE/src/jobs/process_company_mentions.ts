import type { AnalyzedMention } from "../analysis/index.js";
import { SentimentAnalyzer } from "../analysis/index.js";
import type { Mention } from "../data_layer/base_data_provider.js";
import { DatabaseService } from "../db/database_service.js";
import {
  analyzedMentionToMentionInput,
  dbMentionToAnalyzedMention,
} from "../db/mention_mappers.js";
import type { Company, SaveMentionsResult } from "../db/types.js";
import {
  RoutedDataFetcher,
  type RoutedFetchResult,
} from "../llm/routed_data_fetcher.js";
import type { CompanyMetadata } from "../llm/router_types.js";

export interface ProcessCompanyMentionsResult {
  company: Company;
  fetchResult: RoutedFetchResult;
  analyzed: AnalyzedMention[];
  cacheHits: number;
  analyzedByLlm: number;
  saved: SaveMentionsResult;
}

export interface ProcessCompanyMentionsOptions {
  fetcher: RoutedDataFetcher;
  analyzer: SentimentAnalyzer;
  db: DatabaseService;
}

export async function processCompanyMentions(
  company: CompanyMetadata,
  options: ProcessCompanyMentionsOptions,
): Promise<ProcessCompanyMentionsResult> {
  const fetchResult = await options.fetcher.fetchForCompany(company);
  const dbCompany = options.db.ensureCompany({
    name: company.name,
    domain: company.domain,
  });

  const { mentionsWithUrl, mentionsWithoutUrl } = partitionMentionsByUrl(
    fetchResult.mentions,
  );

  const cached = options.db.findMentionsByCompanyAndUrls(
    dbCompany.id,
    mentionsWithUrl.map((mention) => mention.url),
  );
  const cachedByUrl = new Map(cached.map((mention) => [mention.url, mention]));

  const uncachedMentions = mentionsWithUrl.filter(
    (mention) => !cachedByUrl.has(mention.url),
  );
  const toAnalyze: Mention[] = [...uncachedMentions, ...mentionsWithoutUrl];

  const newlyAnalyzed =
    toAnalyze.length > 0
      ? await options.analyzer.analyzeMentions(company, toAnalyze)
      : [];

  const saveableMentions = newlyAnalyzed.filter(
    (entry) => entry.mention.url.trim().length > 0,
  );
  const saved = options.db.saveMentions(
    saveableMentions.map((entry) =>
      analyzedMentionToMentionInput(entry, dbCompany.id),
    ),
  );

  const cachedAnalyzed = cached.map((mention) =>
    dbMentionToAnalyzedMention(mention, company.name, fetchResult.provider),
  );

  return {
    company: dbCompany,
    fetchResult,
    analyzed: [...cachedAnalyzed, ...newlyAnalyzed],
    cacheHits: cached.length,
    analyzedByLlm: newlyAnalyzed.length,
    saved,
  };
}

function partitionMentionsByUrl(mentions: Mention[]): {
  mentionsWithUrl: Mention[];
  mentionsWithoutUrl: Mention[];
} {
  const mentionsWithUrl: Mention[] = [];
  const mentionsWithoutUrl: Mention[] = [];

  for (const mention of mentions) {
    if (mention.url.trim().length > 0) {
      mentionsWithUrl.push(mention);
      continue;
    }

    mentionsWithoutUrl.push(mention);
  }

  return { mentionsWithUrl, mentionsWithoutUrl };
}
