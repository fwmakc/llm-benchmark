import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import os from "os";
import { SCHEMA_SQL } from "./schema.js";

let db: Database.Database | null = null;

function resolveDbPath(dbPath?: string): string {
  if (dbPath) return dbPath;
  return path.join(os.homedir(), ".llm-benchmark", "benchmark.db");
}

/**
 * Opens (or creates) the SQLite database and runs migrations.
 * Call once at application startup.
 */
export function openDatabase(dbPath?: string): Database.Database {
  if (db) return db;

  const resolvedPath = resolveDbPath(dbPath);
  const dir = path.dirname(resolvedPath);

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
}
