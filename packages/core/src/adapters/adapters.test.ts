import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ModelCallConfig } from "./base.js";

// ── vi.hoisted ensures these fns are available inside the hoisted vi.mock factories ──
const { openaiCreate, anthropicCreate } = vi.hoisted(() => ({
  openaiCreate: vi.fn(),
  anthropicCreate: vi.fn(),
}));

// ── OpenAI SDK mock ───────────────────────────────────────────────────────────
// The default export must be a constructable function (class), not an arrow fn.
vi.mock("openai", () => {
  return {
    default: vi.fn().mockImplementation(function () {
      return {
        chat: {
          completions: {
            create: openaiCreate,
          },
        },
      };
    }),
  };
});

// ── Anthropic SDK mock ────────────────────────────────────────────────────────
vi.mock("@anthropic-ai/sdk", () => {
  return {
    default: vi.fn().mockImplementation(function () {
      return {
        messages: {
          create: anthropicCreate,
        },
      };
    }),
  };
});

// Adapters are imported AFTER the mocks are declared.
import { OpenAIAdapter } from "./openai.js";
import { AnthropicAdapter } from "./anthropic.js";
import { OllamaAdapter } from "./ollama.js";
import { getAdapter } from "./index.js";

// ── Shared fixture ────────────────────────────────────────────────────────────
const config: ModelCallConfig = {
  modelId: "test-model",
  apiKey: "test-key",
  temperature: 0.7,
  maxTokens: 100,
};

// ── OpenAIAdapter ─────────────────────────────────────────────────────────────
describe("OpenAIAdapter", () => {
  beforeEach(() => {
    openaiCreate.mockReset();
  });

  it("OpenAIAdapter.complete — returns content, tokensUsed, latencyMs on success", async () => {
    openaiCreate.mockResolvedValue({
      choices: [{ message: { content: "Hello from OpenAI" } }],
      usage: { total_tokens: 42 },
    });

    const adapter = new OpenAIAdapter();
    const result = await adapter.complete("Say hello", config);

    expect(result.content).toBe("Hello from OpenAI");
    expect(result.tokensUsed).toBe(42);
    expect(typeof result.latencyMs).toBe("number");
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("OpenAIAdapter.complete — returns empty string when content is null", async () => {
    openaiCreate.mockResolvedValue({
      // choices[0].message.content is null — exercises the `?? ""` branch
      choices: [{ message: { content: null } }],
      usage: { total_tokens: 5 },
    });

    const adapter = new OpenAIAdapter();
    const result = await adapter.complete("Say nothing", config);

    expect(result.content).toBe("");
  });

  it("OpenAIAdapter.complete — returns empty string when choices array is empty", async () => {
    openaiCreate.mockResolvedValue({
      // choice is undefined — exercises the `choice?.message?.content ?? ""` branch
      choices: [],
      usage: undefined,
    });

    const adapter = new OpenAIAdapter();
    const result = await adapter.complete("Empty", config);

    expect(result.content).toBe("");
    expect(result.tokensUsed).toBeUndefined();
  });
});

// ── AnthropicAdapter ──────────────────────────────────────────────────────────
describe("AnthropicAdapter", () => {
  beforeEach(() => {
    anthropicCreate.mockReset();
  });

  it("AnthropicAdapter.complete — returns content from text block on success", async () => {
    anthropicCreate.mockResolvedValue({
      content: [{ type: "text", text: "Hello from Anthropic" }],
      usage: { input_tokens: 10, output_tokens: 20 },
    });

    const adapter = new AnthropicAdapter();
    const result = await adapter.complete("Say hello", config);

    expect(result.content).toBe("Hello from Anthropic");
    expect(result.tokensUsed).toBe(30); // 10 + 20
    expect(typeof result.latencyMs).toBe("number");
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("AnthropicAdapter.complete — returns empty string when block type is not text", async () => {
    anthropicCreate.mockResolvedValue({
      // type is "tool_use" — exercises the `block?.type === "text"` false branch
      content: [{ type: "tool_use", id: "tool-1", name: "search", input: {} }],
      usage: { input_tokens: 5, output_tokens: 3 },
    });

    const adapter = new AnthropicAdapter();
    const result = await adapter.complete("Use a tool", config);

    expect(result.content).toBe("");
    expect(result.tokensUsed).toBe(8); // 5 + 3
  });

  it("AnthropicAdapter.complete — returns empty string when content array is empty", async () => {
    anthropicCreate.mockResolvedValue({
      // block is undefined — exercises the `block?.type === "text"` undefined branch
      content: [],
      usage: { input_tokens: 1, output_tokens: 0 },
    });

    const adapter = new AnthropicAdapter();
    const result = await adapter.complete("Empty", config);

    expect(result.content).toBe("");
  });
});

// ── OllamaAdapter ─────────────────────────────────────────────────────────────
describe("OllamaAdapter", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("OllamaAdapter.complete — returns content from ollama response", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        message: { content: "Hello from Ollama" },
        prompt_eval_count: 7,
        eval_count: 15,
      }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const adapter = new OllamaAdapter();
    const result = await adapter.complete("Say hello", config);

    expect(result.content).toBe("Hello from Ollama");
    expect(result.tokensUsed).toBe(22); // 7 + 15
    expect(typeof result.latencyMs).toBe("number");
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("OllamaAdapter.complete — uses default baseUrl when baseUrl is not set", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ message: { content: "ok" } }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const configWithoutBase: ModelCallConfig = { ...config, baseUrl: undefined };
    const adapter = new OllamaAdapter();
    await adapter.complete("ping", configWithoutBase);

    const calledUrl = (mockFetch.mock.calls[0] as [string, unknown])[0];
    expect(calledUrl).toContain("http://localhost:11434");
  });

  it("OllamaAdapter.complete — throws on HTTP error response", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      text: async () => "Service Unavailable",
    });
    vi.stubGlobal("fetch", mockFetch);

    const adapter = new OllamaAdapter();
    await expect(adapter.complete("fail", config)).rejects.toThrow("Ollama HTTP 503");
  });

  it("OllamaAdapter.complete — returns empty string when message content is missing", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      // message is absent — exercises the `data.message?.content ?? ""` branch
      json: async () => ({}),
    });
    vi.stubGlobal("fetch", mockFetch);

    const adapter = new OllamaAdapter();
    const result = await adapter.complete("empty", config);

    expect(result.content).toBe("");
    expect(result.tokensUsed).toBe(0); // (0 ?? 0) + (0 ?? 0)
  });
});

// ── getAdapter ────────────────────────────────────────────────────────────────
describe("getAdapter", () => {
  it("getAdapter — returns OpenAIAdapter for 'openai'", () => {
    const adapter = getAdapter("openai");
    expect(adapter).toBeInstanceOf(OpenAIAdapter);
  });

  it("getAdapter — returns AnthropicAdapter for 'anthropic'", () => {
    const adapter = getAdapter("anthropic");
    expect(adapter).toBeInstanceOf(AnthropicAdapter);
  });

  it("getAdapter — returns OllamaAdapter for 'ollama'", () => {
    const adapter = getAdapter("ollama");
    expect(adapter).toBeInstanceOf(OllamaAdapter);
  });

  it("getAdapter — is case-insensitive (accepts 'OpenAI')", () => {
    const adapter = getAdapter("OpenAI");
    expect(adapter).toBeInstanceOf(OpenAIAdapter);
  });

  it("getAdapter — throws for unknown provider", () => {
    expect(() => getAdapter("cohere")).toThrow("Unknown provider: cohere");
  });
});
