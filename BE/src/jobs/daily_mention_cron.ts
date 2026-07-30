import cron, { type ScheduledTask } from "node-cron";

import { SentimentAnalyzer, type AnalyzedMention } from "../analysis/index.js";
import { DatabaseService } from "../db/database_service.js";
import type { Company } from "../db/types.js";
import { OllamaRuntime } from "../llm/ollama_runtime.js";
import type { CompanyMetadata } from "../data_layer/router_types.js";
import { RoutedDataFetcher } from "../data_layer/routed_data_fetcher.js";
import { processCompanyMentions } from "./process_company_mentions.js";

const DEFAULT_CRON_SCHEDULE = "0 6 * * *";
const DEFAULT_TIMEZONE = "Asia/Jerusalem";

export interface DailyMentionCronConfig {
  schedule?: string;
  timezone?: string;
  fetcher?: RoutedDataFetcher;
  analyzer?: SentimentAnalyzer;
  db?: DatabaseService;
}

export class DailyMentionCronJob {
  private readonly companies: CompanyMetadata[];
  private readonly schedule: string;
  private readonly timezone: string;
  private readonly fetcher: RoutedDataFetcher;
  private readonly analyzer: SentimentAnalyzer;
  private readonly db: DatabaseService;
  private readonly ollamaRuntime: OllamaRuntime;
  private readonly ownsDatabase: boolean;
  private task: ScheduledTask | null = null;

  public constructor(config: DailyMentionCronConfig = {}) {
    this.db = config.db ?? new DatabaseService();
    this.ownsDatabase = config.db === undefined;
    this.companies = this.loadCompaniesFromDb();
    this.schedule = config.schedule ?? DEFAULT_CRON_SCHEDULE;
    this.timezone = config.timezone ?? DEFAULT_TIMEZONE;
    this.fetcher = config.fetcher ?? new RoutedDataFetcher();
    this.analyzer = config.analyzer ?? new SentimentAnalyzer();
    this.ollamaRuntime = new OllamaRuntime();
  }

  public start(): void {
    if (this.task) {
      return;
    }

    if (!cron.validate(this.schedule)) {
      throw new Error(`[DailyMentionCronJob] Invalid cron schedule: "${this.schedule}"`);
    }

    this.task = cron.schedule(
      this.schedule,
      () => {
        void this.runOnce();
      },
      { timezone: this.timezone },
    );

    console.log(
      `[DailyMentionCronJob] Scheduled daily run (${this.schedule}, ${this.timezone}) for ${this.companies.length} companies`,
    );

    void this.ensureOllamaReady().catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[DailyMentionCronJob] Ollama startup check failed: ${message}`);
    });
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

  public async runOnce(): Promise<void> {
    await this.ensureOllamaReady();

    console.log(`[DailyMentionCronJob] Starting run for ${this.companies.length} companies`);

    for (const company of this.companies) {
      try {
        console.time(`[DailyMentionCronJob] Processing mentions for ${company.name}`);
        const result = await processCompanyMentions(company, {
          fetcher: this.fetcher,
          analyzer: this.analyzer,
          db: this.db,
        });
        console.timeEnd(`[DailyMentionCronJob] Processing mentions for ${company.name}`);

        console.log(
          `[DailyMentionCronJob] ${company.name}: ${result.analyzed.length} mentions ` +
            `(${result.cacheHits} cached, ${result.analyzedByLlm} analyzed, ` +
            `${result.saved.inserted} saved, ${result.saved.skipped} skipped) — ` +
            `${formatAnalysisSummary(result.analyzed)}`,
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[DailyMentionCronJob] Failed for ${company.name}: ${message}`);
      }
    }

    const exported = this.db.exportToJsonFiles();
    console.log(
      `[DailyMentionCronJob] Exported snapshots to ${exported.companiesPath} and ${exported.mentionsPath}`,
    );
    console.log("[DailyMentionCronJob] Run complete");
  }

  private async ensureOllamaReady(): Promise<void> {
    await this.ollamaRuntime.ensureReady();
  }

  private loadCompaniesFromDb(): CompanyMetadata[] {
    const companies = this.db.listCompanies().map(toCompanyMetadata);

    if (companies.length === 0) {
      throw new Error(
        "[DailyMentionCronJob] No companies found in the database — load companies first",
      );
    }

    return companies;
  }
}

export function createDailyMentionCronFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): DailyMentionCronJob {
  return new DailyMentionCronJob({
    schedule: env.CRON_SCHEDULE,
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

function formatAnalysisSummary(analyzed: AnalyzedMention[]): string {
  if (analyzed.length === 0) {
    return "no analysis";
  }

  const relevant = analyzed.filter((entry) => entry.isRelevant);
  const sentimentCounts = relevant.reduce<Record<string, number>>((counts, entry) => {
    counts[entry.sentiment] = (counts[entry.sentiment] ?? 0) + 1;
    return counts;
  }, {});

  const sentimentSummary = Object.entries(sentimentCounts)
    .map(([sentiment, count]) => `${count} ${sentiment}`)
    .join(", ");

  return `${relevant.length}/${analyzed.length} relevant${sentimentSummary ? ` (${sentimentSummary})` : ""}`;
}
