import { v4 as uuidv4 } from "uuid";
import { getDatabase } from "../db/database.js";
import type { ScoringSession, Score } from "../types.js";

interface SessionRow {
  id: string;
  run_id: string;
  created_at: number;
}

interface ScoreRow {
  id: string;
  session_id: string;
  response_id: string;
  criterion_id: string;
  score: number;
  notes: string | null;
  created_at: number;
}

function rowToSession(row: SessionRow): ScoringSession {
  return { id: row.id, runId: row.run_id, createdAt: row.created_at };
}

function rowToScore(row: ScoreRow): Score {
  return {
    id: row.id,
    sessionId: row.session_id,
    responseId: row.response_id,
    criterionId: row.criterion_id,
    score: row.score,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

/** Creates a new scoring session for a run. */
export function createScoringSession(runId: string): ScoringSession {
  const db = getDatabase();
  const id = uuidv4();
  const createdAt = Date.now();
  db.prepare(
    "INSERT INTO ScoringSessions (id, run_id, created_at) VALUES (?, ?, ?)"
  ).run(id, runId, createdAt);
  return { id, runId, createdAt };
}

/** Records a score for one response against one criterion within a session. */
export function scoreResponse(input: {
  sessionId: string;
  responseId: string;
  criterionId: string;
  score: number;
  notes?: string | null;
}): Score {
  const db = getDatabase();
  const id = uuidv4();
  const createdAt = Date.now();
  const notes = input.notes ?? null;
  db.prepare(
    "INSERT INTO Scores (id, session_id, response_id, criterion_id, score, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(
    id,
    input.sessionId,
    input.responseId,
    input.criterionId,
    input.score,
    notes,
    createdAt
  );
  return {
    id,
    sessionId: input.sessionId,
    responseId: input.responseId,
    criterionId: input.criterionId,
    score: input.score,
    notes,
    createdAt,
  };
}

/** Returns all scores for a session, ordered oldest first. */
export function getSessionScores(sessionId: string): Score[] {
  const db = getDatabase();
  return (
    db
      .prepare(
        "SELECT * FROM Scores WHERE session_id = ? ORDER BY created_at ASC"
      )
      .all(sessionId) as ScoreRow[]
  ).map(rowToScore);
}

/** Returns all scoring sessions for a run, newest first. */
export function listScoringSessions(runId: string): ScoringSession[] {
  const db = getDatabase();
  return (
    db
      .prepare(
        "SELECT * FROM ScoringSessions WHERE run_id = ? ORDER BY created_at DESC"
      )
      .all(runId) as SessionRow[]
  ).map(rowToSession);
}
