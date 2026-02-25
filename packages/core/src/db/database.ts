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
  // Drop old Scores table before SCHEMA_SQL if it lacks session_id column,
  // so the new CREATE TABLE IF NOT EXISTS creates it with the correct schema.
  const scoresColumns = database.pragma("table_info(Scores)") as Array<{ name: string }>;
  if (scoresColumns.length > 0 && !scoresColumns.some((c) => c.name === "session_id")) {
    database.exec("DROP TABLE IF EXISTS Scores;");
  }

  database.exec(SCHEMA_SQL);

  // Safe migrations for existing installs — ignore "duplicate column" errors
  const alterStatements = [
    "ALTER TABLE Models ADD COLUMN temperature REAL",
    "ALTER TABLE Models ADD COLUMN max_tokens INTEGER",
    "ALTER TABLE Models ADD COLUMN base_url TEXT",
    "ALTER TABLE Criteria ADD COLUMN max_score REAL NOT NULL DEFAULT 10",
  ];
  for (const sql of alterStatements) {
    try {
      database.exec(sql);
    } catch {
      // Column already exists — ignore
    }
  }

  // Drop CriteriaSets table if it exists (removed from schema)
  const tables = database.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='CriteriaSets'"
  ).get();
  if (tables) {
    // Remove set_id from Criteria by recreating the table
    const criteriaColumns = database.pragma("table_info(Criteria)") as Array<{ name: string }>;
    if (criteriaColumns.some((c) => c.name === "set_id")) {
      database.exec(`
        CREATE TABLE Criteria_new (
          id        TEXT PRIMARY KEY,
          name      TEXT NOT NULL,
          max_score REAL NOT NULL DEFAULT 10,
          weight    REAL NOT NULL DEFAULT 1.0,
          created_at INTEGER NOT NULL
        );
        INSERT INTO Criteria_new (id, name, max_score, weight, created_at)
          SELECT id, name, max_score, weight, created_at FROM Criteria;
        DROP TABLE Criteria;
        ALTER TABLE Criteria_new RENAME TO Criteria;
      `);
    }
    database.exec("DROP TABLE IF EXISTS CriteriaSets;");
  }

  // Migrate Runs table if old schema (has 'name' column instead of 'prompt')
  const runsColumns = database.pragma("table_info(Runs)") as Array<{ name: string }>;
  const hasOldRunsSchema =
    runsColumns.some((c) => c.name === "name") &&
    !runsColumns.some((c) => c.name === "prompt");
  if (hasOldRunsSchema) {
    database.exec(`
      DROP TABLE IF EXISTS Responses;
      DROP TABLE IF EXISTS Runs;
      CREATE TABLE Runs (
        id                  TEXT PRIMARY KEY,
        prompt              TEXT NOT NULL,
        requests_per_model  INTEGER NOT NULL,
        created_at          INTEGER NOT NULL
      );
      CREATE TABLE Responses (
        id          TEXT PRIMARY KEY,
        run_id      TEXT NOT NULL REFERENCES Runs(id) ON DELETE CASCADE,
        model_id    TEXT NOT NULL REFERENCES Models(id) ON DELETE CASCADE,
        content     TEXT,
        tokens_used INTEGER,
        latency_ms  INTEGER,
        error_msg   TEXT,
        created_at  INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_responses_run    ON Responses(run_id);
      CREATE INDEX IF NOT EXISTS idx_responses_model  ON Responses(model_id);
    `);
  }
}
