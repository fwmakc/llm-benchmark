"use server";

import { openDatabase, listRuns, getRun, createRun, executeRun, listModels, listCriteria } from "@llm-benchmark/core";
import type { Run, RunWithDetails, Model, Criterion } from "@llm-benchmark/core";

function ensureDb() {
  openDatabase();
}

export async function getRunsList(): Promise<Run[]> {
  ensureDb();
  return listRuns();
}

export async function getRunDetails(id: string): Promise<RunWithDetails> {
  ensureDb();
  return getRun(id);
}

export async function getModelsForRun(): Promise<Model[]> {
  ensureDb();
  return listModels();
}

export async function getCriteriaForRun(): Promise<Criterion[]> {
  ensureDb();
  return listCriteria();
}

export async function startRun(input: {
  prompt: string;
  requestsPerModel: number;
  modelIds: string[];
  criteriaIds: string[];
}): Promise<string> {
  ensureDb();
  const run = createRun(input);
  await executeRun(run.id);
  return run.id;
}
