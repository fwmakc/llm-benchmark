export interface ModelCallConfig {
  modelId: string;
  apiKey?: string;
  baseUrl?: string;
  temperature: number;
  maxTokens: number;
}

export interface CompletionResult {
  content: string;
  tokensUsed?: number;
  latencyMs?: number;
}

export interface ModelAdapter {
  complete(prompt: string, config: ModelCallConfig): Promise<CompletionResult>;
}
