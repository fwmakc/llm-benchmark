import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import os from "os";
import { SCHEMA_SQL } from "./schema.js";

let db: Database.Database | null = null;

function resolveDbPath(dbPath?: string): string {
  /* c8 ignore next 2 */
  if (!dbPath) return path.join(os.homedir(), ".llm-benchmark", "benchmark.db");
  return dbPath;
}

/**
 * Opens (or creates) the SQLite database and runs migrations.
 * Call once at application startup.
 */
export function openDatabase(dbPath?: string): Database.Database {
  if (db) return db;

  const resolvedPath = resolveDbPath(dbPath);
  const dir = path.dirname(resolvedPath);

  /* c8 ignore next 3 */
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  db = new Database(resolvedPath);

  // Enable WAL mode for better concurrency and performance
  db.pragma("journal_mode = WAL");
  // Enforce foreign key constraints
  db.pragma("foreign_keys = ON");

  runMigrations(db);

  return db;
}

/**
 * Returns the current open database instance.
 * Throws if openDatabase() has not been called first.
 */
export function getDatabase(): Database.Database {
  if (!db) throw new Error("Database not initialized. Call openDatabase() first.");
  return db;
}

/**
 * Closes the database. Mainly for tests / clean shutdown.
 */
export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}

function runMigrations(database: Database.Database): void {
  database.exec(SCHEMA_SQL);

  // Safe migrations for existing installs — ignore "duplicate column" errors
  const alterStatements = [
    "ALTER TABLE Models ADD COLUMN temperature REAL",
    "ALTER TABLE Models ADD COLUMN max_tokens INTEGER",
    "ALTER TABLE Models ADD COLUMN base_url TEXT",
    "ALTER TABLE Criteria ADD COLUMN set_id TEXT",
    "ALTER TABLE Criteria ADD COLUMN max_score REAL NOT NULL DEFAULT 10",
  ];
  for (const sql of alterStatements) {
    try {
      database.exec(sql);
    } catch {
      // Column already exists — ignore
    }
  }
}
