import { v4 as uuidv4 } from "uuid";
import { getDatabase } from "../db/database.js";
import type { Criterion, CriterionInput, CriterionUpdateInput } from "../types.js";

interface CriterionRow {
  id: string;
  name: string;
  max_score: number;
  weight: number;
  created_at: number;
}

function rowToCriterion(row: CriterionRow): Criterion {
  return {
    id: row.id,
    name: row.name,
    maxScore: row.max_score,
    weight: row.weight,
    createdAt: row.created_at,
  };
}

/** Returns all criteria ordered by creation date. */
export function listCriteria(): Criterion[] {
  const db = getDatabase();
  return (
    db.prepare("SELECT * FROM Criteria ORDER BY created_at ASC").all() as CriterionRow[]
  ).map(rowToCriterion);
}

/** Adds a new criterion and returns it. */
export function addCriterion(input: CriterionInput): Criterion {
  const db = getDatabase();
  const id = uuidv4();
  const now = Date.now();
  const maxScore = input.maxScore ?? 10;
  const weight = input.weight ?? 1;
  db.prepare(
    "INSERT INTO Criteria (id, name, max_score, weight, created_at) VALUES (?, ?, ?, ?, ?)"
  ).run(id, input.name, maxScore, weight, now);
  return { id, name: input.name, maxScore, weight, createdAt: now };
}

/** Updates a criterion by id. Returns the updated criterion, or null if not found. */
export function updateCriterion(id: string, input: CriterionUpdateInput): Criterion | null {
  const db = getDatabase();
  const existing = db.prepare("SELECT * FROM Criteria WHERE id = ?").get(id) as CriterionRow | undefined;
  if (!existing) return null;
  const name = input.name ?? existing.name;
  const maxScore = input.maxScore ?? existing.max_score;
  const weight = input.weight ?? existing.weight;
  db.prepare("UPDATE Criteria SET name = ?, max_score = ?, weight = ? WHERE id = ?").run(name, maxScore, weight, id);
  return { id, name, maxScore, weight, createdAt: existing.created_at };
}

/** Deletes a criterion by id. Returns true if a row was deleted. */
export function deleteCriterion(id: string): boolean {
  const db = getDatabase();
  const result = db.prepare("DELETE FROM Criteria WHERE id = ?").run(id);
  return result.changes > 0;
}
