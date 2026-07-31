import type { Mention } from "../data_ingestion_layer/base_data_provider.js";
import type { RoutedFetchResult } from "../data_ingestion_layer/routed_data_fetcher.js";
import type { CompanyMetadata } from "../data_ingestion_layer/router_types.js";
import { DatabaseService } from "../db/database_service.js";
import type { Company, QueuedMentionInput } from "../db/types.js";
import { RoutedDataFetcher } from "../data_ingestion_layer/routed_data_fetcher.js";
import { fetchCompanyMentions } from "./fetch_company_mentions.js";

export interface FetchAndQueueCompanyMentionsResult {
  company: Company;
  fetchResult: RoutedFetchResult;
  queued: {
    inserted: number;
    skipped: number;
    withoutUrl: number;
  };
}

export interface FetchAndQueueCompanyMentionsOptions {
  fetcher: RoutedDataFetcher;
  db: DatabaseService;
}

export async function fetchAndQueueCompanyMentions(
  company: CompanyMetadata,
  options: FetchAndQueueCompanyMentionsOptions,
): Promise<FetchAndQueueCompanyMentionsResult> {
  const dbCompany = options.db.ensureCompany({
    name: company.name,
  });

  const fetchResult = await fetchCompanyMentions(company, options.fetcher, {
    areUrlsKnown: (urls) =>
      new Set(options.db.findKnownUrlsForCompany(dbCompany.id, urls)),
  });

  const { queueable, withoutUrl } = partitionQueueableMentions(fetchResult.mentions);
  const queuedInputs = queueable.map((mention) =>
    toQueuedMentionInput(mention, dbCompany, fetchResult.provider),
  );
  const saved = options.db.saveQueuedMentions(queuedInputs);

  return {
    company: dbCompany,
    fetchResult,
    queued: {
      inserted: saved.inserted,
      skipped: saved.skipped,
      withoutUrl,
    },
  };
}

function partitionQueueableMentions(mentions: Mention[]): {
  queueable: Mention[];
  withoutUrl: number;
} {
  const queueable: Mention[] = [];
  let withoutUrl = 0;

  for (const mention of mentions) {
    if (mention.url.trim().length > 0) {
      queueable.push(mention);
      continue;
    }

    withoutUrl += 1;
  }

  return { queueable, withoutUrl };
}

function toQueuedMentionInput(
  mention: Mention,
  company: Company,
  provider: string,
): QueuedMentionInput {
  return {
    companyId: company.id,
    companyName: company.name,
    title: mention.title,
    url: mention.url,
    snippet: mention.snippet,
    publishedAt: toPublishedAtIso(mention.publishedAt),
    provider,
  };
}

function toPublishedAtIso(publishedAt: Date | null): string {
  if (publishedAt === null || Number.isNaN(publishedAt.getTime())) {
    return new Date().toISOString();
  }

  return publishedAt.toISOString();
}
