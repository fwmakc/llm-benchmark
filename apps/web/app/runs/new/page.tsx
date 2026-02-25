"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { getModelsForRun, getCriteriaForRun, startRun } from "../actions";
import type { Model, Criterion } from "@llm-benchmark/core";

export default function NewRunPage() {
  const router = useRouter();
  const [models, setModels] = useState<Model[]>([]);
  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [selectedModels, setSelectedModels] = useState<Set<string>>(new Set());
  const [selectedCriteria, setSelectedCriteria] = useState<Set<string>>(new Set());
  const [prompt, setPrompt] = useState("");
  const [requestsPerModel, setRequestsPerModel] = useState(1);
  const [isExecuting, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    startTransition(async () => {
      try {
        const [m, c] = await Promise.all([getModelsForRun(), getCriteriaForRun()]);
        setModels(m);
        setCriteria(c);
      } catch (e) {
        setError(String(e));
      }
    });
  }, []);

  function toggleModel(id: string) {
    setSelectedModels((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleCriterion(id: string) {
    setSelectedCriteria((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (selectedModels.size === 0) { setError("Select at least one model."); return; }
    if (prompt.trim() === "") { setError("Prompt is required."); return; }
    startTransition(async () => {
      try {
        const runId = await startRun({
          prompt: prompt.trim(),
          requestsPerModel,
          modelIds: Array.from(selectedModels),
          criteriaIds: Array.from(selectedCriteria),
        });
        router.push(`/runs/${runId}`);
      } catch (e) {
        setError(String(e));
      }
    });
  }

  return (
    <main style={{ fontFamily: "monospace", maxWidth: 720, margin: "2rem auto", padding: "0 1rem" }}>
      <h1>New Run</h1>

      {error && <p style={{ color: "red" }}>Error: {error}</p>}

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <section>
          <h2>Select Models</h2>
          {models.length === 0 && <p>No models configured. <a href="/settings">Add models first.</a></p>}
          {models.map((m) => (
            <label key={m.id} style={{ display: "block", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={selectedModels.has(m.id)}
                onChange={() => toggleModel(m.id)}
              />{" "}
              {m.name} &mdash; {m.provider}/{m.modelId}
            </label>
          ))}
        </section>

        <section>
          <h2>Select Criteria (optional)</h2>
          {criteria.length === 0 && <p>No criteria configured.</p>}
          {criteria.map((c) => (
            <label key={c.id} style={{ display: "block", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={selectedCriteria.has(c.id)}
                onChange={() => toggleCriterion(c.id)}
              />{" "}
              {c.name} (max={c.maxScore}, weight={c.weight})
            </label>
          ))}
        </section>

        <section>
          <h2>Prompt</h2>
          <textarea
            required
            rows={6}
            style={{ width: "100%", fontFamily: "monospace", resize: "vertical" }}
            placeholder="Enter the prompt to send to all models..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
        </section>

        <section>
          <label>
            <strong>Requests per model:</strong>{" "}
            <input
              type="number"
              min={1}
              max={10}
              value={requestsPerModel}
              onChange={(e) => setRequestsPerModel(parseInt(e.target.value, 10) || 1)}
              style={{ width: 60 }}
            />
          </label>
        </section>

        <button type="submit" disabled={isExecuting} style={{ padding: "0.5rem 1.5rem" }}>
          {isExecuting ? "Executing\u2026" : "Execute Run"}
        </button>
      </form>
    </main>
  );
}
