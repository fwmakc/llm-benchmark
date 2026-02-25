import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { openDatabase, closeDatabase } from "../db/database.js";
import { addModel } from "../models/modelService.js";
import { addCriterion } from "../criteria/criteriaService.js";
import { createRun, executeRun, getRun } from "../runs/runService.js";
import { clearKeyCache } from "../security/encryption.js";
import { createScoringSession, scoreResponse, getSessionScores, listScoringSessions } from "./scoringService.js";
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

/** Sets up a run with one model, one criterion, and one executed response. */
async function seedRunWithResponse(): Promise<{
  runId: string;
  responseId: string;
  criterionId: string;
}> {
  const model = await addModel(modelInput);
  const criterion = addCriterion(criterionInput);
  const run = createRun({
    prompt: "Hello",
    requestsPerModel: 1,
    modelIds: [model.id],
    criteriaIds: [criterion.id],
  });
  await executeRun(run.id);
  const detail = getRun(run.id);
  return {
    runId: run.id,
    responseId: detail.responses[0].id,
    criterionId: criterion.id,
  };
}

beforeEach(() => {
  keytarStore.clear();
  clearKeyCache();
  openDatabase(":memory:");
});

afterEach(() => {
  closeDatabase();
});

// ── createScoringSession ──────────────────────────────────────────────────────
describe("createScoringSession", () => {
  it("createScoringSession — creates a session and returns it with correct runId", async () => {
    const { runId } = await seedRunWithResponse();
    const session = createScoringSession(runId);

    expect(session.id).toBeTruthy();
    expect(session.runId).toBe(runId);
    expect(typeof session.createdAt).toBe("number");
  });

  it("createScoringSession — persists the session so listScoringSessions returns it", async () => {
    const { runId } = await seedRunWithResponse();
    createScoringSession(runId);

    const sessions = listScoringSessions(runId);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].runId).toBe(runId);
  });
});

// ── scoreResponse ─────────────────────────────────────────────────────────────
describe("scoreResponse", () => {
  it("scoreResponse — records a score and returns it with correct fields", async () => {
    const { runId, responseId, criterionId } = await seedRunWithResponse();
    const session = createScoringSession(runId);

    const score = scoreResponse({
      sessionId: session.id,
      responseId,
      criterionId,
      score: 8,
      notes: "Good answer",
    });

    expect(score.id).toBeTruthy();
    expect(score.sessionId).toBe(session.id);
    expect(score.responseId).toBe(responseId);
    expect(score.criterionId).toBe(criterionId);
    expect(score.score).toBe(8);
    expect(score.notes).toBe("Good answer");
    expect(typeof score.createdAt).toBe("number");
  });

  it("scoreResponse — stores null notes when notes is not provided", async () => {
    const { runId, responseId, criterionId } = await seedRunWithResponse();
    const session = createScoringSession(runId);

    const score = scoreResponse({
      sessionId: session.id,
      responseId,
      criterionId,
      score: 5,
    });

    expect(score.notes).toBeNull();
  });

  it("scoreResponse — stores null notes when notes is explicitly null", async () => {
    const { runId, responseId, criterionId } = await seedRunWithResponse();
    const session = createScoringSession(runId);

    const score = scoreResponse({
      sessionId: session.id,
      responseId,
      criterionId,
      score: 7,
      notes: null,
    });

    expect(score.notes).toBeNull();
  });
});

// ── getSessionScores ──────────────────────────────────────────────────────────
describe("getSessionScores", () => {
  it("getSessionScores — returns all scores for a session ordered oldest first", async () => {
    const { runId, responseId, criterionId } = await seedRunWithResponse();
    const session = createScoringSession(runId);

    scoreResponse({ sessionId: session.id, responseId, criterionId, score: 3 });
    scoreResponse({ sessionId: session.id, responseId, criterionId, score: 7 });

    const scores = getSessionScores(session.id);
    expect(scores).toHaveLength(2);
    expect(scores[0].score).toBe(3);
    expect(scores[1].score).toBe(7);
  });

  it("getSessionScores — returns empty array for unknown session", () => {
    const scores = getSessionScores("no-such-session");
    expect(scores).toEqual([]);
  });
});

// ── listScoringSessions ───────────────────────────────────────────────────────
describe("listScoringSessions", () => {
  it("listScoringSessions — returns sessions for a run newest first", async () => {
    const { runId } = await seedRunWithResponse();

    const first = createScoringSession(runId);
    // Small delay to ensure different created_at timestamps
    await new Promise((r) => setTimeout(r, 5));
    const second = createScoringSession(runId);

    const sessions = listScoringSessions(runId);
    expect(sessions).toHaveLength(2);
    expect(sessions[0].id).toBe(second.id);
    expect(sessions[1].id).toBe(first.id);
  });

  it("listScoringSessions — returns empty array for unknown run", () => {
    const sessions = listScoringSessions("no-such-run");
    expect(sessions).toEqual([]);
  });
});
