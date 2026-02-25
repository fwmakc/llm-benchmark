import { describe, it, expect, afterEach } from "vitest";
import Database from "better-sqlite3";
import fs from "fs";
import os from "os";
import path from "path";
import { openDatabase, getDatabase, closeDatabase } from "./database.js";

// Close and discard the in-memory DB after every test for full isolation
afterEach(() => {
  closeDatabase();
});

describe("openDatabase", () => {
  it("openDatabase — creates all tables on first call", () => {
    const db = openDatabase(":memory:");

    // Query sqlite_master to verify that expected tables were created
    const tableNames = (
      db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
        .all() as Array<{ name: string }>
    ).map((r) => r.name);

    expect(tableNames).toContain("Models");
    expect(tableNames).toContain("Criteria");
    expect(tableNames).toContain("Runs");
    expect(tableNames).toContain("Responses");
    expect(tableNames).toContain("Scores");
  });

  it("openDatabase — is idempotent (safe to call twice)", () => {
    const first = openDatabase(":memory:");
    // Second call with a different path argument is ignored — same instance returned
    const second = openDatabase(":memory:");
    expect(first).toBe(second);
  });
});

describe("getDatabase", () => {
  it("getDatabase — throws if called before openDatabase", () => {
    // afterEach has already closed the DB, so no open instance exists here
    expect(() => getDatabase()).toThrow("Database not initialized");
  });
});

describe("closeDatabase", () => {
  it("closeDatabase — allows re-open after close", () => {
    const first = openDatabase(":memory:");
    closeDatabase();

    // After close, a fresh open should succeed and return a new instance
    const second = openDatabase(":memory:");
    expect(second).not.toBe(first);
    expect(second.open).toBe(true);
  });
});

// Helper: create a temp file path and clean it up after use
function tmpDbPath(): string {
  return path.join(os.tmpdir(), `llm-bench-test-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
}

describe("runMigrations — CriteriaSets removal branch", () => {
  it("drops CriteriaSets and removes set_id from Criteria when old schema exists", () => {
    const dbPath = tmpDbPath();
    try {
      // Seed old schema with CriteriaSets table and Criteria.set_id column
      const seed = new Database(dbPath);
      seed.exec(`
        CREATE TABLE CriteriaSets (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL
        );
        CREATE TABLE Criteria (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          set_id TEXT REFERENCES CriteriaSets(id),
          max_score REAL NOT NULL DEFAULT 10,
          weight REAL NOT NULL DEFAULT 1.0,
          created_at INTEGER NOT NULL
        );
        INSERT INTO CriteriaSets (id, name) VALUES ('set1', 'Set One');
        INSERT INTO Criteria (id, name, set_id, max_score, weight, created_at)
          VALUES ('c1', 'Criterion One', 'set1', 10, 1.0, 1000);
      `);
      seed.close();

      // openDatabase runs migrations on the seeded file
      const db = openDatabase(dbPath);

      // CriteriaSets table must be gone
      const tables = (
        db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as Array<{ name: string }>
      ).map((r) => r.name);
      expect(tables).not.toContain("CriteriaSets");

      // Criteria table must no longer have set_id column
      const cols = (db.pragma("table_info(Criteria)") as Array<{ name: string }>).map((c) => c.name);
      expect(cols).not.toContain("set_id");

      // Existing data must be preserved
      const row = db.prepare("SELECT * FROM Criteria WHERE id = 'c1'").get() as { name: string };
      expect(row.name).toBe("Criterion One");
    } finally {
      closeDatabase();
      if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
    }
  });
});

describe("runMigrations — old Runs schema branch", () => {
  it("recreates Runs and Responses tables when old schema has 'name' column", () => {
    const dbPath = tmpDbPath();
    try {
      // Seed old Runs schema plus all other tables that SCHEMA_SQL would create,
      // so that SCHEMA_SQL skips them (CREATE TABLE IF NOT EXISTS) and the
      // subsequent Runs migration can DROP Responses safely (no FK pointing to it
      // because Scores is pre-seeded without a FK reference to Responses).
      const seed = new Database(dbPath);
      seed.exec(`
        CREATE TABLE Models (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          provider TEXT NOT NULL,
          model_id TEXT NOT NULL,
          api_key_encrypted TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          temperature REAL,
          max_tokens INTEGER,
          base_url TEXT
        );
        CREATE TABLE Criteria (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          max_score REAL NOT NULL DEFAULT 10,
          weight REAL NOT NULL DEFAULT 1.0,
          created_at INTEGER NOT NULL
        );
        CREATE TABLE Runs (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          requests_per_model INTEGER NOT NULL,
          created_at INTEGER NOT NULL
        );
        CREATE TABLE RunModels (
          run_id TEXT NOT NULL,
          model_id TEXT NOT NULL,
          PRIMARY KEY (run_id, model_id)
        );
        CREATE TABLE RunCriteria (
          run_id TEXT NOT NULL,
          criteria_id TEXT NOT NULL,
          PRIMARY KEY (run_id, criteria_id)
        );
        CREATE TABLE Responses (
          id TEXT PRIMARY KEY,
          run_id TEXT NOT NULL,
          model_id TEXT NOT NULL,
          content TEXT,
          tokens_used INTEGER,
          latency_ms INTEGER,
          error_msg TEXT,
          created_at INTEGER NOT NULL
        );
        CREATE TABLE ScoringSessions (
          id TEXT PRIMARY KEY,
          run_id TEXT NOT NULL,
          created_at INTEGER NOT NULL
        );
        CREATE TABLE Scores (
          id TEXT PRIMARY KEY,
          session_id TEXT NOT NULL,
          response_id TEXT NOT NULL,
          criterion_id TEXT NOT NULL,
          score REAL NOT NULL,
          notes TEXT,
          created_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_run_models_run   ON RunModels(run_id);
        CREATE INDEX IF NOT EXISTS idx_run_criteria_run ON RunCriteria(run_id);
        CREATE INDEX IF NOT EXISTS idx_responses_run    ON Responses(run_id);
        CREATE INDEX IF NOT EXISTS idx_responses_model  ON Responses(model_id);
        CREATE INDEX IF NOT EXISTS idx_scores_session   ON Scores(session_id);
        CREATE INDEX IF NOT EXISTS idx_scores_response  ON Scores(response_id);
        CREATE INDEX IF NOT EXISTS idx_scores_criterion ON Scores(criterion_id);
      `);
      seed.close();

      const db = openDatabase(dbPath);

      // After migration, Runs must have 'prompt' column and no 'name' column
      const runsCols = (db.pragma("table_info(Runs)") as Array<{ name: string }>).map((c) => c.name);
      expect(runsCols).toContain("prompt");
      expect(runsCols).not.toContain("name");
    } finally {
      closeDatabase();
      if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
    }
  });
});

describe("runMigrations — old Scores schema branch (missing session_id)", () => {
  it("drops and recreates Scores table when session_id column is absent", () => {
    const dbPath = tmpDbPath();
    try {
      // Seed Scores table without session_id (old schema)
      const seed = new Database(dbPath);
      seed.exec(`
        CREATE TABLE Scores (
          id TEXT PRIMARY KEY,
          response_id TEXT NOT NULL,
          criterion_id TEXT NOT NULL,
          score REAL NOT NULL,
          created_at INTEGER NOT NULL
        );
      `);
      seed.close();

      const db = openDatabase(dbPath);

      // After migration, Scores must have session_id column
      const scoresCols = (db.pragma("table_info(Scores)") as Array<{ name: string }>).map((c) => c.name);
      expect(scoresCols).toContain("session_id");
    } finally {
      closeDatabase();
      if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
    }
  });
});
