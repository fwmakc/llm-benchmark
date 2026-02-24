import { describe, it, expect, afterEach } from "vitest";
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
