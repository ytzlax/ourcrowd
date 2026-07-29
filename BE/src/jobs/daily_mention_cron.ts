import cron, { type ScheduledTask } from "node-cron";

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
}

export class DailyMentionCronJob {
  private readonly companyNames: string[];
  private readonly schedule: string;
  private readonly timezone: string;
  private readonly fetcher: RoutedDataFetcher;
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
        const result = await fetchCompanyMentions(companyName, this.fetcher);
        console.log(
          `[DailyMentionCronJob] ${companyName}: ${result.mentions.length} mentions via ${result.provider}`,
        );
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
