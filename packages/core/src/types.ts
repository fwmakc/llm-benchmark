export interface Model {
  id: string;
  name: string;
  provider: string;
  modelId: string;
  apiKeyEncrypted: string;
  createdAt: number;
  updatedAt: number;
}

export interface ModelInput {
  name: string;
  provider: string;
  modelId: string;
  apiKey: string;
}

export interface Criterion {
  id: string;
  name: string;
  description: string | null;
  weight: number;
  createdAt: number;
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
