"use server";

import { openDatabase, listCriteria, addCriterion, updateCriterion, deleteCriterion } from "@llm-benchmark/core";
import type { Criterion, CriterionInput, CriterionUpdateInput } from "@llm-benchmark/core";

function ensureDb() {
  openDatabase();
}

export async function getCriteria(): Promise<Criterion[]> {
  ensureDb();
  return listCriteria();
}

export async function createCriterion(input: CriterionInput): Promise<Criterion> {
  ensureDb();
  return addCriterion(input);
}

export async function editCriterion(id: string, input: CriterionUpdateInput): Promise<Criterion> {
  ensureDb();
  const updated = updateCriterion(id, input);
  if (!updated) throw new Error(`Criterion ${id} not found`);
  return updated;
}

export async function removeCriterion(id: string): Promise<void> {
  ensureDb();
  deleteCriterion(id);
}
