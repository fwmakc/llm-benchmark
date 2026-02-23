import React, { useState, useEffect } from "react";
import { render, Box, Text, useInput, useApp } from "ink";
import TextInput from "ink-text-input";
import {
  openDatabase,
  listModels,
  addModel,
  deleteModel,
  APP_NAME,
} from "@llm-benchmark/core";
import type { Model, ModelInput } from "@llm-benchmark/core";

// ── Types ─────────────────────────────────────────────────────────────────────
type Screen = "menu" | "list" | "add" | "adding" | "deleting";
type AddField = "name" | "provider" | "modelId" | "apiKey";

const ADD_FIELDS: AddField[] = ["name", "provider", "modelId", "apiKey"];
const FIELD_LABELS: Record<AddField, string> = {
  name: "Display name",
  provider: "Provider (e.g. anthropic, openai)",
  modelId: "Model ID (e.g. claude-opus-4-6)",
  apiKey: "API Key (hidden)",
};

// ── Main App ──────────────────────────────────────────────────────────────────
function App() {
  const { exit } = useApp();
  const [screen, setScreen] = useState<Screen>("menu");
  const [models, setModels] = useState<Model[]>([]);
  const [cursor, setCursor] = useState(0);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Add-model form state
  const [addForm, setAddForm] = useState<ModelInput>({
    name: "",
    provider: "",
    modelId: "",
    apiKey: "",
  });
  const [addFieldIdx, setAddFieldIdx] = useState(0);

  function loadModels() {
    try {
      setModels(listModels());
    } catch (e) {
      setError(String(e));
    }
  }

  useEffect(() => {
    try {
      openDatabase();
      loadModels();
    } catch (e) {
      setError(`DB init error: ${e}`);
    }
  }, []);

  useInput((input, key) => {
    setError(null);
    setStatusMsg(null);

    // ── MENU ───────────────────────────────────────────────────────────────
    if (screen === "menu") {
      if (input === "1") {
        loadModels();
        setCursor(0);
        setScreen("list");
      } else if (input === "2") {
        setAddForm({ name: "", provider: "", modelId: "", apiKey: "" });
        setAddFieldIdx(0);
        setScreen("add");
      } else if (input === "q" || key.escape) {
        exit();
      }
      return;
    }

    // ── LIST ───────────────────────────────────────────────────────────────
    if (screen === "list") {
      if (key.escape || input === "q") {
        setScreen("menu");
        return;
      }
      if (key.upArrow && cursor > 0) setCursor((c) => c - 1);
      if (key.downArrow && cursor < models.length - 1) setCursor((c) => c + 1);
      if (input === "d" && models.length > 0) {
        const id = models[cursor]?.id;
        if (!id) return;
        setScreen("deleting");
        deleteModel(id);
        loadModels();
        setCursor((c) => Math.max(0, c - 1));
        setStatusMsg("Model deleted.");
        setScreen("list");
      }
      return;
    }

    // ── ADD (field-by-field) ───────────────────────────────────────────────
    // useInput is only used for navigation; text is handled by TextInput below
    if (screen === "add") {
      if (key.escape) {
        setScreen("menu");
        return;
      }
    }
  });

  // ── ADD: advance field on Enter ───────────────────────────────────────────
  function handleFieldSubmit(value: string) {
    const field = ADD_FIELDS[addFieldIdx];
    if (!field) return;
    setAddForm((f) => ({ ...f, [field]: value }));

    if (addFieldIdx < ADD_FIELDS.length - 1) {
      setAddFieldIdx((i) => i + 1);
    } else {
      // Last field submitted — save the model
      const finalForm = { ...addForm, [field]: value };
      setScreen("adding");
      addModel(finalForm)
        .then(() => {
          loadModels();
          setStatusMsg("Model added successfully.");
          setScreen("list");
        })
        .catch((e: unknown) => {
          setError(String(e));
          setScreen("add");
        });
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color="cyan">
        {APP_NAME} — Model Manager
      </Text>
      <Text> </Text>

      {error && <Text color="red">Error: {error}</Text>}
      {statusMsg && <Text color="green">{statusMsg}</Text>}

      {screen === "menu" && (
        <Box flexDirection="column">
          <Text>[1] List models</Text>
          <Text>[2] Add model</Text>
          <Text>[q] Quit</Text>
        </Box>
      )}

      {screen === "list" && (
        <Box flexDirection="column">
          <Text bold>Configured models ({models.length})</Text>
          {models.length === 0 && <Text dimColor>No models yet.</Text>}
          {models.map((m, i) => (
            <Text key={m.id} color={i === cursor ? "yellow" : undefined}>
              {i === cursor ? "▶ " : "  "}
              {m.name} — {m.provider} / {m.modelId}
            </Text>
          ))}
          <Text> </Text>
          <Text dimColor>[↑↓] navigate  [d] delete  [q/Esc] back</Text>
        </Box>
      )}

      {screen === "add" && (
        <Box flexDirection="column">
          <Text bold>Add Model</Text>
          <Text dimColor>[Esc] cancel</Text>
          <Text> </Text>
          {ADD_FIELDS.map((field, i) => {
            const label = FIELD_LABELS[field];
            if (i < addFieldIdx) {
              const val = field === "apiKey" ? "••••••••" : addForm[field];
              return (
                <Text key={field} dimColor>
                  {label}: {val}
                </Text>
              );
            }
            if (i === addFieldIdx) {
              return (
                <Box key={field}>
                  <Text>{label}: </Text>
                  <TextInput
                    value={addForm[field]}
                    mask={field === "apiKey" ? "•" : undefined}
                    onChange={(val) => setAddForm((f) => ({ ...f, [field]: val }))}
                    onSubmit={handleFieldSubmit}
                  />
                </Box>
              );
            }
            return (
              <Text key={field} dimColor>
                {label}:{" "}
              </Text>
            );
          })}
        </Box>
      )}

      {screen === "adding" && <Text>Saving model...</Text>}
      {screen === "deleting" && <Text>Deleting...</Text>}
    </Box>
  );
}

render(<App />);
