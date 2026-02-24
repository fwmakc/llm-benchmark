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

// Criteria
export { listCriteriaSets, addCriteriaSet, deleteCriteriaSet, listCriteria, addCriterion, deleteCriterion } from "./criteria/criteriaService.js";

// Types
export type { Model, ModelInput, ModelUpdateInput, CriteriaSet, Criterion, CriterionInput, Run, Response, Score } from "./types.js";
