import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { openDatabase, closeDatabase } from "../db/database.js";
import { addModel, listModels, deleteModel, getDecryptedApiKey, updateModel } from "./modelService.js";
import type { ModelInput } from "../types.js";

// In-memory keytar store shared across all tests in this file
const keytarStore = new Map<string, string>();

vi.mock("keytar", () => ({
  default: {
    getPassword: vi.fn(async (service: string, account: string): Promise<string | null> => {
      return keytarStore.get(`${service}:${account}`) ?? null;
    }),
    setPassword: vi.fn(async (service: string, account: string, password: string): Promise<void> => {
      keytarStore.set(`${service}:${account}`, password);
    }),
  },
}));

// Also mock clearKeyCache behaviour by importing and resetting between tests
import { clearKeyCache } from "../security/encryption.js";

beforeEach(() => {
  keytarStore.clear();
  clearKeyCache();
  openDatabase(":memory:");
});

afterEach(() => {
  closeDatabase();
});

const sampleInput: ModelInput = {
  name: "Test Model",
  provider: "openai",
  modelId: "gpt-4o",
  apiKey: "sk-test-1234",
};

describe("addModel", () => {
  it("addModel — stores model and returns it with an id", async () => {
    const model = await addModel(sampleInput);

    expect(model.id).toBeTruthy();
    expect(model.name).toBe(sampleInput.name);
    expect(model.provider).toBe(sampleInput.provider);
    expect(model.modelId).toBe(sampleInput.modelId);
    // The stored key must be encrypted, not the raw plaintext
    expect(model.apiKeyEncrypted).not.toBe(sampleInput.apiKey);
    expect(model.apiKeyEncrypted).toContain(":");
  });
});

describe("listModels", () => {
  it("listModels — returns all stored models", async () => {
    await addModel(sampleInput);
    await addModel({ ...sampleInput, name: "Second Model", apiKey: "sk-other" });

    const models = listModels();
    expect(models).toHaveLength(2);
    expect(models.map((m) => m.name)).toContain("Test Model");
    expect(models.map((m) => m.name)).toContain("Second Model");
  });
});

describe("deleteModel", () => {
  it("deleteModel — removes model from list", async () => {
    const model = await addModel(sampleInput);
    expect(listModels()).toHaveLength(1);

    const deleted = deleteModel(model.id);
    expect(deleted).toBe(true);
    expect(listModels()).toHaveLength(0);
  });

  it("deleteModel — throws or ignores unknown id", () => {
    // deleteModel returns false for a non-existent id (no throw, just false)
    const result = deleteModel("non-existent-id");
    expect(result).toBe(false);
  });
});

describe("getDecryptedApiKey", () => {
  it("getDecryptedApiKey — returns the original plaintext API key", async () => {
    const model = await addModel(sampleInput);
    const plaintext = await getDecryptedApiKey(model.id);
    expect(plaintext).toBe(sampleInput.apiKey);
  });

  it("getDecryptedApiKey — returns null for a non-existent id", async () => {
    const result = await getDecryptedApiKey("does-not-exist");
    expect(result).toBeNull();
  });
});

describe("updateModel", () => {
  it("updateModel — updates name only, leaves other fields unchanged", async () => {
    const model = await addModel({ ...sampleInput, temperature: 0.5 });
    const updated = await updateModel(model.id, { name: "Renamed Model" });
    expect(updated.name).toBe("Renamed Model");
    expect(updated.provider).toBe(sampleInput.provider);
    expect(updated.modelId).toBe(sampleInput.modelId);
    expect(updated.temperature).toBe(0.5);
  });

  it("updateModel — sets temperature to a value then to null", async () => {
    const model = await addModel(sampleInput);
    const withTemp = await updateModel(model.id, { temperature: 0.8 });
    expect(withTemp.temperature).toBe(0.8);
    const withNull = await updateModel(model.id, { temperature: null });
    expect(withNull.temperature).toBeNull();
  });

  it("updateModel — re-encrypts apiKey when provided", async () => {
    const model = await addModel(sampleInput);
    const updated = await updateModel(model.id, { apiKey: "sk-new-key-9999" });
    expect(updated.apiKeyEncrypted).not.toBe(model.apiKeyEncrypted);
    const plaintext = await getDecryptedApiKey(model.id);
    expect(plaintext).toBe("sk-new-key-9999");
  });

  it("updateModel — throws for non-existent id", async () => {
    await expect(updateModel("no-such-id", { name: "Ghost" })).rejects.toThrow("Model not found");
  });

  it("updateModel — updates provider, modelId, maxTokens, and baseUrl fields", async () => {
    const model = await addModel(sampleInput);
    const updated = await updateModel(model.id, {
      provider: "anthropic",
      modelId: "claude-3-opus",
      maxTokens: 4096,
      baseUrl: "https://custom.endpoint/v1",
    });
    expect(updated.provider).toBe("anthropic");
    expect(updated.modelId).toBe("claude-3-opus");
    expect(updated.maxTokens).toBe(4096);
    expect(updated.baseUrl).toBe("https://custom.endpoint/v1");
  });
});
