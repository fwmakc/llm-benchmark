"use client";

import { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import { getRunForScoring, startScoringSession, submitScore } from "./actions";
import type { RunWithDetails, Response, Criterion } from "@llm-benchmark/core";

interface Props {
  params: Promise<{ id: string }>;
}

export default function ScorePage({ params }: Props) {
  const [runId, setRunId] = useState<string | null>(null);
  const [run, setRun] = useState<RunWithDetails | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [shuffledResponses, setShuffledResponses] = useState<Response[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  // criterionId → score string entered by user
  const [scores, setScores] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    params.then(({ id }) => {
      setRunId(id);
      startTransition(async () => {
        try {
          const [runData, session] = await Promise.all([
            getRunForScoring(id),
            startScoringSession(id),
          ]);

          const valid = runData.responses.filter((r) => !r.errorMsg);

          // Fisher-Yates shuffle so model identity stays hidden during scoring
          const arr = [...valid];
          for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j]!, arr[i]!];
          }

          setRun(runData);
          setSessionId(session.id);
          setShuffledResponses(arr);
          setScores({});
        } catch (e) {
          setError(String(e));
        }
      });
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleNext() {
    if (!sessionId || !run) return;
    const resp = shuffledResponses[currentIdx];
    if (!resp) return;

    setError(null);
    startTransition(async () => {
      try {
        for (const criterion of run.criteria) {
          const raw = scores[criterion.id] ?? "0";
          const val = parseFloat(raw);
          const clamped = isNaN(val) ? 0 : Math.max(0, Math.min(val, criterion.maxScore));
          await submitScore({
            sessionId,
            responseId: resp.id,
            criterionId: criterion.id,
            score: clamped,
          });
        }

        if (currentIdx + 1 >= shuffledResponses.length) {
          setDone(true);
        } else {
          setCurrentIdx((i) => i + 1);
          setScores({});
        }
      } catch (e) {
        setError(String(e));
      }
    });
  }

  // ---- render helpers ----

  if (!run && isPending) {
    return (
      <main style={{ fontFamily: "monospace", maxWidth: 900, margin: "2rem auto", padding: "0 1rem" }}>
        <p>Loading...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main style={{ fontFamily: "monospace", maxWidth: 900, margin: "2rem auto", padding: "0 1rem" }}>
        <p style={{ color: "red" }}>Error: {error}</p>
        {runId && (
          <p>
            <Link href={`/runs/${runId}`}>&larr; Back to run</Link>
          </p>
        )}
      </main>
    );
  }

  if (!run) {
    return (
      <main style={{ fontFamily: "monospace", maxWidth: 900, margin: "2rem auto", padding: "0 1rem" }}>
        <p>Loading...</p>
      </main>
    );
  }

  if (run.criteria.length === 0) {
    return (
      <main style={{ fontFamily: "monospace", maxWidth: 900, margin: "2rem auto", padding: "0 1rem" }}>
        <p>
          <Link href={`/runs/${run.id}`}>&larr; Back to run</Link>
        </p>
        <p>No criteria configured for this run. Cannot score.</p>
      </main>
    );
  }

  if (shuffledResponses.length === 0) {
    return (
      <main style={{ fontFamily: "monospace", maxWidth: 900, margin: "2rem auto", padding: "0 1rem" }}>
        <p>
          <Link href={`/runs/${run.id}`}>&larr; Back to run</Link>
        </p>
        <p>No scoreable responses (all responses had errors).</p>
      </main>
    );
  }

  if (done) {
    return (
      <main style={{ fontFamily: "monospace", maxWidth: 900, margin: "2rem auto", padding: "0 1rem" }}>
        <h1>Scoring complete!</h1>
        <p>
          {shuffledResponses.length} response{shuffledResponses.length !== 1 ? "s" : ""} scored.
        </p>
        <p>
          <Link href={`/runs/${run.id}`}>&larr; Back to run</Link>
        </p>
      </main>
    );
  }

  // ---- active scoring UI ----

  const currentResponse = shuffledResponses[currentIdx]!;
  const isLast = currentIdx + 1 >= shuffledResponses.length;
  const total = shuffledResponses.length;

  return (
    <main style={{ fontFamily: "monospace", maxWidth: 900, margin: "2rem auto", padding: "0 1rem" }}>
      <div style={{ marginBottom: "1rem" }}>
        <Link href={`/runs/${run.id}`}>&larr; Back to run</Link>
      </div>

      <h1>Score Responses</h1>

      {/* Progress indicator */}
      <p style={{ color: "#666", marginBottom: "1.5rem" }}>
        Response {currentIdx + 1} of {total}
      </p>

      {/* Response content — no model identity shown */}
      <section style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ marginBottom: "0.5rem" }}>Response #{currentIdx + 1}</h2>
        <pre
          style={{
            background: "#f4f4f4",
            padding: "1rem",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            borderRadius: 4,
            margin: 0,
          }}
        >
          {currentResponse.content ?? "(empty)"}
        </pre>
      </section>

      {/* Score inputs — one per criterion */}
      <section style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ marginBottom: "0.75rem" }}>Scores</h2>
        {run.criteria.map((criterion: Criterion) => (
          <div key={criterion.id} style={{ marginBottom: "0.75rem" }}>
            <label style={{ display: "block", marginBottom: "0.25rem" }}>
              <strong>{criterion.name}</strong>
              <span style={{ color: "#666", marginLeft: "0.5rem" }}>
                (0 &ndash; {criterion.maxScore}, weight: {criterion.weight})
              </span>
            </label>
            <input
              type="number"
              min={0}
              max={criterion.maxScore}
              step="any"
              value={scores[criterion.id] ?? ""}
              onChange={(e) =>
                setScores((prev) => ({ ...prev, [criterion.id]: e.target.value }))
              }
              style={{
                fontFamily: "monospace",
                fontSize: "1rem",
                padding: "0.3rem 0.5rem",
                width: 120,
                border: "1px solid #ccc",
                borderRadius: 4,
              }}
              disabled={isPending}
            />
          </div>
        ))}
      </section>

      {error && <p style={{ color: "red", marginBottom: "1rem" }}>Error: {error}</p>}

      <button
        onClick={() => { void handleNext(); }}
        disabled={isPending}
        style={{
          fontFamily: "monospace",
          fontSize: "1rem",
          padding: "0.5rem 1.25rem",
          cursor: isPending ? "wait" : "pointer",
          border: "1px solid #333",
          borderRadius: 4,
          background: isPending ? "#ccc" : "#333",
          color: "#fff",
        }}
      >
        {isPending ? "Saving..." : isLast ? "Finish" : "Next \u2192"}
      </button>
    </main>
  );
}
