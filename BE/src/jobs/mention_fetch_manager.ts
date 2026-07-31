import cron, { type ScheduledTask } from "node-cron";

import { DatabaseService } from "../db/database_service.js";
import { QueuedMentionStatus, type Company } from "../db/types.js";
import { RoutedDataFetcher } from "../data_ingestion_layer/routed_data_fetcher.js";
import type { CompanyMetadata } from "../data_ingestion_layer/router_types.js";
import { fetchAndQueueCompanyMentions } from "./fetch_and_queue_company_mentions.js";

const DEFAULT_FETCH_CRON_SCHEDULE = "*/10 * * * *";
const DEFAULT_TIMEZONE = "Asia/Jerusalem";

export interface MentionFetchManagerConfig {
  schedule?: string;
  timezone?: string;
  fetcher?: RoutedDataFetcher;
  db?: DatabaseService;
}

export interface MentionFetchRunResult {
  company: Company;
  mentionsFetched: number;
  queuedInserted: number;
  queuedSkipped: number;
  mentionsWithoutUrl: number;
  provider: string;
  cursorIndex: number;
  nextCursorIndex: number;
}

export class MentionFetchManager {
  private readonly companies: CompanyMetadata[];
  private readonly schedule: string;
  private readonly timezone: string;
  private readonly fetcher: RoutedDataFetcher;
  private readonly db: DatabaseService;
  private readonly ownsDatabase: boolean;
  private task: ScheduledTask | null = null;

  public constructor(config: MentionFetchManagerConfig = {}) {
    this.db = config.db ?? new DatabaseService();
    this.ownsDatabase = config.db === undefined;
    this.companies = this.loadCompaniesFromDb();
    this.schedule = config.schedule ?? DEFAULT_FETCH_CRON_SCHEDULE;
    this.timezone = config.timezone ?? DEFAULT_TIMEZONE;
    this.fetcher = config.fetcher ?? new RoutedDataFetcher();
  }

  public start(): void {
    if (this.task) {
      return;
    }

    if (!cron.validate(this.schedule)) {
      throw new Error(
        `[MentionFetchManager] Invalid cron schedule: "${this.schedule}"`,
      );
    }

    this.task = cron.schedule(
      this.schedule,
      () => {
        void this.runOnce();
      },
      { timezone: this.timezone },
    );

    console.log(
      `[MentionFetchManager] Scheduled fetch run (${this.schedule}, ${this.timezone}) ` +
        `across ${this.companies.length} companies (one company per tick)`,
    );
  }

  public stop(): void {
    this.task?.stop();
    this.task = null;
  }

  public close(): void {
    this.stop();

    if (this.ownsDatabase) {
      this.db.close();
    }
  }

  public async runOnce(): Promise<MentionFetchRunResult> {
    if (this.companies.length === 0) {
      throw new Error(
        "[MentionFetchManager] No companies found in the database — load companies first",
      );
    }

    const cursorIndex = this.db.getMentionFetchCursorIndex() % this.companies.length;
    const company = this.companies[cursorIndex];
    const nextCursorIndex = (cursorIndex + 1) % this.companies.length;

    console.log(
      `[MentionFetchManager] Fetching mentions for ${company.name} ` +
        `(company ${cursorIndex + 1}/${this.companies.length})`,
    );

    try {
      console.time(`[MentionFetchManager] Fetch ${company.name}`);
      const result = await fetchAndQueueCompanyMentions(company, {
        fetcher: this.fetcher,
        db: this.db,
      });
      console.timeEnd(`[MentionFetchManager] Fetch ${company.name}`);

      this.db.setMentionFetchCursorIndex(nextCursorIndex);

      const pendingCount = this.db.countQueuedMentionsByStatus(
        QueuedMentionStatus.PENDING,
      );

      console.log(
        `[MentionFetchManager] ${company.name}: ${result.fetchResult.mentions.length} fetched, ` +
          `${result.queued.inserted} queued, ${result.queued.skipped} already queued, ` +
          `${result.queued.withoutUrl} without URL — ` +
          `provider ${result.fetchResult.provider}, ` +
          `${pendingCount} pending in queue`,
      );

      return {
        company: result.company,
        mentionsFetched: result.fetchResult.mentions.length,
        queuedInserted: result.queued.inserted,
        queuedSkipped: result.queued.skipped,
        mentionsWithoutUrl: result.queued.withoutUrl,
        provider: result.fetchResult.provider,
        cursorIndex,
        nextCursorIndex,
      };
    } catch (error) {
      this.db.setMentionFetchCursorIndex(nextCursorIndex);

      const message = error instanceof Error ? error.message : String(error);
      console.error(`[MentionFetchManager] Failed for ${company.name}: ${message}`);
      throw error;
    }
  }

  private loadCompaniesFromDb(): CompanyMetadata[] {
    const companies = this.db.listCompanies().map(toCompanyMetadata);

    if (companies.length === 0) {
      throw new Error(
        "[MentionFetchManager] No companies found in the database — load companies first",
      );
    }

    return companies;
  }
}

export function createMentionFetchManagerFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): MentionFetchManager {
  return new MentionFetchManager({
    schedule: env.FETCH_CRON_SCHEDULE,
    timezone: env.CRON_TIMEZONE,
  });
}

function toCompanyMetadata(company: Company): CompanyMetadata {
  return {
    name: company.name,
    companyType: company.companyType,
    mediaPresence: company.mediaPresence,
  };
}
