import { v4 as uuidv4 } from "uuid";
import { getDatabase } from "../db/database.js";
import type { CriteriaSet, Criterion, CriterionInput } from "../types.js";

interface CriteriaSetRow {
  id: string;
  name: string;
  created_at: number;
}

interface CriterionRow {
  id: string;
  set_id: string | null;
  name: string;
  max_score: number;
  weight: number;
  created_at: number;
}

function rowToSet(row: CriteriaSetRow): CriteriaSet {
  return { id: row.id, name: row.name, createdAt: row.created_at };
}

function rowToCriterion(row: CriterionRow): Criterion {
  return {
    id: row.id,
    setId: row.set_id,
    name: row.name,
    maxScore: row.max_score,
    weight: row.weight,
    createdAt: row.created_at,
  };
}

/** Returns all criteria sets ordered by creation date. */
export function listCriteriaSets(): CriteriaSet[] {
  const db = getDatabase();
  return (
    db.prepare("SELECT * FROM CriteriaSets ORDER BY created_at ASC").all() as CriteriaSetRow[]
  ).map(rowToSet);
}

/** Creates a new criteria set and returns it. */
export function addCriteriaSet(name: string): CriteriaSet {
  const db = getDatabase();
  const id = uuidv4();
  const now = Date.now();
  db.prepare("INSERT INTO CriteriaSets (id, name, created_at) VALUES (?, ?, ?)").run(id, name, now);
  return { id, name, createdAt: now };
}

/** Deletes a criteria set by id. Returns true if a row was deleted. */
export function deleteCriteriaSet(id: string): boolean {
  const db = getDatabase();
  const result = db.prepare("DELETE FROM CriteriaSets WHERE id = ?").run(id);
  return result.changes > 0;
}

/**
 * Returns criteria, optionally filtered by setId.
 * Pass null to return criteria that belong to no set.
 * Omit setId entirely (or pass undefined) to return all criteria.
 */
export function listCriteria(setId?: string | null): Criterion[] {
  const db = getDatabase();
  if (setId === undefined) {
    return (
      db.prepare("SELECT * FROM Criteria ORDER BY created_at ASC").all() as CriterionRow[]
    ).map(rowToCriterion);
  }
  return (
    db
      .prepare("SELECT * FROM Criteria WHERE set_id IS ? ORDER BY created_at ASC")
      .all(setId) as CriterionRow[]
  ).map(rowToCriterion);
}

/** Adds a new criterion and returns it. */
export function addCriterion(input: CriterionInput): Criterion {
  const db = getDatabase();
  const id = uuidv4();
  const now = Date.now();
  const maxScore = input.maxScore ?? 10;
  const weight = input.weight ?? 1;
  const setId = input.setId ?? null;
  db.prepare(
    "INSERT INTO Criteria (id, set_id, name, max_score, weight, created_at) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(id, setId, input.name, maxScore, weight, now);
  return { id, setId, name: input.name, maxScore, weight, createdAt: now };
}

/** Deletes a criterion by id. Returns true if a row was deleted. */
export function deleteCriterion(id: string): boolean {
  const db = getDatabase();
  const result = db.prepare("DELETE FROM Criteria WHERE id = ?").run(id);
  return result.changes > 0;
}
