export type { ModelAdapter, ModelCallConfig, CompletionResult } from "./base.js";
export { OpenAIAdapter } from "./openai.js";
export { AnthropicAdapter } from "./anthropic.js";
export { OllamaAdapter } from "./ollama.js";

import type { ModelAdapter } from "./base.js";
import { OpenAIAdapter } from "./openai.js";
import { AnthropicAdapter } from "./anthropic.js";
import { OllamaAdapter } from "./ollama.js";

export function getAdapter(provider: string): ModelAdapter {
  switch (provider.toLowerCase()) {
    case "openai":
      return new OpenAIAdapter();
    case "anthropic":
      return new AnthropicAdapter();
    case "ollama":
      return new OllamaAdapter();
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}
