"use server";

import { openDatabase, listModels, addModel, updateModel, deleteModel } from "@llm-benchmark/core";
import type { Model, ModelInput, ModelUpdateInput } from "@llm-benchmark/core";

function ensureDb() {
  openDatabase();
}

export async function getModels(): Promise<Model[]> {
  ensureDb();
  return listModels();
}

export async function createModel(input: ModelInput): Promise<Model> {
  ensureDb();
  return addModel(input);
}

export async function editModel(id: string, input: ModelUpdateInput): Promise<Model> {
  ensureDb();
  return updateModel(id, input);
}

export async function removeModel(id: string): Promise<{ ok: boolean }> {
  ensureDb();
  const ok = deleteModel(id);
  return { ok };
}
