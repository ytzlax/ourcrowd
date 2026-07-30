import { SentimentAnalyzer } from "../analysis/index.js";
import type { Mention } from "../data_layer/base_data_provider.js";
import type { CompanyMetadata } from "../data_layer/router_types.js";
import { DatabaseService } from "../db/database_service.js";
import {
  analyzedMentionToMentionInput,
  queuedMentionToMention,
} from "../db/mention_mappers.js";
import type { QueuedMention, SaveMentionsResult } from "../db/types.js";

const DEFAULT_BATCH_SIZE = 10;
const DEFAULT_STALE_PROCESSING_MINUTES = 30;

export interface ProcessQueuedMentionsResult {
  claimed: number;
  cacheHits: number;
  analyzedByLlm: number;
  saved: SaveMentionsResult;
  completed: number;
  failed: number;
  staleReset: number;
}

export interface ProcessQueuedMentionsOptions {
  analyzer: SentimentAnalyzer;
  db: DatabaseService;
  batchSize?: number;
  staleProcessingMinutes?: number;
}

export async function processQueuedMentions(
  options: ProcessQueuedMentionsOptions,
): Promise<ProcessQueuedMentionsResult> {
  const batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;
  const staleProcessingMinutes =
    options.staleProcessingMinutes ?? DEFAULT_STALE_PROCESSING_MINUTES;

  const staleReset = options.db.resetStaleProcessingQueuedMentions(
    staleProcessingMinutes,
  );
  const claimed = options.db.claimPendingQueuedMentions(batchSize);

  if (claimed.length === 0) {
    return {
      claimed: 0,
      cacheHits: 0,
      analyzedByLlm: 0,
      saved: { inserted: 0, skipped: 0 },
      completed: 0,
      failed: 0,
      staleReset,
    };
  }

  const groups = groupQueuedMentionsByCompany(claimed);
  let cacheHits = 0;
  let analyzedByLlm = 0;
  let completed = 0;
  let failed = 0;
  const saved: SaveMentionsResult = { inserted: 0, skipped: 0 };

  for (const items of groups.values()) {
    try {
      const groupResult = await processQueuedMentionGroup(items, options);
      cacheHits += groupResult.cacheHits;
      analyzedByLlm += groupResult.analyzedByLlm;
      saved.inserted += groupResult.saved.inserted;
      saved.skipped += groupResult.saved.skipped;
      options.db.markQueuedMentionsDone(items.map((item) => item.id));
      completed += items.length;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      options.db.markQueuedMentionsFailed(
        items.map((item) => item.id),
        message,
      );
      failed += items.length;
    }
  }

  return {
    claimed: claimed.length,
    cacheHits,
    analyzedByLlm,
    saved,
    completed,
    failed,
    staleReset,
  };
}

interface ProcessQueuedMentionGroupResult {
  cacheHits: number;
  analyzedByLlm: number;
  saved: SaveMentionsResult;
}

async function processQueuedMentionGroup(
  items: QueuedMention[],
  options: ProcessQueuedMentionsOptions,
): Promise<ProcessQueuedMentionGroupResult> {
  const company = options.db.getCompanyById(items[0].companyId);
  if (!company) {
    throw new Error(
      `Company not found for queued mentions: ${items[0].companyId}`,
    );
  }

  const companyMetadata: CompanyMetadata = {
    name: company.name,
    companyType: company.companyType,
    mediaPresence: company.mediaPresence,
  };

  const mentions = items.map((item) => queuedMentionToMention(item));
  const cached = options.db.findMentionsByCompanyAndUrls(
    company.id,
    mentions.map((mention) => mention.url),
  );
  const cachedUrls = new Set(cached.map((mention) => mention.url));

  const uncachedItems = items.filter((item) => !cachedUrls.has(item.url));
  const uncachedMentions: Mention[] = uncachedItems.map((item) =>
    queuedMentionToMention(item),
  );

  const newlyAnalyzed =
    uncachedMentions.length > 0
      ? await options.analyzer.analyzeMentions(companyMetadata, uncachedMentions)
      : [];

  const saveableMentions = newlyAnalyzed.filter(
    (entry) => entry.isRelevant && entry.mention.url.trim().length > 0,
  );
  const saved = options.db.saveMentions(
    saveableMentions.map((entry) =>
      analyzedMentionToMentionInput(entry, company.id),
    ),
  );

  return {
    cacheHits: cached.length,
    analyzedByLlm: newlyAnalyzed.length,
    saved,
  };
}

function groupQueuedMentionsByCompany(
  items: QueuedMention[],
): Map<string, QueuedMention[]> {
  const groups = new Map<string, QueuedMention[]>();

  for (const item of items) {
    const existing = groups.get(item.companyId);
    if (existing) {
      existing.push(item);
      continue;
    }

    groups.set(item.companyId, [item]);
  }

  return groups;
}
