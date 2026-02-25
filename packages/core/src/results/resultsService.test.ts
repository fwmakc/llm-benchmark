import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { openDatabase, closeDatabase } from "../db/database.js";
import { addModel } from "../models/modelService.js";
import { addCriterion } from "../criteria/criteriaService.js";
import { createRun } from "../runs/runService.js";
import { createScoringSession, scoreResponse } from "../scoring/scoringService.js";
import { clearKeyCache } from "../security/encryption.js";
import { computeResults } from "./resultsService.js";
import type { ModelInput, CriterionInput } from "../types.js";

// ── Keytar mock ───────────────────────────────────────────────────────────────
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

// ── Adapter mock — intercepts all provider calls ──────────────────────────────
vi.mock("../adapters/index.js", () => ({
  getAdapter: vi.fn(() => ({
    complete: vi.fn(async () => ({ content: "mock response", tokensUsed: 5, latencyMs: 10 })),
  })),
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  keytarStore.clear();
  clearKeyCache();
  openDatabase(":memory:");
});

afterEach(() => {
  closeDatabase();
});

/**
 * Sets up the full benchmark fixture:
 *   - 2 models: openai (Model A) and anthropic (Model B)
 *   - 2 criteria: Accuracy (maxScore=10, weight=1) and Clarity (maxScore=5, weight=2)
 *   - 1 run with requestsPerModel=2 → 4 responses total (2 per model)
 *   - 1 scoring session with all responses scored
 *
 * Scoring plan:
 *   Model A: resp1 → Accuracy=8, Clarity=4  |  resp2 → Accuracy=6, Clarity=3
 *   Model B: resp1 → Accuracy=5, Clarity=5  |  resp2 → Accuracy=7, Clarity=4
 *
 * Expected totals:
 *   Model A: Accuracy avgNorm=70*1=70, Clarity avgNorm=70*2=140  → total=210
 *   Model B: Accuracy avgNorm=60*1=60, Clarity avgNorm=90*2=180  → total=240
 *
 * Rank 1 = Model B (240), Rank 2 = Model A (210)
 */
async function seedFullFixture(): Promise<{
  runId: string;
  sessionId: string;
  modelAId: string;
  modelBId: string;
  accuracyCriterionId: string;
  clarityCriterionId: string;
}> {
  const modelAInput: ModelInput = {
    name: "ModelA",
    provider: "openai",
    modelId: "gpt-4o",
    apiKey: "sk-a",
  };
  const modelBInput: ModelInput = {
    name: "ModelB",
    provider: "anthropic",
    modelId: "claude-3-opus",
    apiKey: "sk-b",
  };

  const accuracyInput: CriterionInput = { name: "Accuracy", maxScore: 10, weight: 1 };
  const clarityInput: CriterionInput = { name: "Clarity", maxScore: 5, weight: 2 };

  const modelA = await addModel(modelAInput);
  const modelB = await addModel(modelBInput);
  const accuracy = addCriterion(accuracyInput);
  const clarity = addCriterion(clarityInput);

  const run = createRun({
    prompt: "Explain recursion",
    requestsPerModel: 2,
    modelIds: [modelA.id, modelB.id],
    criteriaIds: [accuracy.id, clarity.id],
  });

  // Manually insert 4 responses (bypassing executeRun to avoid HTTP calls)
  const db = openDatabase(":memory:");
  const { v4: uuidv4 } = await import("uuid");

  const aResp1Id = uuidv4();
  const aResp2Id = uuidv4();
  const bResp1Id = uuidv4();
  const bResp2Id = uuidv4();
  const now = Date.now();

  db.prepare(
    "INSERT INTO Responses (id, run_id, model_id, content, tokens_used, latency_ms, error_msg, created_at) VALUES (?, ?, ?, ?, ?, ?, NULL, ?)"
  ).run(aResp1Id, run.id, modelA.id, "Answer A1", 10, 100, now);
  db.prepare(
    "INSERT INTO Responses (id, run_id, model_id, content, tokens_used, latency_ms, error_msg, created_at) VALUES (?, ?, ?, ?, ?, ?, NULL, ?)"
  ).run(aResp2Id, run.id, modelA.id, "Answer A2", 12, 110, now + 1);
  db.prepare(
    "INSERT INTO Responses (id, run_id, model_id, content, tokens_used, latency_ms, error_msg, created_at) VALUES (?, ?, ?, ?, ?, ?, NULL, ?)"
  ).run(bResp1Id, run.id, modelB.id, "Answer B1", 8, 90, now + 2);
  db.prepare(
    "INSERT INTO Responses (id, run_id, model_id, content, tokens_used, latency_ms, error_msg, created_at) VALUES (?, ?, ?, ?, ?, ?, NULL, ?)"
  ).run(bResp2Id, run.id, modelB.id, "Answer B2", 9, 95, now + 3);

  // Create scoring session
  const session = createScoringSession(run.id);

  // Score Model A responses
  scoreResponse({ sessionId: session.id, responseId: aResp1Id, criterionId: accuracy.id, score: 8 });
  scoreResponse({ sessionId: session.id, responseId: aResp1Id, criterionId: clarity.id, score: 4 });
  scoreResponse({ sessionId: session.id, responseId: aResp2Id, criterionId: accuracy.id, score: 6 });
  scoreResponse({ sessionId: session.id, responseId: aResp2Id, criterionId: clarity.id, score: 3 });

  // Score Model B responses
  scoreResponse({ sessionId: session.id, responseId: bResp1Id, criterionId: accuracy.id, score: 5 });
  scoreResponse({ sessionId: session.id, responseId: bResp1Id, criterionId: clarity.id, score: 5 });
  scoreResponse({ sessionId: session.id, responseId: bResp2Id, criterionId: accuracy.id, score: 7 });
  scoreResponse({ sessionId: session.id, responseId: bResp2Id, criterionId: clarity.id, score: 4 });

  return {
    runId: run.id,
    sessionId: session.id,
    modelAId: modelA.id,
    modelBId: modelB.id,
    accuracyCriterionId: accuracy.id,
    clarityCriterionId: clarity.id,
  };
}

// ── computeResults ────────────────────────────────────────────────────────────

describe("computeResults", () => {
  it("computeResults — returns RunResults with correct runId and sessionId", async () => {
    const { runId, sessionId } = await seedFullFixture();
    const results = computeResults(runId, sessionId);

    expect(results.runId).toBe(runId);
    expect(results.sessionId).toBe(sessionId);
    expect(results.prompt).toBe("Explain recursion");
  });

  it("computeResults — rankedModels has 2 entries", async () => {
    const { runId, sessionId } = await seedFullFixture();
    const results = computeResults(runId, sessionId);

    expect(results.rankedModels).toHaveLength(2);
  });

  it("computeResults — models are sorted by totalScore descending", async () => {
    const { runId, sessionId } = await seedFullFixture();
    const results = computeResults(runId, sessionId);

    expect(results.rankedModels[0].totalScore).toBeGreaterThan(
      results.rankedModels[1].totalScore
    );
  });

  it("computeResults — Model B (anthropic) ranks first with totalScore 240", async () => {
    const { runId, sessionId, modelBId } = await seedFullFixture();
    const results = computeResults(runId, sessionId);

    const first = results.rankedModels[0];
    expect(first.modelId).toBe(modelBId);
    expect(first.provider).toBe("anthropic");
    expect(first.totalScore).toBeCloseTo(240, 5);
  });

  it("computeResults — Model A (openai) ranks second with totalScore 210", async () => {
    const { runId, sessionId, modelAId } = await seedFullFixture();
    const results = computeResults(runId, sessionId);

    const second = results.rankedModels[1];
    expect(second.modelId).toBe(modelAId);
    expect(second.provider).toBe("openai");
    expect(second.totalScore).toBeCloseTo(210, 5);
  });

  it("computeResults — each model has criteriaBreakdown with 2 entries", async () => {
    const { runId, sessionId } = await seedFullFixture();
    const results = computeResults(runId, sessionId);

    for (const model of results.rankedModels) {
      expect(model.criteriaBreakdown).toHaveLength(2);
    }
  });

  it("computeResults — formula applied correctly for Model A Accuracy criterion", async () => {
    const { runId, sessionId, modelAId } = await seedFullFixture();
    const results = computeResults(runId, sessionId);

    const modelA = results.rankedModels.find((m) => m.modelId === modelAId)!;
    const accuracy = modelA.criteriaBreakdown.find(
      (cs) => cs.criterionName === "Accuracy"
    )!;

    // Scores: 8 and 6 → avgRaw=7, avgNorm=7*100/10=70, weightedAvg=70*1=70
    expect(accuracy.avgRawScore).toBeCloseTo(7, 5);
    expect(accuracy.avgNormalized).toBeCloseTo(70, 5);
    expect(accuracy.weightedAvg).toBeCloseTo(70, 5);
    expect(accuracy.weight).toBe(1);
    expect(accuracy.maxScore).toBe(10);
  });

  it("computeResults — formula applied correctly for Model A Clarity criterion", async () => {
    const { runId, sessionId, modelAId } = await seedFullFixture();
    const results = computeResults(runId, sessionId);

    const modelA = results.rankedModels.find((m) => m.modelId === modelAId)!;
    const clarity = modelA.criteriaBreakdown.find(
      (cs) => cs.criterionName === "Clarity"
    )!;

    // Scores: 4 and 3 → avgRaw=3.5, avgNorm=3.5*100/5=70, weightedAvg=70*2=140
    expect(clarity.avgRawScore).toBeCloseTo(3.5, 5);
    expect(clarity.avgNormalized).toBeCloseTo(70, 5);
    expect(clarity.weightedAvg).toBeCloseTo(140, 5);
    expect(clarity.weight).toBe(2);
    expect(clarity.maxScore).toBe(5);
  });

  it("computeResults — formula applied correctly for Model B Clarity criterion", async () => {
    const { runId, sessionId, modelBId } = await seedFullFixture();
    const results = computeResults(runId, sessionId);

    const modelB = results.rankedModels.find((m) => m.modelId === modelBId)!;
    const clarity = modelB.criteriaBreakdown.find(
      (cs) => cs.criterionName === "Clarity"
    )!;

    // Scores: 5 and 4 → avgRaw=4.5, avgNorm=4.5*100/5=90, weightedAvg=90*2=180
    expect(clarity.avgRawScore).toBeCloseTo(4.5, 5);
    expect(clarity.avgNormalized).toBeCloseTo(90, 5);
    expect(clarity.weightedAvg).toBeCloseTo(180, 5);
  });

  it("computeResults — each model has the correct number of responses", async () => {
    const { runId, sessionId } = await seedFullFixture();
    const results = computeResults(runId, sessionId);

    for (const model of results.rankedModels) {
      expect(model.responses).toHaveLength(2);
    }
  });

  it("computeResults — responses contain responseId and content fields", async () => {
    const { runId, sessionId } = await seedFullFixture();
    const results = computeResults(runId, sessionId);

    for (const model of results.rankedModels) {
      for (const resp of model.responses) {
        expect(typeof resp.responseId).toBe("string");
        expect(resp.responseId.length).toBeGreaterThan(0);
        expect(typeof resp.content).toBe("string");
      }
    }
  });

  it("computeResults — responses include tokensUsed and latencyMs when present", async () => {
    const { runId, sessionId } = await seedFullFixture();
    const results = computeResults(runId, sessionId);

    for (const model of results.rankedModels) {
      for (const resp of model.responses) {
        expect(resp.tokensUsed).toBeDefined();
        expect(resp.latencyMs).toBeDefined();
      }
    }
  });

  it("computeResults — throws when run does not exist", () => {
    expect(() => computeResults("no-such-run", "no-such-session")).toThrow(
      "Run no-such-run not found"
    );
  });

  it("computeResults — returns empty rankedModels when session has no scores", async () => {
    const modelAInput: ModelInput = {
      name: "EmptyModel",
      provider: "openai",
      modelId: "gpt-4o",
      apiKey: "sk-empty",
    };
    const model = await addModel(modelAInput);
    const accuracy = addCriterion({ name: "Accuracy", maxScore: 10, weight: 1 });

    const run = createRun({
      prompt: "No scores",
      requestsPerModel: 1,
      modelIds: [model.id],
      criteriaIds: [accuracy.id],
    });

    const session = createScoringSession(run.id);

    // Do NOT score anything
    const results = computeResults(run.id, session.id);

    expect(results.rankedModels).toHaveLength(0);
    expect(results.runId).toBe(run.id);
    expect(results.sessionId).toBe(session.id);
  });
});
