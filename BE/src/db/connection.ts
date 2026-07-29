import Database from "better-sqlite3";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { ensureSchema } from "./schema.js";

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(MODULE_DIR, "../../..");
const DEFAULT_DATA_DIR = path.join(PROJECT_ROOT, "data");
const DEFAULT_DB_FILENAME = "ourcrowd.db";

export function resolveProjectDataDir(): string {
  return DEFAULT_DATA_DIR;
}

export function resolveDefaultDbPath(): string {
  return path.join(DEFAULT_DATA_DIR, DEFAULT_DB_FILENAME);
}

export interface DatabaseConnectionOptions {
  dbPath?: string;
  readonly?: boolean;
}

export function openDatabase(
  options: DatabaseConnectionOptions = {},
): Database.Database {
  const dbPath = options.dbPath ?? resolveDefaultDbPath();
  const db = new Database(dbPath, { readonly: options.readonly ?? false });

  db.pragma("foreign_keys = ON");

  if (!options.readonly) {
    ensureSchema(db);
  }

  return db;
}
