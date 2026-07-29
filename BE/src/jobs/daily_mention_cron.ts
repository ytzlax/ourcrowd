import cron, { type ScheduledTask } from "node-cron";

import { SentimentAnalyzer, type AnalyzedMention } from "../analysis/index.js";
import { OllamaRuntime } from "../llm/ollama_runtime.js";
import { RoutedDataFetcher } from "../llm/routed_data_fetcher.js";
import { fetchCompanyMentions } from "./fetch_company_mentions.js";

const DEFAULT_CRON_SCHEDULE = "0 6 * * *";
const DEFAULT_TIMEZONE = "Asia/Jerusalem";

export interface DailyMentionCronConfig {
  companyNames: string[];
  schedule?: string;
  timezone?: string;
  fetcher?: RoutedDataFetcher;
  analyzer?: SentimentAnalyzer;
}

export class DailyMentionCronJob {
  private readonly companyNames: string[];
  private readonly schedule: string;
  private readonly timezone: string;
  private readonly fetcher: RoutedDataFetcher;
  private readonly analyzer: SentimentAnalyzer;
  private readonly ollamaRuntime: OllamaRuntime;
  private task: ScheduledTask | null = null;

  public constructor(config: DailyMentionCronConfig) {
    if (config.companyNames.length === 0) {
      throw new Error("[DailyMentionCronJob] At least one company name is required");
    }

    this.companyNames = config.companyNames;
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
      `[DailyMentionCronJob] Scheduled daily run (${this.schedule}, ${this.timezone}) for ${this.companyNames.length} companies`,
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

  public async runOnce(): Promise<void> {
    await this.ensureOllamaReady();

    console.log(`[DailyMentionCronJob] Starting run for ${this.companyNames.length} companies`);

    for (const companyName of this.companyNames) {
      try {
        console.time(`[DailyMentionCronJob] Fetching mentions for ${companyName}`);
        const result = await fetchCompanyMentions(companyName, this.fetcher);
        console.timeEnd(`[DailyMentionCronJob] Fetching mentions for ${companyName}`);
        
        console.time(`[DailyMentionCronJob] Analyzing mentions for ${companyName}`);
        const analyzed = await this.analyzer.analyzeMentions({ name: companyName }, result.mentions);
        console.timeEnd(`[DailyMentionCronJob] Analyzing mentions for ${companyName}`);

        console.log(`[DailyMentionCronJob] ${companyName}: ${analyzed.length} mentions — ${formatAnalysisSummary(analyzed)}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[DailyMentionCronJob] Failed for ${companyName}: ${message}`);
      }
    }

    console.log("[DailyMentionCronJob] Run complete");
  }

  private async ensureOllamaReady(): Promise<void> {
    await this.ollamaRuntime.ensureReady();
  }
}

export function createDailyMentionCronFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): DailyMentionCronJob {
  const companyNames = parseCompanyNames(env.MONITORED_COMPANIES);

  return new DailyMentionCronJob({
    companyNames,
    schedule: env.CRON_SCHEDULE,
    timezone: env.CRON_TIMEZONE,
  });
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

function parseCompanyNames(raw: string | undefined): string[] {
  if (!raw?.trim()) {
    throw new Error(
      "[DailyMentionCronJob] MONITORED_COMPANIES env var is required (comma-separated company names)",
    );
  }

  return raw
    .split(",")
    .map((name) => name.trim())
    .filter((name) => name.length > 0);
}
