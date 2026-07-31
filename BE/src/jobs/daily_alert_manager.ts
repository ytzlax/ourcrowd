import cron, { type ScheduledTask } from "node-cron";

import { DatabaseService } from "../db/database_service.js";
import type { Mention } from "../db/types.js";
import {
  formatAlertDate,
  formatDailyAlertBox,
  formatEmptyAlertMessage,
  type CompanyAlertGroup,
} from "./format_daily_alert.js";

const DEFAULT_ALERT_CRON_SCHEDULE = "0 9 * * *";
const DEFAULT_TIMEZONE = "Asia/Jerusalem";
const DEFAULT_LOOKBACK_HOURS = 24;

export interface DailyAlertManagerConfig {
  schedule?: string;
  timezone?: string;
  lookbackHours?: number;
  db?: DatabaseService;
}

export interface DailyAlertRunResult {
  lookbackHours: number;
  mentionCount: number;
  companyCount: number;
  groups: CompanyAlertGroup[];
}

export class DailyAlertManager {
  private readonly schedule: string;
  private readonly timezone: string;
  private readonly lookbackHours: number;
  private readonly db: DatabaseService;
  private readonly ownsDatabase: boolean;
  private task: ScheduledTask | null = null;

  public constructor(config: DailyAlertManagerConfig = {}) {
    this.db = config.db ?? new DatabaseService();
    this.ownsDatabase = config.db === undefined;
    this.schedule = config.schedule ?? DEFAULT_ALERT_CRON_SCHEDULE;
    this.timezone = config.timezone ?? DEFAULT_TIMEZONE;
    this.lookbackHours = config.lookbackHours ?? DEFAULT_LOOKBACK_HOURS;
  }

  public start(): void {
    if (this.task) {
      return;
    }

    if (!cron.validate(this.schedule)) {
      throw new Error(
        `[DailyAlertManager] Invalid cron schedule: "${this.schedule}"`,
      );
    }

    this.task = cron.schedule(
      this.schedule,
      () => {
        try {
          this.runOnce();
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : String(error);
          console.error(`[DailyAlertManager] Scheduled run failed: ${message}`);
        }
      },
      { timezone: this.timezone },
    );

    console.log(
      `[DailyAlertManager] Scheduled daily alert (${this.schedule}, ${this.timezone}) ` +
        `with ${this.lookbackHours}h lookback`,
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

  public runOnce(): DailyAlertRunResult {
    console.log(
      `[DailyAlertManager] Checking for mentions in the last ${this.lookbackHours} hours`,
    );

    try {
      const recentMentions = this.db.getRecentMentionsForAlert(this.lookbackHours);
      const deduped = dedupeMentions(recentMentions);
      const groups = this.groupByCompany(deduped);

      if (groups.length === 0) {
        console.log(formatEmptyAlertMessage(this.lookbackHours));
        return {
          lookbackHours: this.lookbackHours,
          mentionCount: 0,
          companyCount: 0,
          groups: [],
        };
      }

      const alertBox = formatDailyAlertBox(groups, formatAlertDate());
      console.log(alertBox);

      console.log(
        `[DailyAlertManager] Alert complete: ${deduped.length} mention(s) across ${groups.length} company(ies)`,
      );

      return {
        lookbackHours: this.lookbackHours,
        mentionCount: deduped.length,
        companyCount: groups.length,
        groups,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[DailyAlertManager] Alert run failed: ${message}`);
      throw error;
    }
  }

  private groupByCompany(mentions: Mention[]): CompanyAlertGroup[] {
    const byCompanyId = new Map<string, Mention[]>();

    for (const mention of mentions) {
      const existing = byCompanyId.get(mention.companyId);
      if (existing) {
        existing.push(mention);
      } else {
        byCompanyId.set(mention.companyId, [mention]);
      }
    }

    const groups: CompanyAlertGroup[] = [];

    for (const [companyId, companyMentions] of byCompanyId) {
      const company = this.db.getCompanyById(companyId);
      groups.push({
        companyName: company?.name ?? `Unknown company (${companyId})`,
        mentions: companyMentions,
      });
    }

    groups.sort((a, b) => a.companyName.localeCompare(b.companyName));
    return groups;
  }
}

export function createDailyAlertManagerFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): DailyAlertManager {
  return new DailyAlertManager({
    schedule: env.ALERT_CRON_SCHEDULE,
    timezone: env.CRON_TIMEZONE,
    lookbackHours: parsePositiveInt(env.ALERT_LOOKBACK_HOURS, DEFAULT_LOOKBACK_HOURS),
  });
}

function dedupeMentions(mentions: Mention[]): Mention[] {
  const seen = new Set<string>();
  const unique: Mention[] = [];

  for (const mention of mentions) {
    const key = `${mention.companyId}::${mention.url}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    unique.push(mention);
  }

  return unique;
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
