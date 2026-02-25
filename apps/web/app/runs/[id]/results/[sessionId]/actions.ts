"use server";

import {
  openDatabase,
  computeResults,
  exportJSON,
  exportCSV,
} from "@llm-benchmark/core";
import type { RunResults } from "@llm-benchmark/core";

function ensureDb() {
  openDatabase();
}

export async function getResults(
  runId: string,
  sessionId: string
): Promise<RunResults> {
  ensureDb();
  return computeResults(runId, sessionId);
}

export async function downloadJSON(
  runId: string,
  sessionId: string
): Promise<string> {
  ensureDb();
  const results = computeResults(runId, sessionId);
  return exportJSON(results);
}

export async function downloadCSV(
  runId: string,
  sessionId: string
): Promise<string> {
  ensureDb();
  const results = computeResults(runId, sessionId);
  return exportCSV(results);
}
