import cron, { type ScheduledTask } from "node-cron";

import { SentimentAnalyzer } from "../analysis/index.js";
import { DatabaseService } from "../db/database_service.js";
import { QueuedMentionStatus } from "../db/types.js";
import { OllamaRuntime } from "../llm/ollama_runtime.js";
import {
  processQueuedMentions,
  type ProcessQueuedMentionsResult,
} from "./process_queued_mentions.js";

const DEFAULT_ANALYSIS_CRON_SCHEDULE = "*/5 * * * *";
const DEFAULT_TIMEZONE = "Asia/Jerusalem";
const DEFAULT_BATCH_SIZE = 10;

export interface MentionAnalysisManagerConfig {
  schedule?: string;
  timezone?: string;
  batchSize?: number;
  analyzer?: SentimentAnalyzer;
  db?: DatabaseService;
}

export class MentionAnalysisManager {
  private readonly schedule: string;
  private readonly timezone: string;
  private readonly batchSize: number;
  private readonly analyzer: SentimentAnalyzer;
  private readonly db: DatabaseService;
  private readonly ollamaRuntime: OllamaRuntime;
  private readonly ownsDatabase: boolean;
  private task: ScheduledTask | null = null;

  public constructor(config: MentionAnalysisManagerConfig = {}) {
    this.db = config.db ?? new DatabaseService();
    this.ownsDatabase = config.db === undefined;
    this.schedule = config.schedule ?? DEFAULT_ANALYSIS_CRON_SCHEDULE;
    this.timezone = config.timezone ?? DEFAULT_TIMEZONE;
    this.batchSize = config.batchSize ?? DEFAULT_BATCH_SIZE;
    this.analyzer = config.analyzer ?? new SentimentAnalyzer();
    this.ollamaRuntime = new OllamaRuntime();
  }

  public start(): void {
    if (this.task) {
      return;
    }

    if (!cron.validate(this.schedule)) {
      throw new Error(
        `[MentionAnalysisManager] Invalid cron schedule: "${this.schedule}"`,
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
      `[MentionAnalysisManager] Scheduled analysis run (${this.schedule}, ${this.timezone}) ` +
        `with batch size ${this.batchSize}`,
    );

    void this.ensureOllamaReady().catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      console.error(
        `[MentionAnalysisManager] Ollama startup check failed: ${message}`,
      );
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

  public async runOnce(): Promise<ProcessQueuedMentionsResult> {
    await this.ensureOllamaReady();

    const pendingBefore = this.db.countQueuedMentionsByStatus(
      QueuedMentionStatus.PENDING,
    );

    if (pendingBefore === 0) {
      console.log("[MentionAnalysisManager] No pending mentions in queue");
      return {
        claimed: 0,
        cacheHits: 0,
        analyzedByLlm: 0,
        saved: { inserted: 0, skipped: 0 },
        completed: 0,
        failed: 0,
        staleReset: 0,
      };
    }

    console.log(
      `[MentionAnalysisManager] Processing up to ${this.batchSize} of ${pendingBefore} pending mentions`,
    );

    console.time("[MentionAnalysisManager] Analyze batch");
    const result = await processQueuedMentions({
      analyzer: this.analyzer,
      db: this.db,
      batchSize: this.batchSize,
    });
    console.timeEnd("[MentionAnalysisManager] Analyze batch");

    const pendingAfter = this.db.countQueuedMentionsByStatus(
      QueuedMentionStatus.PENDING,
    );

    console.log(
      `[MentionAnalysisManager] Batch complete: ${result.claimed} claimed, ` +
        `${result.cacheHits} cache hits, ${result.analyzedByLlm} analyzed by LLM, ` +
        `${result.saved.inserted} saved, ${result.saved.skipped} skipped, ` +
        `${result.completed} completed, ${result.failed} failed` +
        `${result.staleReset > 0 ? `, ${result.staleReset} stale reset` : ""} — ` +
        `${pendingAfter} still pending`,
    );

    if (result.saved.inserted > 0) {
      const exported = this.db.exportToJsonFiles();
      console.log(
        `[MentionAnalysisManager] Exported snapshots to ${exported.companiesPath} and ${exported.mentionsPath}`,
      );
    }

    return result;
  }

  private async ensureOllamaReady(): Promise<void> {
    await this.ollamaRuntime.ensureReady();
  }
}

export function createMentionAnalysisManagerFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): MentionAnalysisManager {
  const batchSize = parsePositiveInt(env.QUEUE_PROCESS_BATCH_SIZE, DEFAULT_BATCH_SIZE);

  return new MentionAnalysisManager({
    schedule: env.ANALYSIS_CRON_SCHEDULE,
    timezone: env.CRON_TIMEZONE,
    batchSize,
  });
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (!raw) {
    return fallback;
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}
