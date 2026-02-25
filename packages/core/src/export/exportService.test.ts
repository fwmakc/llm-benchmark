import { describe, it, expect } from "vitest";
import { exportJSON, exportCSV, exportPDF } from "./exportService.js";
import type { RunResults } from "../types.js";

// ── Fixture ───────────────────────────────────────────────────────────────────

const fixture: RunResults = {
  runId: "run-001",
  sessionId: "session-001",
  prompt: "Explain recursion",
  rankedModels: [
    {
      modelId: "model-b",
      modelName: "ModelB",
      provider: "anthropic",
      totalScore: 240,
      criteriaBreakdown: [
        {
          criterionId: "crit-1",
          criterionName: "Accuracy",
          weight: 1,
          maxScore: 10,
          avgRawScore: 6,
          avgNormalized: 60,
          weightedAvg: 60,
        },
        {
          criterionId: "crit-2",
          criterionName: "Clarity",
          weight: 2,
          maxScore: 5,
          avgRawScore: 4.5,
          avgNormalized: 90,
          weightedAvg: 180,
        },
      ],
      responses: [
        { responseId: "resp-b1", content: "Answer B1", tokensUsed: 8, latencyMs: 90 },
        { responseId: "resp-b2", content: "Answer B2", tokensUsed: 9, latencyMs: 95 },
      ],
    },
    {
      modelId: "model-a",
      modelName: "ModelA",
      provider: "openai",
      totalScore: 210,
      criteriaBreakdown: [
        {
          criterionId: "crit-1",
          criterionName: "Accuracy",
          weight: 1,
          maxScore: 10,
          avgRawScore: 7,
          avgNormalized: 70,
          weightedAvg: 70,
        },
        {
          criterionId: "crit-2",
          criterionName: "Clarity",
          weight: 2,
          maxScore: 5,
          avgRawScore: 3.5,
          avgNormalized: 70,
          weightedAvg: 140,
        },
      ],
      responses: [
        { responseId: "resp-a1", content: "Answer A1", tokensUsed: 10, latencyMs: 100 },
        { responseId: "resp-a2", content: "Answer A2", tokensUsed: 12, latencyMs: 110 },
      ],
    },
  ],
};

// Empty fixture (no models)
const emptyFixture: RunResults = {
  runId: "run-empty",
  sessionId: "session-empty",
  prompt: "Empty run",
  rankedModels: [],
};

// ── exportJSON ────────────────────────────────────────────────────────────────

describe("exportJSON", () => {
  it("exportJSON — returns a valid JSON string", () => {
    const json = exportJSON(fixture);
    expect(() => JSON.parse(json)).not.toThrow();
  });

  it("exportJSON — parsed result has correct runId and sessionId", () => {
    const parsed = JSON.parse(exportJSON(fixture)) as RunResults;
    expect(parsed.runId).toBe("run-001");
    expect(parsed.sessionId).toBe("session-001");
  });

  it("exportJSON — parsed result has correct number of rankedModels", () => {
    const parsed = JSON.parse(exportJSON(fixture)) as RunResults;
    expect(parsed.rankedModels).toHaveLength(2);
  });

  it("exportJSON — first ranked model has correct totalScore", () => {
    const parsed = JSON.parse(exportJSON(fixture)) as RunResults;
    expect(parsed.rankedModels[0].totalScore).toBe(240);
  });

  it("exportJSON — result is formatted (contains newlines)", () => {
    const json = exportJSON(fixture);
    expect(json).toContain("\n");
  });

  it("exportJSON — works for empty rankedModels", () => {
    const json = exportJSON(emptyFixture);
    const parsed = JSON.parse(json) as RunResults;
    expect(parsed.rankedModels).toHaveLength(0);
  });
});

// ── exportCSV ─────────────────────────────────────────────────────────────────

describe("exportCSV", () => {
  it("exportCSV — returns a string with multiple lines", () => {
    const csv = exportCSV(fixture);
    const lines = csv.split("\n");
    // Header + 2 data rows
    expect(lines.length).toBeGreaterThanOrEqual(3);
  });

  it("exportCSV — header row contains Rank, Model, Provider, TotalScore", () => {
    const csv = exportCSV(fixture);
    const header = csv.split("\n")[0];
    expect(header).toContain("Rank");
    expect(header).toContain("Model");
    expect(header).toContain("Provider");
    expect(header).toContain("TotalScore");
  });

  it("exportCSV — header row contains criterion names", () => {
    const csv = exportCSV(fixture);
    const header = csv.split("\n")[0];
    expect(header).toContain("Accuracy");
    expect(header).toContain("Clarity");
  });

  it("exportCSV — first data row has rank 1 and correct model name", () => {
    const csv = exportCSV(fixture);
    const firstRow = csv.split("\n")[1];
    expect(firstRow.startsWith("1,")).toBe(true);
    expect(firstRow).toContain("ModelB");
  });

  it("exportCSV — second data row has rank 2 and correct model name", () => {
    const csv = exportCSV(fixture);
    const secondRow = csv.split("\n")[2];
    expect(secondRow.startsWith("2,")).toBe(true);
    expect(secondRow).toContain("ModelA");
  });

  it("exportCSV — data rows contain total scores", () => {
    const csv = exportCSV(fixture);
    const lines = csv.split("\n");
    expect(lines[1]).toContain("240");
    expect(lines[2]).toContain("210");
  });

  it("exportCSV — returns only header for empty rankedModels", () => {
    const csv = exportCSV(emptyFixture);
    const lines = csv.split("\n");
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("Rank");
  });
});

// ── exportPDF ─────────────────────────────────────────────────────────────────

describe("exportPDF", () => {
  it("exportPDF — returns a Buffer", () => {
    const pdf = exportPDF(fixture);
    expect(Buffer.isBuffer(pdf)).toBe(true);
  });

  it("exportPDF — buffer starts with %PDF-", () => {
    const pdf = exportPDF(fixture);
    const header = pdf.slice(0, 5).toString("latin1");
    expect(header).toBe("%PDF-");
  });

  it("exportPDF — buffer ends with %%EOF marker", () => {
    const pdf = exportPDF(fixture);
    const tail = pdf.slice(-8).toString("latin1");
    expect(tail).toContain("%%EOF");
  });

  it("exportPDF — buffer has non-trivial size (> 100 bytes)", () => {
    const pdf = exportPDF(fixture);
    expect(pdf.length).toBeGreaterThan(100);
  });

  it("exportPDF — PDF contains title text", () => {
    const pdf = exportPDF(fixture);
    const content = pdf.toString("latin1");
    expect(content).toContain("LLM Benchmark Results");
  });

  it("exportPDF — PDF contains run ID", () => {
    const pdf = exportPDF(fixture);
    const content = pdf.toString("latin1");
    expect(content).toContain("run-001");
  });

  it("exportPDF — PDF contains xref section", () => {
    const pdf = exportPDF(fixture);
    const content = pdf.toString("latin1");
    expect(content).toContain("xref");
  });

  it("exportPDF — works for empty rankedModels", () => {
    const pdf = exportPDF(emptyFixture);
    expect(Buffer.isBuffer(pdf)).toBe(true);
    expect(pdf.slice(0, 5).toString("latin1")).toBe("%PDF-");
  });

  it("exportPDF — truncates long prompts to 200 characters", () => {
    const longPrompt = "A".repeat(300);
    const results: RunResults = { ...fixture, prompt: longPrompt };
    const pdf = exportPDF(results);
    const content = pdf.toString("latin1");
    // The truncated prompt should appear as 197 'A's + '...'
    expect(content).toContain("A".repeat(197) + "...");
    // The full 300-char string should NOT appear
    expect(content).not.toContain("A".repeat(300));
  });
});
