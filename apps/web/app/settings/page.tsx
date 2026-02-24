"use client";

import { useState, useEffect, useTransition } from "react";
import { getModels, createModel, editModel, removeModel } from "./actions";
import type { Model } from "@llm-benchmark/core";

export default function SettingsPage() {
  const [models, setModels] = useState<Model[]>([]);
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState({ name: "", provider: "", modelId: "", apiKey: "", temperature: "", maxTokens: "", baseUrl: "" });
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", provider: "", modelId: "", apiKey: "", temperature: "", maxTokens: "", baseUrl: "" });

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
      const temperature = form.temperature !== "" ? parseFloat(form.temperature) : null;
      const maxTokens = form.maxTokens !== "" ? parseInt(form.maxTokens, 10) : null;
      const baseUrl = form.baseUrl.trim() !== "" ? form.baseUrl.trim() : null;
      await createModel({ name: form.name, provider: form.provider, modelId: form.modelId, apiKey: form.apiKey, temperature, maxTokens, baseUrl });
      setForm({ name: "", provider: "", modelId: "", apiKey: "", temperature: "", maxTokens: "", baseUrl: "" });
      reload();
    } catch (e) {
      setError(String(e));
    }
  }

  function startEdit(m: Model) {
    setEditingId(m.id);
    setEditForm({
      name: m.name,
      provider: m.provider,
      modelId: m.modelId,
      apiKey: "",
      temperature: m.temperature !== null ? String(m.temperature) : "",
      maxTokens: m.maxTokens !== null ? String(m.maxTokens) : "",
      baseUrl: m.baseUrl ?? "",
    });
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingId) return;
    setError(null);
    try {
      const temperature = editForm.temperature !== "" ? parseFloat(editForm.temperature) : null;
      const maxTokens = editForm.maxTokens !== "" ? parseInt(editForm.maxTokens, 10) : null;
      const baseUrl = editForm.baseUrl.trim() !== "" ? editForm.baseUrl.trim() : null;
      const input: { name: string; provider: string; modelId: string; apiKey?: string; temperature: number | null; maxTokens: number | null; baseUrl: string | null } = {
        name: editForm.name,
        provider: editForm.provider,
        modelId: editForm.modelId,
        temperature,
        maxTokens,
        baseUrl,
      };
      if (editForm.apiKey.trim() !== "") input.apiKey = editForm.apiKey.trim();
      await editModel(editingId, input);
      setEditingId(null);
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
          <input
            type="number"
            step="0.01"
            min="0"
            max="2"
            placeholder="Temperature (optional, e.g. 0.7)"
            value={form.temperature}
            onChange={(e) => setForm((f) => ({ ...f, temperature: e.target.value }))}
          />
          <input
            type="number"
            min="1"
            placeholder="Max tokens (optional, e.g. 4096)"
            value={form.maxTokens}
            onChange={(e) => setForm((f) => ({ ...f, maxTokens: e.target.value }))}
          />
          <input
            type="url"
            placeholder="Base URL (optional, for self-hosted)"
            value={form.baseUrl}
            onChange={(e) => setForm((f) => ({ ...f, baseUrl: e.target.value }))}
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
            <li key={m.id} style={{ borderBottom: "1px solid #ccc", padding: "0.5rem 0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>
                  <strong>{m.name}</strong> — {m.provider} / {m.modelId}
                  {m.baseUrl && <span> ({m.baseUrl})</span>}
                  {m.temperature !== null && <span> temp={m.temperature}</span>}
                  {m.maxTokens !== null && <span> max={m.maxTokens}</span>}
                </span>
                <span style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => startEdit(m)} disabled={isPending}>Edit</button>
                  <button onClick={() => handleDelete(m.id)} disabled={isPending}>Delete</button>
                </span>
              </div>
              {editingId === m.id && (
                <form onSubmit={handleEdit} style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
                  <input required placeholder="Display name" value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} />
                  <input required placeholder="Provider" value={editForm.provider} onChange={(e) => setEditForm((f) => ({ ...f, provider: e.target.value }))} />
                  <input required placeholder="Model ID" value={editForm.modelId} onChange={(e) => setEditForm((f) => ({ ...f, modelId: e.target.value }))} />
                  <input type="password" placeholder="New API Key (leave blank to keep current)" value={editForm.apiKey} onChange={(e) => setEditForm((f) => ({ ...f, apiKey: e.target.value }))} />
                  <input type="number" step="0.01" min="0" max="2" placeholder="Temperature (optional)" value={editForm.temperature} onChange={(e) => setEditForm((f) => ({ ...f, temperature: e.target.value }))} />
                  <input type="number" min="1" placeholder="Max tokens (optional)" value={editForm.maxTokens} onChange={(e) => setEditForm((f) => ({ ...f, maxTokens: e.target.value }))} />
                  <input type="url" placeholder="Base URL (optional)" value={editForm.baseUrl} onChange={(e) => setEditForm((f) => ({ ...f, baseUrl: e.target.value }))} />
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
