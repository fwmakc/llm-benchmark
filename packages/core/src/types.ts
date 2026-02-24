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

export interface CriteriaSet {
  id: string;
  name: string;
  createdAt: number;
}

export interface Criterion {
  id: string;
  setId: string | null;
  name: string;
  maxScore: number;
  weight: number;
  createdAt: number;
}

export interface CriterionInput {
  setId?: string | null;
  name: string;
  maxScore?: number;
  weight?: number;
}

export interface Run {
  id: string;
  name: string | null;
  createdAt: number;
  status: "pending" | "running" | "done" | "failed";
}

export interface Response {
  id: string;
  runId: string;
  modelId: string;
  prompt: string;
  response: string | null;
  createdAt: number;
  latencyMs: number | null;
}

export interface Score {
  id: string;
  responseId: string;
  criterionId: string;
  score: number;
  notes: string | null;
  createdAt: number;
}
