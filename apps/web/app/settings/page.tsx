"use client";

import { useState, useEffect, useTransition } from "react";
import { getModels, createModel, removeModel } from "./actions";
import type { Model } from "@llm-benchmark/core";

export default function SettingsPage() {
  const [models, setModels] = useState<Model[]>([]);
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState({ name: "", provider: "", modelId: "", apiKey: "" });
  const [error, setError] = useState<string | null>(null);

  function reload() {
    startTransition(async () => {
      try {
        setModels(await getModels());
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
      await createModel(form);
      setForm({ name: "", provider: "", modelId: "", apiKey: "" });
      reload();
    } catch (e) {
      setError(String(e));
    }
  }

  async function handleDelete(id: string) {
    setError(null);
    try {
      await removeModel(id);
      reload();
    } catch (e) {
      setError(String(e));
    }
  }

  return (
    <main style={{ fontFamily: "monospace", maxWidth: 720, margin: "2rem auto", padding: "0 1rem" }}>
      <h1>Model Settings</h1>

      <section>
        <h2>Add Model</h2>
        <form onSubmit={handleAdd} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <input
            required
            placeholder="Display name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
          <input
            required
            placeholder="Provider (e.g. anthropic, openai)"
            value={form.provider}
            onChange={(e) => setForm((f) => ({ ...f, provider: e.target.value }))}
          />
          <input
            required
            placeholder="Model ID (e.g. claude-opus-4-6)"
            value={form.modelId}
            onChange={(e) => setForm((f) => ({ ...f, modelId: e.target.value }))}
          />
          <input
            required
            type="password"
            placeholder="API Key"
            value={form.apiKey}
            onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))}
          />
          <button type="submit" disabled={isPending}>
            Add
          </button>
        </form>
      </section>

      {error && <p style={{ color: "red" }}>Error: {error}</p>}

      <section style={{ marginTop: "2rem" }}>
        <h2>Configured Models</h2>
        {models.length === 0 && <p>No models configured.</p>}
        <ul style={{ listStyle: "none", padding: 0 }}>
          {models.map((m) => (
            <li
              key={m.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                borderBottom: "1px solid #ccc",
                padding: "0.5rem 0",
              }}
            >
              <span>
                <strong>{m.name}</strong> — {m.provider} / {m.modelId}
              </span>
              <button onClick={() => handleDelete(m.id)} disabled={isPending}>
                Delete
              </button>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
