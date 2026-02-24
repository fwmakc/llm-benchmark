"use server";

import {
  openDatabase,
  listCriteriaSets,
  addCriteriaSet,
  deleteCriteriaSet,
  listCriteria,
  addCriterion,
  deleteCriterion,
} from "@llm-benchmark/core";
import type { CriteriaSet, Criterion, CriterionInput } from "@llm-benchmark/core";

function ensureDb() {
  openDatabase();
}

export async function getSets(): Promise<CriteriaSet[]> {
  ensureDb();
  return listCriteriaSets();
}

export async function createSet(name: string): Promise<CriteriaSet> {
  ensureDb();
  return addCriteriaSet(name);
}

export async function removeSet(id: string): Promise<{ ok: boolean }> {
  ensureDb();
  return { ok: deleteCriteriaSet(id) };
}

export async function getCriteria(setId?: string): Promise<Criterion[]> {
  ensureDb();
  return listCriteria(setId);
}

export async function createCriterion(input: CriterionInput): Promise<Criterion> {
  ensureDb();
  return addCriterion(input);
}

export async function removeCriterion(id: string): Promise<{ ok: boolean }> {
  ensureDb();
  return { ok: deleteCriterion(id) };
}
