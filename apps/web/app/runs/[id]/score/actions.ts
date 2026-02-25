"use server";

import {
  openDatabase,
  getRun,
  createScoringSession,
  scoreResponse,
  getSessionScores,
  listScoringSessions,
} from "@llm-benchmark/core";
import type { ScoringSession, Score, RunWithDetails } from "@llm-benchmark/core";

function ensureDb() {
  openDatabase();
}

export async function getRunForScoring(id: string): Promise<RunWithDetails> {
  ensureDb();
  return getRun(id);
}

export async function startScoringSession(runId: string): Promise<ScoringSession> {
  ensureDb();
  return createScoringSession(runId);
}

export async function submitScore(input: {
  sessionId: string;
  responseId: string;
  criterionId: string;
  score: number;
  notes?: string | null;
}): Promise<Score> {
  ensureDb();
  return scoreResponse(input);
}

export async function fetchSessionScores(sessionId: string): Promise<Score[]> {
  ensureDb();
  return getSessionScores(sessionId);
}

export async function fetchScoringSessions(runId: string): Promise<ScoringSession[]> {
  ensureDb();
  return listScoringSessions(runId);
}
