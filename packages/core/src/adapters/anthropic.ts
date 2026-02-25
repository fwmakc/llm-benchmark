import Anthropic from "@anthropic-ai/sdk";
import type { ModelAdapter, ModelCallConfig, CompletionResult } from "./base.js";

export class AnthropicAdapter implements ModelAdapter {
  async complete(prompt: string, config: ModelCallConfig): Promise<CompletionResult> {
    const client = new Anthropic({
      apiKey: config.apiKey,
      baseURL: config.baseUrl ?? undefined,
    });
    const start = Date.now();
    const response = await client.messages.create({
      model: config.modelId,
      max_tokens: config.maxTokens,
      temperature: config.temperature,
      messages: [{ role: "user", content: prompt }],
    });
    const latencyMs = Date.now() - start;
    const block = response.content[0];
    const content = block?.type === "text" ? block.text : "";
    return {
      content,
      tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
      latencyMs,
    };
  }
}
