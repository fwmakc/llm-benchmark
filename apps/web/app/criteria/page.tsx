"use client";

import { useState, useEffect, useTransition } from "react";
import { getSets, createSet, removeSet, getCriteria, createCriterion, removeCriterion } from "./actions";
import type { CriteriaSet, Criterion } from "@llm-benchmark/core";

export default function CriteriaPage() {
  const [sets, setSets] = useState<CriteriaSet[]>([]);
  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [selectedSetId, setSelectedSetId] = useState<string | "all">("all");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Add-set form
  const [setForm, setSetForm] = useState({ name: "" });

  // Add-criterion form
  const [criterionForm, setCriterionForm] = useState({
    name: "",
    maxScore: "",
    weight: "",
    setId: "",
  });

  function reloadSets() {
    startTransition(async () => {
      try {
        setSets(await getSets());
      } catch (e) {
        setError(String(e));
      }
    });
  }

  function reloadCriteria(setId?: string) {
    startTransition(async () => {
      try {
        setCriteria(await getCriteria(setId));
      } catch (e) {
        setError(String(e));
      }
    });
  }

  useEffect(() => {
    reloadSets();
    reloadCriteria();
  }, []);

  async function handleAddSet(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await createSet(setForm.name.trim());
      setSetForm({ name: "" });
      reloadSets();
    } catch (e) {
      setError(String(e));
    }
  }

  async function handleDeleteSet(id: string) {
    setError(null);
    try {
      await removeSet(id);
      if (selectedSetId === id) {
        setSelectedSetId("all");
        reloadCriteria();
      }
      reloadSets();
    } catch (e) {
      setError(String(e));
    }
  }

  async function handleAddCriterion(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const maxScore = criterionForm.maxScore !== "" ? parseFloat(criterionForm.maxScore) : undefined;
      const weight = criterionForm.weight !== "" ? parseFloat(criterionForm.weight) : undefined;
      const setId = criterionForm.setId !== "" ? criterionForm.setId : null;
      await createCriterion({ name: criterionForm.name, maxScore, weight, setId });
      setCriterionForm({ name: "", maxScore: "", weight: "", setId: "" });
      reloadCriteria(selectedSetId === "all" ? undefined : selectedSetId);
    } catch (e) {
      setError(String(e));
    }
  }

  async function handleDeleteCriterion(id: string) {
    setError(null);
    try {
      await removeCriterion(id);
      reloadCriteria(selectedSetId === "all" ? undefined : selectedSetId);
    } catch (e) {
      setError(String(e));
    }
  }

  function handleSetFilter(id: string | "all") {
    setSelectedSetId(id);
    reloadCriteria(id === "all" ? undefined : id);
  }

  const label = (txt: string) => (
    <label style={{ fontSize: "0.85rem", color: "#888", marginBottom: 2 }}>{txt}</label>
  );

  return (
    <main style={{ fontFamily: "monospace", maxWidth: 800, margin: "2rem auto", padding: "0 1rem" }}>
      <h1>Criteria</h1>

      {error && <p style={{ color: "red" }}>Error: {error}</p>}

      {/* ── Criteria Sets ───────────────────────────────────── */}
      <section>
        <h2>Criteria Sets</h2>

        <form onSubmit={handleAddSet} style={{ display: "flex", gap: 8, alignItems: "flex-end", marginBottom: "1rem" }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {label("Set name")}
            <input
              required
              placeholder="e.g. Writing Quality"
              value={setForm.name}
              onChange={(e) => setSetForm({ name: e.target.value })}
            />
          </div>
          <button type="submit" disabled={isPending}>Add Set</button>
        </form>

        {sets.length === 0 && <p style={{ color: "#888" }}>No sets yet.</p>}
        <ul style={{ listStyle: "none", padding: 0 }}>
          {sets.map((s) => (
            <li
              key={s.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "0.4rem 0",
                borderBottom: "1px solid #eee",
              }}
            >
              <span>{s.name}</span>
              <button onClick={() => handleDeleteSet(s.id)} disabled={isPending}>Delete</button>
            </li>
          ))}
        </ul>
      </section>

      {/* ── Criteria ────────────────────────────────────────── */}
      <section style={{ marginTop: "2rem" }}>
        <h2>Criteria</h2>

        <form onSubmit={handleAddCriterion} style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: "1rem", maxWidth: 400 }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {label("Name *")}
            <input
              required
              placeholder="e.g. Accuracy"
              value={criterionForm.name}
              onChange={(e) => setCriterionForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {label("Max score (default 10)")}
            <input
              type="number"
              min="0"
              step="any"
              placeholder="10"
              value={criterionForm.maxScore}
              onChange={(e) => setCriterionForm((f) => ({ ...f, maxScore: e.target.value }))}
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {label("Weight (default 1)")}
            <input
              type="number"
              min="0"
              step="any"
              placeholder="1"
              value={criterionForm.weight}
              onChange={(e) => setCriterionForm((f) => ({ ...f, weight: e.target.value }))}
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {label("Set (optional)")}
            <select
              value={criterionForm.setId}
              onChange={(e) => setCriterionForm((f) => ({ ...f, setId: e.target.value }))}
            >
              <option value="">— no set —</option>
              {sets.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <button type="submit" disabled={isPending} style={{ alignSelf: "flex-start" }}>
            Add Criterion
          </button>
        </form>

        {/* Filter by set */}
        <div style={{ display: "flex", gap: 8, marginBottom: "1rem", flexWrap: "wrap" }}>
          <button
            onClick={() => handleSetFilter("all")}
            disabled={selectedSetId === "all"}
            style={{ fontWeight: selectedSetId === "all" ? "bold" : undefined }}
          >
            All
          </button>
          {sets.map((s) => (
            <button
              key={s.id}
              onClick={() => handleSetFilter(s.id)}
              disabled={selectedSetId === s.id}
              style={{ fontWeight: selectedSetId === s.id ? "bold" : undefined }}
            >
              {s.name}
            </button>
          ))}
        </div>

        {criteria.length === 0 && <p style={{ color: "#888" }}>No criteria.</p>}
        <ul style={{ listStyle: "none", padding: 0 }}>
          {criteria.map((c) => {
            const setName = sets.find((s) => s.id === c.setId)?.name;
            return (
              <li
                key={c.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "0.4rem 0",
                  borderBottom: "1px solid #eee",
                }}
              >
                <span>
                  <strong>{c.name}</strong>
                  <span style={{ color: "#888" }}> max={c.maxScore} w={c.weight}</span>
                  {setName && <span style={{ color: "#888" }}> [{setName}]</span>}
                </span>
                <button onClick={() => handleDeleteCriterion(c.id)} disabled={isPending}>
                  Delete
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </main>
  );
}
