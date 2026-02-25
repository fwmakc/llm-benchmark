export interface Model {
  id: string;
  name: string;
  provider: string;
  modelId: string;
  apiKeyEncrypted: string;
  createdAt: number;
  updatedAt: number;
  temperature: number | null;
  maxTokens: number | null;
  baseUrl: string | null;
}

export interface ModelInput {
  name: string;
  provider: string;
  modelId: string;
  apiKey: string;
  temperature?: number | null;
  maxTokens?: number | null;
  baseUrl?: string | null;
}

export interface ModelUpdateInput {
  name?: string;
  provider?: string;
  modelId?: string;
  /** Pass new plaintext key to re-encrypt; omit to leave the existing key unchanged */
  apiKey?: string;
  temperature?: number | null;
  maxTokens?: number | null;
  baseUrl?: string | null;
}

export interface Criterion {
  id: string;
  name: string;
  maxScore: number;
  weight: number;
  createdAt: number;
}

export interface CriterionInput {
  name: string;
  maxScore?: number;
  weight?: number;
}

export interface CriterionUpdateInput {
  name?: string;
  maxScore?: number;
  weight?: number;
}

export interface Run {
  id: string;
  prompt: string;
  requestsPerModel: number;
  createdAt: number;
}

export interface RunInput {
  prompt: string;
  requestsPerModel: number;
  modelIds: string[];
  criteriaIds: string[];
}

export interface RunWithDetails extends Run {
  models: Model[];
  criteria: Criterion[];
  responses: Response[];
}

export interface Response {
  id: string;
  runId: string;
  modelId: string;
  content: string | null;
  tokensUsed: number | null;
  latencyMs: number | null;
  errorMsg: string | null;
  createdAt: number;
}

export interface Score {
  id: string;
  responseId: string;
  criterionId: string;
  score: number;
  notes: string | null;
  createdAt: number;
}
