import type { ModelAdapter, ModelCallConfig, CompletionResult } from "./base.js";

interface OllamaResponse {
  message?: { content?: string };
  prompt_eval_count?: number;
  eval_count?: number;
}

export class OllamaAdapter implements ModelAdapter {
  async complete(prompt: string, config: ModelCallConfig): Promise<CompletionResult> {
    const baseUrl = config.baseUrl ?? "http://localhost:11434";
    const start = Date.now();
    const resp = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: config.modelId,
        messages: [{ role: "user", content: prompt }],
        stream: false,
        options: {
          temperature: config.temperature,
          num_predict: config.maxTokens,
        },
      }),
    });
    if (!resp.ok) {
      throw new Error(`Ollama HTTP ${resp.status}: ${await resp.text()}`);
    }
    const data = (await resp.json()) as OllamaResponse;
    const latencyMs = Date.now() - start;
    return {
      content: data.message?.content ?? "",
      tokensUsed: (data.prompt_eval_count ?? 0) + (data.eval_count ?? 0),
      latencyMs,
    };
  }
}
