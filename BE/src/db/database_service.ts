import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { openDatabase, resolveProjectDataDir } from "./connection.js";
import {
  MentionStatus,
  type Company,
  type CompanyInput,
  type CompanyMentionStatusResult,
  type IsoDateTimeString,
  type Mention,
  type MentionInput,
  type QuarterlyMentionsQuery,
  type SaveMentionsResult,
  type SentimentType,
} from "./types.js";

const QUARTERLY_WINDOW_DAYS = 90;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MS_PER_HOUR = 60 * 60 * 1000;

interface CompanyRow {
  id: string;
  name: string;
  domain: string;
  lastMentionedAt: string | null;
  status: MentionStatus;
  createdAt: string;
  updatedAt: string;
}

interface MentionRow {
  id: string;
  companyId: string;
  title: string;
  url: string;
  snippet: string | null;
  publishedAt: string;
  sentiment: SentimentType;
  isRelevant: number;
  summary: string;
  analyzedAt: string;
  createdAt: string;
}

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
          SELECT
            id,
            name,
            domain,
            lastMentionedAt,
            status,
            createdAt,
            updatedAt
          FROM companies
          WHERE lower(name) = lower(?)
          LIMIT 1
        `,
      )
      .get(name) as CompanyRow | undefined;

    return row ? this.mapCompanyRow(row) : null;
  }

  public ensureCompany(input: { name: string; domain?: string }): Company {
    const existing = this.getCompanyByName(input.name);
    if (existing) {
      return existing;
    }

    const domain = input.domain ?? this.domainPlaceholderFromName(input.name);
    return this.seedCompanies([{ name: input.name, domain }])[0];
  }

  public seedCompanies(companiesList: CompanyInput[]): Company[] {
    const now = this.nowIso();
    const upsert = this.db.prepare(`
      INSERT INTO companies (
        id,
        name,
        domain,
        lastMentionedAt,
        status,
        createdAt,
        updatedAt
      )
      VALUES (
        @id,
        @name,
        @domain,
        @lastMentionedAt,
        @status,
        @createdAt,
        @updatedAt
      )
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        domain = excluded.domain,
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
          domain: company.domain,
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
        isRelevant,
        summary,
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
        @isRelevant,
        @summary,
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
          isRelevant: mention.isRelevant ? 1 : 0,
          summary: mention.summary,
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
            isRelevant,
            summary,
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
            isRelevant,
            summary,
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

  public getQuarterlyMentions(query: QuarterlyMentionsQuery = {}): Mention[] {
    const quarterStart = this.daysAgoIso(QUARTERLY_WINDOW_DAYS);
    const sortBy = query.sortBy ?? "publishedAt";
    const sortDirection = query.sortDirection ?? "desc";
    const direction = sortDirection === "asc" ? "ASC" : "DESC";

    const params: string[] = [quarterStart];
    let companyFilter = "";

    if (query.companyId) {
      companyFilter = "AND companyId = ?";
      params.push(query.companyId);
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
            isRelevant,
            summary,
            analyzedAt,
            createdAt
          FROM mentions
          WHERE publishedAt >= ?
            ${companyFilter}
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
            AND isRelevant = 1
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
            isRelevant,
            summary,
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
          SELECT
            id,
            name,
            domain,
            lastMentionedAt,
            status,
            createdAt,
            updatedAt
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
            isRelevant,
            summary,
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
      domain: row.domain,
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
      isRelevant: row.isRelevant === 1,
      summary: row.summary,
      analyzedAt: row.analyzedAt,
      createdAt: row.createdAt,
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

  private domainPlaceholderFromName(name: string): string {
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    return `${slug || "company"}.local`;
  }
}
