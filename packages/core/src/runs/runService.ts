import { v4 as uuidv4 } from "uuid";
import { getDatabase } from "../db/database.js";
import { getDecryptedApiKey } from "../models/modelService.js";
import { getAdapter } from "../adapters/index.js";
import type { Run, RunInput, RunWithDetails, Response, Model, Criterion } from "../types.js";

interface RunRow {
  id: string;
  prompt: string;
  requests_per_model: number;
  created_at: number;
}

interface ResponseRow {
  id: string;
  run_id: string;
  model_id: string;
  content: string | null;
  tokens_used: number | null;
  latency_ms: number | null;
  error_msg: string | null;
  created_at: number;
}

interface ModelRow {
  id: string;
  name: string;
  provider: string;
  model_id: string;
  api_key_encrypted: string;
  created_at: number;
  updated_at: number;
  temperature: number | null;
  max_tokens: number | null;
  base_url: string | null;
}

interface CriterionRow {
  id: string;
  name: string;
  max_score: number;
  weight: number;
  created_at: number;
}

function rowToRun(row: RunRow): Run {
  return {
    id: row.id,
    prompt: row.prompt,
    requestsPerModel: row.requests_per_model,
    createdAt: row.created_at,
  };
}

function rowToResponse(row: ResponseRow): Response {
  return {
    id: row.id,
    runId: row.run_id,
    modelId: row.model_id,
    content: row.content,
    tokensUsed: row.tokens_used,
    latencyMs: row.latency_ms,
    errorMsg: row.error_msg,
    createdAt: row.created_at,
  };
}

function rowToModel(row: ModelRow): Model {
  return {
    id: row.id,
    name: row.name,
    provider: row.provider,
    modelId: row.model_id,
    apiKeyEncrypted: row.api_key_encrypted,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    temperature: row.temperature,
    maxTokens: row.max_tokens,
    baseUrl: row.base_url,
  };
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

/** Creates a run record and associates it with the given models and criteria. */
export function createRun(input: RunInput): Run {
  const db = getDatabase();
  const id = uuidv4();
  const createdAt = Date.now();

  db.prepare(`
    INSERT INTO Runs (id, prompt, requests_per_model, created_at)
    VALUES (?, ?, ?, ?)
  `).run(id, input.prompt, input.requestsPerModel, createdAt);

  const insertRunModel = db.prepare(`INSERT INTO RunModels (run_id, model_id) VALUES (?, ?)`);
  const insertRunCriteria = db.prepare(`INSERT INTO RunCriteria (run_id, criteria_id) VALUES (?, ?)`);

  for (const modelId of input.modelIds) {
    insertRunModel.run(id, modelId);
  }
  for (const criteriaId of input.criteriaIds) {
    insertRunCriteria.run(id, criteriaId);
  }

  return rowToRun(db.prepare(`SELECT * FROM Runs WHERE id = ?`).get(id) as RunRow);
}

/**
 * Executes all model requests for a run in parallel.
 * Errors per individual request are non-blocking — they are stored as error_msg in the response row.
 */
export async function executeRun(runId: string): Promise<void> {
  const db = getDatabase();
  const runRow = db.prepare(`SELECT * FROM Runs WHERE id = ?`).get(runId) as RunRow | undefined;
  if (!runRow) throw new Error(`Run ${runId} not found`);

  const modelRows = db.prepare(`
    SELECT m.* FROM Models m
    JOIN RunModels rm ON rm.model_id = m.id
    WHERE rm.run_id = ?
  `).all(runId) as ModelRow[];

  const tasks: Promise<void>[] = [];

  for (const modelRow of modelRows) {
    const model = rowToModel(modelRow);
    const adapter = getAdapter(model.provider);

    // Resolve API key outside the per-request loop (one decryption per model)
    let apiKey: string | undefined;
    try {
      const decrypted = await getDecryptedApiKey(model.id);
      apiKey = decrypted ?? undefined;
    } catch {
      // No key configured — adapter will fail or handle gracefully
    }

    const config = {
      modelId: model.modelId,
      apiKey,
      baseUrl: model.baseUrl ?? undefined,
      temperature: model.temperature ?? 0.7,
      maxTokens: model.maxTokens ?? 2048,
    };

    for (let i = 0; i < runRow.requests_per_model; i++) {
      tasks.push(
        (async () => {
          const responseId = uuidv4();
          const createdAt = Date.now();
          try {
            const result = await adapter.complete(runRow.prompt, config);
            db.prepare(`
              INSERT INTO Responses (id, run_id, model_id, content, tokens_used, latency_ms, error_msg, created_at)
              VALUES (?, ?, ?, ?, ?, ?, NULL, ?)
            `).run(
              responseId,
              runId,
              model.id,
              result.content,
              result.tokensUsed ?? null,
              result.latencyMs ?? null,
              createdAt,
            );
          } catch (err) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            db.prepare(`
              INSERT INTO Responses (id, run_id, model_id, content, tokens_used, latency_ms, error_msg, created_at)
              VALUES (?, ?, ?, NULL, NULL, NULL, ?, ?)
            `).run(responseId, runId, model.id, errorMsg, createdAt);
          }
        })()
      );
    }
  }

  await Promise.all(tasks);
}

/** Returns all runs, newest first. */
export function listRuns(): Run[] {
  const db = getDatabase();
  const rows = db.prepare(`SELECT * FROM Runs ORDER BY created_at DESC`).all() as RunRow[];
  return rows.map(rowToRun);
}

/** Returns a run with its associated models, criteria, and responses. Throws if not found. */
export function getRun(runId: string): RunWithDetails {
  const db = getDatabase();
  const runRow = db.prepare(`SELECT * FROM Runs WHERE id = ?`).get(runId) as RunRow | undefined;
  if (!runRow) throw new Error(`Run ${runId} not found`);

  const modelRows = db.prepare(`
    SELECT m.* FROM Models m
    JOIN RunModels rm ON rm.model_id = m.id
    WHERE rm.run_id = ?
  `).all(runId) as ModelRow[];

  const criteriaRows = db.prepare(`
    SELECT c.* FROM Criteria c
    JOIN RunCriteria rc ON rc.criteria_id = c.id
    WHERE rc.run_id = ?
  `).all(runId) as CriterionRow[];

  const responseRows = db.prepare(`
    SELECT * FROM Responses WHERE run_id = ? ORDER BY created_at ASC
  `).all(runId) as ResponseRow[];

  return {
    ...rowToRun(runRow),
    models: modelRows.map(rowToModel),
    criteria: criteriaRows.map(rowToCriterion),
    responses: responseRows.map(rowToResponse),
  };
}
