export const APP_NAME = "LLM Benchmark";

export function getVersion(): string {
  return "1.0.0";
}

// Database
export { openDatabase, getDatabase, closeDatabase } from "./db/database.js";

// Security
export { encrypt, decrypt, clearKeyCache } from "./security/encryption.js";

// Models
export { listModels, getModel, addModel, updateModel, deleteModel, getDecryptedApiKey } from "./models/modelService.js";

// Types
export type { Model, ModelInput, ModelUpdateInput, Criterion, Run, Response, Score } from "./types.js";
