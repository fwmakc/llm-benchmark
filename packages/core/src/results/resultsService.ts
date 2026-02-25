import { getDatabase } from "../db/database.js";
import type { CriterionScore, ModelResult, RunResults } from "../types.js";

// Raw row shapes returned by the SQL query
interface ScoreJoinRow {
  score_value: number;
  response_id: string;
  model_id: string;
  model_name: string;
  provider: string;
  criterion_id: string;
  criterion_name: string;
  max_score: number;
  weight: number;
}

interface ResponseRow {
  id: string;
  content: string | null;
  tokens_used: number | null;
  latency_ms: number | null;
}

interface RunRow {
  prompt: string;
}

/**
 * Computes ranked results for a run based on a specific scoring session.
 * Applies the weighted scoring formula: normalize → average → weight → sum.
 * Returns models sorted by totalScore descending.
 */
export function computeResults(runId: string, sessionId: string): RunResults {
  const db = getDatabase();

  const runRow = db
    .prepare("SELECT prompt FROM Runs WHERE id = ?")
    .get(runId) as RunRow | undefined;
  if (!runRow) throw new Error(`Run ${runId} not found`);

  // Fetch all scores for this session joined with response, model, and criterion data.
  // We only include responses that belong to the given run.
  const scoreRows = db
    .prepare(
      `SELECT
         sc.score        AS score_value,
         r.id            AS response_id,
         r.model_id      AS model_id,
         m.name          AS model_name,
         m.provider      AS provider,
         cr.id           AS criterion_id,
         cr.name         AS criterion_name,
         cr.max_score    AS max_score,
         cr.weight       AS weight
       FROM Scores sc
       JOIN Responses r   ON r.id  = sc.response_id
       JOIN Models m      ON m.id  = r.model_id
       JOIN Criteria cr   ON cr.id = sc.criterion_id
       WHERE sc.session_id = ?
         AND r.run_id      = ?`
    )
    .all(sessionId, runId) as ScoreJoinRow[];

  // If no scores exist for this session, return empty results
  if (scoreRows.length === 0) {
    return { runId, sessionId, prompt: runRow.prompt, rankedModels: [] };
  }

  // Group scores by model then by criterion.
  // Structure: modelId → criterionId → raw score values[]
  const modelCriterionScores = new Map<
    string,
    Map<string, { scores: number[]; criterionName: string; maxScore: number; weight: number }>
  >();

  // Also track model metadata and which response ids belong to each model
  const modelMeta = new Map<string, { modelName: string; provider: string }>();
  const modelResponseIds = new Map<string, Set<string>>();

  for (const row of scoreRows) {
    if (!modelMeta.has(row.model_id)) {
      modelMeta.set(row.model_id, {
        modelName: row.model_name,
        provider: row.provider,
      });
    }

    // Track response ids per model
    let respSet = modelResponseIds.get(row.model_id);
    if (!respSet) {
      respSet = new Set<string>();
      modelResponseIds.set(row.model_id, respSet);
    }
    respSet.add(row.response_id);

    // Accumulate scores by (model, criterion)
    let criterionMap = modelCriterionScores.get(row.model_id);
    if (!criterionMap) {
      criterionMap = new Map();
      modelCriterionScores.set(row.model_id, criterionMap);
    }

    let entry = criterionMap.get(row.criterion_id);
    if (!entry) {
      entry = {
        scores: [],
        criterionName: row.criterion_name,
        maxScore: row.max_score,
        weight: row.weight,
      };
      criterionMap.set(row.criterion_id, entry);
    }
    entry.scores.push(row.score_value);
  }

  // Build ModelResult for each model
  const modelResults: ModelResult[] = [];

  for (const [modelId, criterionMap] of modelCriterionScores) {
    const meta = modelMeta.get(modelId)!;

    const criteriaBreakdown: CriterionScore[] = [];
    let totalScore = 0;

    for (const [criterionId, entry] of criterionMap) {
      const avgRawScore =
        entry.scores.reduce((sum, v) => sum + v, 0) / entry.scores.length;
      const avgNormalized = avgRawScore * 100 / entry.maxScore;
      const weightedAvg = avgNormalized * entry.weight;

      criteriaBreakdown.push({
        criterionId,
        criterionName: entry.criterionName,
        weight: entry.weight,
        maxScore: entry.maxScore,
        avgRawScore,
        avgNormalized,
        weightedAvg,
      });

      totalScore += weightedAvg;
    }

    // Fetch response content for responses that have at least one score in this session
    const respIds = Array.from(modelResponseIds.get(modelId) ?? []);
    const placeholders = respIds.map(() => "?").join(",");
    const responseRows =
      respIds.length > 0
        ? (db
            .prepare(
              `SELECT id, content, tokens_used, latency_ms
               FROM Responses
               WHERE id IN (${placeholders})`
            )
            .all(...respIds) as ResponseRow[])
        : [];

    const responses = responseRows.map((r) => ({
      responseId: r.id,
      content: r.content ?? "",
      ...(r.tokens_used !== null ? { tokensUsed: r.tokens_used } : {}),
      ...(r.latency_ms !== null ? { latencyMs: r.latency_ms } : {}),
    }));

    modelResults.push({
      modelId,
      modelName: meta.modelName,
      provider: meta.provider,
      totalScore,
      criteriaBreakdown,
      responses,
    });
  }

  // Sort by totalScore descending
  modelResults.sort((a, b) => b.totalScore - a.totalScore);

  return { runId, sessionId, prompt: runRow.prompt, rankedModels: modelResults };
}
