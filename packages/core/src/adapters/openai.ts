import OpenAI from "openai";
import type { ModelAdapter, ModelCallConfig, CompletionResult } from "./base.js";

export class OpenAIAdapter implements ModelAdapter {
  async complete(prompt: string, config: ModelCallConfig): Promise<CompletionResult> {
    const client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl ?? undefined,
    });
    const start = Date.now();
    const response = await client.chat.completions.create({
      model: config.modelId,
      messages: [{ role: "user", content: prompt }],
      temperature: config.temperature,
      max_tokens: config.maxTokens,
    });
    const latencyMs = Date.now() - start;
    const choice = response.choices[0];
    return {
      content: choice?.message?.content ?? "",
      tokensUsed: response.usage?.total_tokens,
      latencyMs,
    };
  }
}
