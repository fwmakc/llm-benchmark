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
export { listCriteria, addCriterion, updateCriterion, deleteCriterion } from "./criteria/criteriaService.js";

// Runs
export { createRun, executeRun, listRuns, getRun } from "./runs/runService.js";

// Scoring
export { createScoringSession, scoreResponse, getSessionScores, listScoringSessions } from "./scoring/scoringService.js";

// Adapters
export type { ModelAdapter, ModelCallConfig, CompletionResult } from "./adapters/index.js";
export { getAdapter } from "./adapters/index.js";

// Types
export type { Model, ModelInput, ModelUpdateInput, Criterion, CriterionInput, CriterionUpdateInput, Run, RunInput, RunWithDetails, Response, ScoringSession, Score } from "./types.js";
