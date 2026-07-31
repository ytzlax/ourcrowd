import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { openDatabase, resolveProjectDataDir } from "./connection.js";
import {
  countSentiments,
  emptySentimentCounts,
  toSentimentBreakdown,
} from "./sentiment_stats.js";
import { RELEVANCE_SCORE_MIN } from "../analysis/analysis_types.js";
import {
  MentionStatus,
  type Company,
  type CompanyInput,
  type CompanyMentionStatusResult,
  type CompanyWithStats,
  type DashboardSummary,
  type IsoDateTimeString,
  type ListCompaniesQuery,
  type Mention,
  type MentionInput,
  type QuarterlyMentionsQuery,
  type QueuedMention,
  type QueuedMentionInput,
  QueuedMentionStatus,
  type SaveMentionsResult,
  type SaveQueuedMentionsResult,
  type SentimentCounts,
  type SentimentType,
} from "./types.js";

const QUARTERLY_WINDOW_DAYS = 90;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MS_PER_HOUR = 60 * 60 * 1000;
const MS_PER_MINUTE = 60 * 1000;

interface CompanyRow {
  id: string;
  name: string;
  lastMentionedAt: string | null;
  status: MentionStatus;
  createdAt: string;
  updatedAt: string;
}

const COMPANY_SELECT_COLUMNS = `
  id,
  name,
  lastMentionedAt,
  status,
  createdAt,
  updatedAt
`;

interface MentionRow {
  id: string;
  companyId: string;
  title: string;
  url: string;
  snippet: string | null;
  publishedAt: string;
  sentiment: SentimentType;
  summary: string;
  score: number;
  analyzedAt: string;
  createdAt: string;
}

interface QueuedMentionRow {
  id: string;
  companyId: string;
  companyName: string;
  title: string;
  url: string;
  snippet: string | null;
  publishedAt: string;
  provider: string;
  status: QueuedMentionStatus;
  fetchedAt: string;
  errorMessage: string | null;
  retryCount: number;
}

const QUEUED_MENTION_SELECT_COLUMNS = `
  id,
  companyId,
  companyName,
  title,
  url,
  snippet,
  publishedAt,
  provider,
  status,
  fetchedAt,
  errorMessage,
  retryCount
`;

export interface DatabaseServiceOptions {
  db?: Database.Database;
  dbPath?: string;
  dataDir?: string;
}

export class DatabaseService {
  private readonly db: Database.Database;
  private readonly dataDir: string;
  private readonly ownsConnection: boolean;

  public constructor(options: DatabaseServiceOptions = {}) {
    this.db = options.db ?? openDatabase({ dbPath: options.dbPath });
    this.dataDir = options.dataDir ?? resolveProjectDataDir();
    this.ownsConnection = options.db === undefined;
  }

  public close(): void {
    if (this.ownsConnection) {
      this.db.close();
    }
  }

  public getCompanyByName(name: string): Company | null {
    const row = this.db
      .prepare(
        `
          SELECT ${COMPANY_SELECT_COLUMNS}
          FROM companies
          WHERE lower(name) = lower(?)
          LIMIT 1
        `,
      )
      .get(name) as CompanyRow | undefined;

    return row ? this.mapCompanyRow(row) : null;
  }

  public ensureCompany(input: { name: string }): Company {
    const existing = this.getCompanyByName(input.name);
    if (existing) {
      return existing;
    }

    return this.seedCompanies([{ name: input.name }])[0];
  }

  public seedCompanies(companiesList: CompanyInput[]): Company[] {
    const now = this.nowIso();
    const upsert = this.db.prepare(`
      INSERT INTO companies (
        id,
        name,
        lastMentionedAt,
        status,
        createdAt,
        updatedAt
      )
      VALUES (
        @id,
        @name,
        @lastMentionedAt,
        @status,
        @createdAt,
        @updatedAt
      )
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        updatedAt = excluded.updatedAt
    `);

    const seeded: Company[] = [];

    const seedTransaction = this.db.transaction((companies: CompanyInput[]) => {
      for (const company of companies) {
        const id = company.id ?? randomUUID();
        const createdAt = now;
        const row: CompanyRow = {
          id,
          name: company.name,
          lastMentionedAt: company.lastMentionedAt ?? null,
          status: company.status ?? MentionStatus.NO_COVERAGE_FOUND,
          createdAt,
          updatedAt: now,
        };

        upsert.run(row);
        seeded.push(this.mapCompanyRow(row));
      }
    });

    seedTransaction(companiesList);
    return seeded;
  }

  public saveMentions(mentions: MentionInput[]): SaveMentionsResult {
    if (mentions.length === 0) {
      return { inserted: 0, skipped: 0 };
    }

    const now = this.nowIso();
    const insert = this.db.prepare(`
      INSERT OR IGNORE INTO mentions (
        id,
        companyId,
        title,
        url,
        snippet,
        publishedAt,
        sentiment,
        summary,
        score,
        analyzedAt,
        createdAt
      )
      VALUES (
        @id,
        @companyId,
        @title,
        @url,
        @snippet,
        @publishedAt,
        @sentiment,
        @summary,
        @score,
        @analyzedAt,
        @createdAt
      )
    `);

    let inserted = 0;
    let skipped = 0;
    const affectedCompanyIds = new Set<string>();

    const saveTransaction = this.db.transaction((items: MentionInput[]) => {
      for (const mention of items) {
        const result = insert.run({
          id: mention.id ?? randomUUID(),
          companyId: mention.companyId,
          title: mention.title,
          url: mention.url,
          snippet: mention.snippet,
          publishedAt: mention.publishedAt,
          sentiment: mention.sentiment,
          summary: mention.summary,
          score: mention.score,
          analyzedAt: mention.analyzedAt ?? now,
          createdAt: mention.createdAt ?? now,
        });

        if (result.changes > 0) {
          inserted += 1;
          affectedCompanyIds.add(mention.companyId);
          continue;
        }

        skipped += 1;
      }
    });

    saveTransaction(mentions);

    for (const companyId of affectedCompanyIds) {
      this.refreshCompanyMentionStatus(companyId);
    }

    return { inserted, skipped };
  }

  public saveQueuedMentions(
    mentions: QueuedMentionInput[],
  ): SaveQueuedMentionsResult {
    if (mentions.length === 0) {
      return { inserted: 0, skipped: 0 };
    }

    const now = this.nowIso();
    const insert = this.db.prepare(`
      INSERT OR IGNORE INTO q_mentions (
        id,
        companyId,
        companyName,
        title,
        url,
        snippet,
        publishedAt,
        provider,
        status,
        fetchedAt,
        errorMessage,
        retryCount
      )
      VALUES (
        @id,
        @companyId,
        @companyName,
        @title,
        @url,
        @snippet,
        @publishedAt,
        @provider,
        @status,
        @fetchedAt,
        @errorMessage,
        @retryCount
      )
    `);

    let inserted = 0;
    let skipped = 0;

    const saveTransaction = this.db.transaction((items: QueuedMentionInput[]) => {
      for (const mention of items) {
        const result = insert.run({
          id: mention.id ?? randomUUID(),
          companyId: mention.companyId,
          companyName: mention.companyName,
          title: mention.title,
          url: mention.url,
          snippet: mention.snippet,
          publishedAt: mention.publishedAt,
          provider: mention.provider,
          status: mention.status ?? QueuedMentionStatus.PENDING,
          fetchedAt: mention.fetchedAt ?? now,
          errorMessage: mention.errorMessage ?? null,
          retryCount: mention.retryCount ?? 0,
        });

        if (result.changes > 0) {
          inserted += 1;
          continue;
        }

        skipped += 1;
      }
    });

    saveTransaction(mentions);

    return { inserted, skipped };
  }

  public getMentionFetchCursorIndex(): number {
    const row = this.db
      .prepare(
        `
          SELECT lastCompanyIndex
          FROM mention_fetch_cursor
          WHERE id = 1
        `,
      )
      .get() as { lastCompanyIndex: number } | undefined;

    return row?.lastCompanyIndex ?? 0;
  }

  public setMentionFetchCursorIndex(index: number): void {
    this.db
      .prepare(
        `
          UPDATE mention_fetch_cursor
          SET
            lastCompanyIndex = @index,
            updatedAt = @updatedAt
          WHERE id = 1
        `,
      )
      .run({
        index,
        updatedAt: this.nowIso(),
      });
  }

  public countQueuedMentionsByStatus(
    status: QueuedMentionStatus,
  ): number {
    const row = this.db
      .prepare(
        `
          SELECT COUNT(*) AS count
          FROM q_mentions
          WHERE status = ?
        `,
      )
      .get(status) as { count: number };

    return row.count;
  }

  public claimPendingQueuedMentions(limit: number): QueuedMention[] {
    if (limit <= 0) {
      return [];
    }

    const claimTransaction = this.db.transaction((batchLimit: number) => {
      const rows = this.db
        .prepare(
          `
            SELECT ${QUEUED_MENTION_SELECT_COLUMNS}
            FROM q_mentions
            WHERE status = ?
            ORDER BY fetchedAt ASC
            LIMIT ?
          `,
        )
        .all(QueuedMentionStatus.PENDING, batchLimit) as QueuedMentionRow[];

      if (rows.length === 0) {
        return [];
      }

      const placeholders = rows.map(() => "?").join(", ");
      this.db
        .prepare(
          `
            UPDATE q_mentions
            SET status = ?
            WHERE id IN (${placeholders})
          `,
        )
        .run(QueuedMentionStatus.PROCESSING, ...rows.map((row) => row.id));

      return rows.map((row) =>
        this.mapQueuedMentionRow({
          ...row,
          status: QueuedMentionStatus.PROCESSING,
        }),
      );
    });

    return claimTransaction(limit);
  }

  public markQueuedMentionsDone(ids: string[]): void {
    if (ids.length === 0) {
      return;
    }

    const placeholders = ids.map(() => "?").join(", ");
    this.db
      .prepare(
        `
          UPDATE q_mentions
          SET
            status = ?,
            errorMessage = NULL
          WHERE id IN (${placeholders})
        `,
      )
      .run(QueuedMentionStatus.DONE, ...ids);
  }

  public markQueuedMentionsFailed(
    ids: string[],
    errorMessage: string,
  ): void {
    if (ids.length === 0) {
      return;
    }

    const placeholders = ids.map(() => "?").join(", ");
    this.db
      .prepare(
        `
          UPDATE q_mentions
          SET
            status = ?,
            errorMessage = ?,
            retryCount = retryCount + 1
          WHERE id IN (${placeholders})
        `,
      )
      .run(QueuedMentionStatus.FAILED, errorMessage, ...ids);
  }

  public resetStaleProcessingQueuedMentions(staleAfterMinutes: number): number {
    if (staleAfterMinutes <= 0) {
      return 0;
    }

    const threshold = new Date(
      Date.now() - staleAfterMinutes * MS_PER_MINUTE,
    ).toISOString();

    const result = this.db
      .prepare(
        `
          UPDATE q_mentions
          SET status = ?
          WHERE status = ?
            AND fetchedAt < ?
        `,
      )
      .run(QueuedMentionStatus.PENDING, QueuedMentionStatus.PROCESSING, threshold);

    return result.changes;
  }

  public findMentionByCompanyAndUrl(
    companyId: string,
    url: string,
  ): Mention | null {
    const row = this.db
      .prepare(
        `
          SELECT
            id,
            companyId,
            title,
            url,
            snippet,
            publishedAt,
            sentiment,
            summary,
            score,
            analyzedAt,
            createdAt
          FROM mentions
          WHERE companyId = ? AND url = ?
          LIMIT 1
        `,
      )
      .get(companyId, url) as MentionRow | undefined;

    return row ? this.mapMentionRow(row) : null;
  }

  public findMentionsByCompanyAndUrls(
    companyId: string,
    urls: string[],
  ): Mention[] {
    if (urls.length === 0) {
      return [];
    }

    const placeholders = urls.map(() => "?").join(", ");
    const rows = this.db
      .prepare(
        `
          SELECT
            id,
            companyId,
            title,
            url,
            snippet,
            publishedAt,
            sentiment,
            summary,
            score,
            analyzedAt,
            createdAt
          FROM mentions
          WHERE companyId = ?
            AND url IN (${placeholders})
        `,
      )
      .all(companyId, ...urls) as MentionRow[];

    return rows.map((row) => this.mapMentionRow(row));
  }

  /**
   * URLs already seen for this company in either analyzed mentions or the fetch queue.
   */
  public findKnownUrlsForCompany(
    companyId: string,
    urls: string[],
  ): string[] {
    if (urls.length === 0) {
      return [];
    }

    const placeholders = urls.map(() => "?").join(", ");
    const rows = this.db
      .prepare(
        `
          SELECT url FROM mentions
          WHERE companyId = ? AND url IN (${placeholders})
          UNION
          SELECT url FROM q_mentions
          WHERE companyId = ? AND url IN (${placeholders})
        `,
      )
      .all(companyId, ...urls, companyId, ...urls) as Array<{ url: string }>;

    return rows.map((row) => row.url);
  }

  public getQuarterlyMentions(query: QuarterlyMentionsQuery = {}): Mention[] {
    const quarterStart = this.daysAgoIso(QUARTERLY_WINDOW_DAYS);
    const sortBy = query.sortBy ?? "publishedAt";
    const sortDirection = query.sortDirection ?? "desc";
    const direction = sortDirection === "asc" ? "ASC" : "DESC";

    const params: Array<string | number> = [quarterStart];
    let companyFilter = "";
    let scoreFilter = "";

    if (query.companyId) {
      companyFilter = "AND companyId = ?";
      params.push(query.companyId);
    }

    if (query.minScore !== undefined) {
      scoreFilter = "AND score >= ?";
      params.push(query.minScore);
    }

    const rows = this.db
      .prepare(
        `
          SELECT
            id,
            companyId,
            title,
            url,
            snippet,
            publishedAt,
            sentiment,
            summary,
            score,
            analyzedAt,
            createdAt
          FROM mentions
          WHERE publishedAt >= ?
            ${companyFilter}
            ${scoreFilter}
          ORDER BY ${sortBy} ${direction}, createdAt DESC
        `,
      )
      .all(...params) as MentionRow[];

    return rows.map((row) => this.mapMentionRow(row));
  }

  public getCompanyMentionStatus(companyId: string): CompanyMentionStatusResult {
    const row = this.db
      .prepare(
        `
          SELECT MAX(publishedAt) AS lastMentionedAt
          FROM mentions
          WHERE companyId = ?
        `,
      )
      .get(companyId) as { lastMentionedAt: string | null } | undefined;

    const lastMentionedAt = row?.lastMentionedAt ?? null;

    if (!lastMentionedAt) {
      return {
        companyId,
        status: MentionStatus.NO_COVERAGE_FOUND,
        lastMentionedAt: null,
        daysSinceLastMention: null,
      };
    }

    const daysSinceLastMention = this.daysBetween(
      new Date(lastMentionedAt),
      new Date(),
    );

    return {
      companyId,
      status: MentionStatus.LAST_MENTIONED_X_DAYS_AGO,
      lastMentionedAt,
      daysSinceLastMention,
    };
  }

  public getRecentMentionsForAlert(hoursAgo = 24): Mention[] {
    const threshold = this.hoursAgoIso(hoursAgo);

    const rows = this.db
      .prepare(
        `
          SELECT
            id,
            companyId,
            title,
            url,
            snippet,
            publishedAt,
            sentiment,
            summary,
            score,
            analyzedAt,
            createdAt
          FROM mentions
          WHERE publishedAt >= ?
             OR createdAt >= ?
          ORDER BY createdAt DESC
        `,
      )
      .all(threshold, threshold) as MentionRow[];

    return rows.map((row) => this.mapMentionRow(row));
  }

  public exportToJsonFiles(): { companiesPath: string; mentionsPath: string } {
    mkdirSync(this.dataDir, { recursive: true });

    const companies = this.getAllCompanies();
    const mentions = this.getAllMentions();

    const companiesPath = path.join(this.dataDir, "companies.json");
    const mentionsPath = path.join(this.dataDir, "mentions.json");

    writeFileSync(companiesPath, JSON.stringify(companies, null, 2), "utf8");
    writeFileSync(mentionsPath, JSON.stringify(mentions, null, 2), "utf8");

    return { companiesPath, mentionsPath };
  }

  public getCompanyById(companyId: string): Company | null {
    const row = this.db
      .prepare(
        `
          SELECT ${COMPANY_SELECT_COLUMNS}
          FROM companies
          WHERE id = ?
          LIMIT 1
        `,
      )
      .get(companyId) as CompanyRow | undefined;

    return row ? this.mapCompanyRow(row) : null;
  }

  public listCompanies(query: ListCompaniesQuery = {}): Company[] {
    const companies = this.getAllCompanies();
    const search = query.search?.trim().toLowerCase();
    const statusFilter = query.status ?? "all";

    return companies.filter((company) => {
      if (statusFilter !== "all" && company.status !== statusFilter) {
        return false;
      }

      if (!search) {
        return true;
      }

      return (
        company.name.toLowerCase().includes(search));
    });
  }

  public listCompaniesWithStats(
    query: ListCompaniesQuery = {},
  ): CompanyWithStats[] {
    const minScore =
      query.minScore !== undefined && query.minScore > RELEVANCE_SCORE_MIN
        ? query.minScore
        : undefined;

    const companies = this.listCompanies(query);
    const quarterlyMentions = this.getQuarterlyMentions({ minScore });
    const sentimentByCompany = this.groupSentimentCountsByCompany(
      quarterlyMentions,
    );

    const scopedCompanies =
      minScore === undefined
        ? companies
        : companies.filter((company) => sentimentByCompany.has(company.id));

    return scopedCompanies.map((company) =>
      this.toCompanyWithStats(company, sentimentByCompany.get(company.id)),
    );
  }

  public getCompanyWithStats(companyId: string): CompanyWithStats | null {
    const company = this.getCompanyById(companyId);
    if (!company) {
      return null;
    }

    const quarterlyMentions = this.getQuarterlyMentions({ companyId });
    return this.toCompanyWithStats(company, countSentiments(quarterlyMentions));
  }

  public getDashboardSummary(): DashboardSummary {
    const companies = this.getAllCompanies();
    const quarterlyMentions = this.getQuarterlyMentions();
    const sentimentCounts = countSentiments(quarterlyMentions);

    return {
      totalCompanies: companies.length,
      quarterlyMentionCount: quarterlyMentions.length,
      sentimentBreakdown: toSentimentBreakdown(sentimentCounts),
    };
  }

  private toCompanyWithStats(
    company: Company,
    sentimentCounts?: SentimentCounts,
  ): CompanyWithStats {
    const daysSinceLastMention =
      company.lastMentionedAt === null
        ? null
        : this.daysBetween(new Date(company.lastMentionedAt), new Date());

    return {
      ...company,
      daysSinceLastMention,
      sentimentCounts: sentimentCounts ?? emptySentimentCounts(),
    };
  }

  private groupSentimentCountsByCompany(
    mentions: Mention[],
  ): Map<string, SentimentCounts> {
    const byCompany = new Map<string, Mention[]>();

    for (const mention of mentions) {
      const existing = byCompany.get(mention.companyId);
      if (existing) {
        existing.push(mention);
        continue;
      }

      byCompany.set(mention.companyId, [mention]);
    }

    const countsByCompany = new Map<string, SentimentCounts>();
    for (const [companyId, companyMentions] of byCompany) {
      countsByCompany.set(companyId, countSentiments(companyMentions));
    }

    return countsByCompany;
  }

  private refreshCompanyMentionStatus(companyId: string): void {
    const statusResult = this.getCompanyMentionStatus(companyId);

    this.db
      .prepare(
        `
          UPDATE companies
          SET
            lastMentionedAt = @lastMentionedAt,
            status = @status,
            updatedAt = @updatedAt
          WHERE id = @companyId
        `,
      )
      .run({
        companyId,
        lastMentionedAt: statusResult.lastMentionedAt,
        status: statusResult.status,
        updatedAt: this.nowIso(),
      });
  }

  private getAllCompanies(): Company[] {
    const rows = this.db
      .prepare(
        `
          SELECT ${COMPANY_SELECT_COLUMNS}
          FROM companies
          ORDER BY name ASC
        `,
      )
      .all() as CompanyRow[];

    return rows.map((row) => this.mapCompanyRow(row));
  }

  private getAllMentions(): Mention[] {
    const rows = this.db
      .prepare(
        `
          SELECT
            id,
            companyId,
            title,
            url,
            snippet,
            publishedAt,
            sentiment,
            summary,
            score,
            analyzedAt,
            createdAt
          FROM mentions
          ORDER BY publishedAt DESC, createdAt DESC
        `,
      )
      .all() as MentionRow[];

    return rows.map((row) => this.mapMentionRow(row));
  }

  private mapCompanyRow(row: CompanyRow): Company {
    return {
      id: row.id,
      name: row.name,
      lastMentionedAt: row.lastMentionedAt,
      status: row.status,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private mapMentionRow(row: MentionRow): Mention {
    return {
      id: row.id,
      companyId: row.companyId,
      title: row.title,
      url: row.url,
      snippet: row.snippet,
      publishedAt: row.publishedAt,
      sentiment: row.sentiment,
      summary: row.summary,
      score: row.score,
      analyzedAt: row.analyzedAt,
      createdAt: row.createdAt,
    };
  }

  private mapQueuedMentionRow(row: QueuedMentionRow): QueuedMention {
    return {
      id: row.id,
      companyId: row.companyId,
      companyName: row.companyName,
      title: row.title,
      url: row.url,
      snippet: row.snippet,
      publishedAt: row.publishedAt,
      provider: row.provider,
      status: row.status,
      fetchedAt: row.fetchedAt,
      errorMessage: row.errorMessage,
      retryCount: row.retryCount,
    };
  }

  private nowIso(): IsoDateTimeString {
    return new Date().toISOString();
  }

  private daysAgoIso(days: number): IsoDateTimeString {
    return new Date(Date.now() - days * MS_PER_DAY).toISOString();
  }

  private hoursAgoIso(hours: number): IsoDateTimeString {
    return new Date(Date.now() - hours * MS_PER_HOUR).toISOString();
  }

  private daysBetween(earlier: Date, later: Date): number {
    const diffMs = later.getTime() - earlier.getTime();
    return Math.max(0, Math.floor(diffMs / MS_PER_DAY));
  }
}
