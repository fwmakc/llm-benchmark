"use client";

import { useState, useEffect, useTransition } from "react";
import { getCriteria, createCriterion, editCriterion, removeCriterion } from "./actions";
import type { Criterion } from "@llm-benchmark/core";

export default function CriteriaPage() {
  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", maxScore: "", weight: "" });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", maxScore: "", weight: "" });

  function reload() {
    startTransition(async () => {
      try {
        setCriteria(await getCriteria());
      } catch (e) {
        setError(String(e));
      }
    });
  }

  useEffect(() => {
    reload();
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const maxScore = form.maxScore !== "" ? parseFloat(form.maxScore) : undefined;
      const weight = form.weight !== "" ? parseFloat(form.weight) : undefined;
      await createCriterion({ name: form.name, maxScore, weight });
      setForm({ name: "", maxScore: "", weight: "" });
      reload();
    } catch (e) {
      setError(String(e));
    }
  }

  function startEdit(c: Criterion) {
    setEditingId(c.id);
    setEditForm({ name: c.name, maxScore: String(c.maxScore), weight: String(c.weight) });
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingId) return;
    setError(null);
    try {
      const maxScore = editForm.maxScore !== "" ? parseFloat(editForm.maxScore) : undefined;
      const weight = editForm.weight !== "" ? parseFloat(editForm.weight) : undefined;
      await editCriterion(editingId, { name: editForm.name || undefined, maxScore, weight });
      setEditingId(null);
      reload();
    } catch (e) {
      setError(String(e));
    }
  }

  async function handleDelete(id: string) {
    setError(null);
    try {
      await removeCriterion(id);
      reload();
    } catch (e) {
      setError(String(e));
    }
  }

  return (
    <main style={{ fontFamily: "monospace", maxWidth: 720, margin: "2rem auto", padding: "0 1rem" }}>
      <h1>Criteria</h1>

      {error && <p style={{ color: "red" }}>Error: {error}</p>}

      <section>
        <h2>Add Criterion</h2>
        <form onSubmit={handleAdd} style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 400 }}>
          <input
            required
            placeholder="Name (e.g. Accuracy)"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
          <input
            type="number"
            min="0"
            step="any"
            placeholder="Max score (default 10)"
            value={form.maxScore}
            onChange={(e) => setForm((f) => ({ ...f, maxScore: e.target.value }))}
          />
          <input
            type="number"
            min="0"
            step="any"
            placeholder="Weight (default 1)"
            value={form.weight}
            onChange={(e) => setForm((f) => ({ ...f, weight: e.target.value }))}
          />
          <button type="submit" disabled={isPending} style={{ alignSelf: "flex-start" }}>
            Add
          </button>
        </form>
      </section>

      <section style={{ marginTop: "2rem" }}>
        <h2>Configured Criteria</h2>
        {criteria.length === 0 && <p>No criteria yet.</p>}
        <ul style={{ listStyle: "none", padding: 0 }}>
          {criteria.map((c) => (
            <li key={c.id} style={{ borderBottom: "1px solid #ccc", padding: "0.5rem 0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>
                  <strong>{c.name}</strong>
                  <span style={{ color: "#666" }}> (max={c.maxScore}, weight={c.weight})</span>
                </span>
                <span style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => startEdit(c)} disabled={isPending}>Edit</button>
                  <button onClick={() => handleDelete(c.id)} disabled={isPending}>Delete</button>
                </span>
              </div>
              {editingId === c.id && (
                <form onSubmit={handleEdit} style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
                  <input
                    required
                    placeholder="Name"
                    value={editForm.name}
                    onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                  />
                  <input
                    type="number"
                    min="0"
                    step="any"
                    placeholder="Max score"
                    value={editForm.maxScore}
                    onChange={(e) => setEditForm((f) => ({ ...f, maxScore: e.target.value }))}
                  />
                  <input
                    type="number"
                    min="0"
                    step="any"
                    placeholder="Weight"
                    value={editForm.weight}
                    onChange={(e) => setEditForm((f) => ({ ...f, weight: e.target.value }))}
                  />
                  <div style={{ display: "flex", gap: 8 }}>
                    <button type="submit" disabled={isPending}>Save</button>
                    <button type="button" onClick={() => setEditingId(null)} disabled={isPending}>Cancel</button>
                  </div>
                </form>
              )}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
