import type Database from "better-sqlite3";

import {
  CompanyType,
  MediaPresence,
  MentionStatus,
  SentimentType,
} from "./types.js";

function quoteSqlString(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

const SENTIMENT_VALUES = Object.values(SentimentType)
  .map((value) => quoteSqlString(value))
  .join(", ");

const MENTION_STATUS_VALUES = Object.values(MentionStatus)
  .map((value) => quoteSqlString(value))
  .join(", ");

const COMPANY_TYPE_VALUES = Object.values(CompanyType)
  .map((value) => quoteSqlString(value))
  .join(", ");

const MEDIA_PRESENCE_VALUES = Object.values(MediaPresence)
  .map((value) => quoteSqlString(value))
  .join(", ");

const DEFAULT_COMPANY_TYPE = CompanyType.B2B;
const DEFAULT_MEDIA_PRESENCE = MediaPresence.NICHE_TECH;

export function ensureSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS companies (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      companyType TEXT NOT NULL
        DEFAULT ${quoteSqlString(DEFAULT_COMPANY_TYPE)}
        CHECK (companyType IN (${COMPANY_TYPE_VALUES})),
      mediaPresence TEXT NOT NULL
        DEFAULT ${quoteSqlString(DEFAULT_MEDIA_PRESENCE)}
        CHECK (mediaPresence IN (${MEDIA_PRESENCE_VALUES})),
      lastMentionedAt TEXT NULL,
      status TEXT NOT NULL
        CHECK (status IN (${MENTION_STATUS_VALUES})),
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
  `);

  ensureCompanyColumns(db);

  db.exec(`
    CREATE TABLE IF NOT EXISTS mentions (
      id TEXT PRIMARY KEY,
      companyId TEXT NOT NULL,
      title TEXT NOT NULL,
      url TEXT NOT NULL,
      snippet TEXT NULL,
      publishedAt TEXT NOT NULL,
      sentiment TEXT NOT NULL
        CHECK (sentiment IN (${SENTIMENT_VALUES})),
      isRelevant INTEGER NOT NULL
        CHECK (isRelevant IN (0, 1)),
      summary TEXT NOT NULL,
      analyzedAt TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      UNIQUE (companyId, url),
      FOREIGN KEY (companyId) REFERENCES companies(id) ON DELETE CASCADE
    );
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_mentions_companyId
      ON mentions(companyId);

    CREATE INDEX IF NOT EXISTS idx_mentions_publishedAt
      ON mentions(publishedAt);

    CREATE INDEX IF NOT EXISTS idx_mentions_createdAt
      ON mentions(createdAt);
  `);
}

function ensureCompanyColumns(db: Database.Database): void {
  const columns = db
    .prepare(`PRAGMA table_info(companies)`)
    .all() as Array<{ name: string }>;
  const columnNames = new Set(columns.map((column) => column.name));

  if (!columnNames.has("companyType")) {
    db.exec(`
      ALTER TABLE companies
      ADD COLUMN companyType TEXT NOT NULL
        DEFAULT ${quoteSqlString(DEFAULT_COMPANY_TYPE)}
    `);
  }

  if (!columnNames.has("mediaPresence")) {
    db.exec(`
      ALTER TABLE companies
      ADD COLUMN mediaPresence TEXT NOT NULL
        DEFAULT ${quoteSqlString(DEFAULT_MEDIA_PRESENCE)}
    `);
  }
}