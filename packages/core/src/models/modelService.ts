import { v4 as uuidv4 } from "uuid";
import { getDatabase } from "../db/database.js";
import { encrypt, decrypt } from "../security/encryption.js";
import type { Model, ModelInput } from "../types.js";

interface ModelRow {
  id: string;
  name: string;
  provider: string;
  model_id: string;
  api_key_encrypted: string;
  created_at: number;
  updated_at: number;
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
  };
}

/** Returns all models. API keys remain encrypted. */
export function listModels(): Model[] {
  const db = getDatabase();
  const rows = db
    .prepare("SELECT * FROM Models ORDER BY created_at ASC")
    .all() as ModelRow[];
  return rows.map(rowToModel);
}

/** Returns a single model by id, or null if not found. */
export function getModel(id: string): Model | null {
  const db = getDatabase();
  const row = db.prepare("SELECT * FROM Models WHERE id = ?").get(id) as ModelRow | undefined;
  return row ? rowToModel(row) : null;
}

/** Adds a new model, encrypting the API key before storage. */
export async function addModel(input: ModelInput): Promise<Model> {
  const db = getDatabase();
  const id = uuidv4();
  const now = Date.now();
  const apiKeyEncrypted = await encrypt(input.apiKey);

  db.prepare(
    `INSERT INTO Models (id, name, provider, model_id, api_key_encrypted, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(id, input.name, input.provider, input.modelId, apiKeyEncrypted, now, now);

  return rowToModel({
    id,
    name: input.name,
    provider: input.provider,
    model_id: input.modelId,
    api_key_encrypted: apiKeyEncrypted,
    created_at: now,
    updated_at: now,
  });
}

/** Deletes a model by id. Returns true if a row was deleted. */
export function deleteModel(id: string): boolean {
  const db = getDatabase();
  const result = db.prepare("DELETE FROM Models WHERE id = ?").run(id);
  return result.changes > 0;
}

/**
 * Decrypts and returns the plaintext API key for a model.
 * This is the ONLY place where plaintext keys are exposed — use with care.
 */
export async function getDecryptedApiKey(id: string): Promise<string | null> {
  const model = getModel(id);
  if (!model) return null;
  return decrypt(model.apiKeyEncrypted);
}
