import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { openDatabase, closeDatabase } from "../db/database.js";
import { addModel } from "../models/modelService.js";
import { addCriterion } from "../criteria/criteriaService.js";
import { createRun, executeRun, listRuns, getRun } from "./runService.js";
import { clearKeyCache } from "../security/encryption.js";
import type { ModelInput, CriterionInput } from "../types.js";

// ── Keytar mock ──────────────────────────────────────────────────────────────
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

// ── Adapter mock — intercepts all provider calls ─────────────────────────────
const mockComplete = vi.fn();

vi.mock("../adapters/index.js", () => ({
  getAdapter: vi.fn(() => ({ complete: mockComplete })),
}));

// ── Fixtures ─────────────────────────────────────────────────────────────────
const modelInput: ModelInput = {
  name: "Test Model",
  provider: "openai",
  modelId: "gpt-4o",
  apiKey: "sk-test",
};

const criterionInput: CriterionInput = {
  name: "Accuracy",
  maxScore: 10,
  weight: 1,
};

beforeEach(() => {
  keytarStore.clear();
  clearKeyCache();
  mockComplete.mockReset();
  openDatabase(":memory:");
});

afterEach(() => {
  closeDatabase();
});

// ── createRun ────────────────────────────────────────────────────────────────
describe("createRun", () => {
  it("createRun — returns a run with the correct fields", async () => {
    const model = await addModel(modelInput);
    const criterion = addCriterion(criterionInput);

    const run = createRun({
      prompt: "Hello world",
      requestsPerModel: 2,
      modelIds: [model.id],
      criteriaIds: [criterion.id],
    });

    expect(run.id).toBeTruthy();
    expect(run.prompt).toBe("Hello world");
    expect(run.requestsPerModel).toBe(2);
    expect(typeof run.createdAt).toBe("number");
  });

  it("createRun — persists the run so listRuns returns it", async () => {
    const model = await addModel(modelInput);

    createRun({ prompt: "p1", requestsPerModel: 1, modelIds: [model.id], criteriaIds: [] });
    createRun({ prompt: "p2", requestsPerModel: 1, modelIds: [model.id], criteriaIds: [] });

    const runs = listRuns();
    expect(runs).toHaveLength(2);
  });

  it("createRun — works with empty modelIds and criteriaIds", () => {
    const run = createRun({ prompt: "solo", requestsPerModel: 1, modelIds: [], criteriaIds: [] });
    expect(run.id).toBeTruthy();
  });
});

// ── listRuns ─────────────────────────────────────────────────────────────────
describe("listRuns", () => {
  it("listRuns — returns empty array when no runs exist", () => {
    expect(listRuns()).toEqual([]);
  });

  it("listRuns — returns runs newest first", async () => {
    const model = await addModel(modelInput);

    createRun({ prompt: "first", requestsPerModel: 1, modelIds: [model.id], criteriaIds: [] });
    // Small delay to ensure different created_at values
    await new Promise((r) => setTimeout(r, 5));
    createRun({ prompt: "second", requestsPerModel: 1, modelIds: [model.id], criteriaIds: [] });

    const runs = listRuns();
    expect(runs[0].prompt).toBe("second");
    expect(runs[1].prompt).toBe("first");
  });
});

// ── getRun ───────────────────────────────────────────────────────────────────
describe("getRun", () => {
  it("getRun — returns run with associated models and criteria", async () => {
    const model = await addModel(modelInput);
    const criterion = addCriterion(criterionInput);

    const run = createRun({
      prompt: "test prompt",
      requestsPerModel: 1,
      modelIds: [model.id],
      criteriaIds: [criterion.id],
    });

    const detail = getRun(run.id);
    expect(detail.id).toBe(run.id);
    expect(detail.prompt).toBe("test prompt");
    expect(detail.models).toHaveLength(1);
    expect(detail.models[0].id).toBe(model.id);
    expect(detail.criteria).toHaveLength(1);
    expect(detail.criteria[0].id).toBe(criterion.id);
    expect(detail.responses).toEqual([]);
  });

  it("getRun — throws when run does not exist", () => {
    expect(() => getRun("no-such-id")).toThrow("Run no-such-id not found");
  });
});

// ── executeRun ───────────────────────────────────────────────────────────────
describe("executeRun", () => {
  it("executeRun — inserts one response row per request per model", async () => {
    mockComplete.mockResolvedValue({ content: "Hello!", tokensUsed: 10, latencyMs: 50 });

    const model = await addModel(modelInput);
    const run = createRun({
      prompt: "Say hi",
      requestsPerModel: 3,
      modelIds: [model.id],
      criteriaIds: [],
    });

    await executeRun(run.id);

    const detail = getRun(run.id);
    expect(detail.responses).toHaveLength(3);
    for (const resp of detail.responses) {
      expect(resp.content).toBe("Hello!");
      expect(resp.tokensUsed).toBe(10);
      expect(resp.latencyMs).toBe(50);
      expect(resp.errorMsg).toBeNull();
      expect(resp.modelId).toBe(model.id);
    }
  });

  it("executeRun — stores error_msg and null content on adapter failure", async () => {
    mockComplete.mockRejectedValue(new Error("API timeout"));

    const model = await addModel(modelInput);
    const run = createRun({
      prompt: "fail",
      requestsPerModel: 1,
      modelIds: [model.id],
      criteriaIds: [],
    });

    await executeRun(run.id);

    const detail = getRun(run.id);
    expect(detail.responses).toHaveLength(1);
    expect(detail.responses[0].content).toBeNull();
    expect(detail.responses[0].errorMsg).toBe("API timeout");
  });

  it("executeRun — handles multiple models, each getting their own requests", async () => {
    mockComplete.mockResolvedValue({ content: "ok" });

    const modelA = await addModel({ ...modelInput, name: "Model A", apiKey: "sk-a" });
    const modelB = await addModel({ ...modelInput, name: "Model B", apiKey: "sk-b" });

    const run = createRun({
      prompt: "multi",
      requestsPerModel: 2,
      modelIds: [modelA.id, modelB.id],
      criteriaIds: [],
    });

    await executeRun(run.id);

    const detail = getRun(run.id);
    // 2 models × 2 requests = 4 total responses
    expect(detail.responses).toHaveLength(4);
    const modelIds = detail.responses.map((r) => r.modelId);
    expect(modelIds.filter((id) => id === modelA.id)).toHaveLength(2);
    expect(modelIds.filter((id) => id === modelB.id)).toHaveLength(2);
  });

  it("executeRun — throws when run does not exist", async () => {
    await expect(executeRun("ghost-run-id")).rejects.toThrow("Run ghost-run-id not found");
  });

  it("executeRun — produces no responses when no models are associated", async () => {
    const run = createRun({ prompt: "no models", requestsPerModel: 5, modelIds: [], criteriaIds: [] });
    await executeRun(run.id);
    const detail = getRun(run.id);
    expect(detail.responses).toHaveLength(0);
  });
});

// ── getAdapter mock wiring ────────────────────────────────────────────────────
describe("getAdapter", () => {
  it("executeRun — calls adapter.complete with correct modelId and prompt", async () => {
    mockComplete.mockResolvedValue({ content: "response text" });

    const model = await addModel({ ...modelInput, modelId: "gpt-4o-mini" });
    const run = createRun({
      prompt: "Check wiring",
      requestsPerModel: 1,
      modelIds: [model.id],
      criteriaIds: [],
    });

    await executeRun(run.id);

    expect(mockComplete).toHaveBeenCalledOnce();
    const [calledPrompt, calledConfig] = mockComplete.mock.calls[0] as [string, { modelId: string }];
    expect(calledPrompt).toBe("Check wiring");
    expect(calledConfig.modelId).toBe("gpt-4o-mini");
  });
});
