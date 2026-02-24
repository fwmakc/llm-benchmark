import React, { useState, useEffect } from "react";
import { render, Box, Text, useInput, useApp } from "ink";
import TextInput from "ink-text-input";
import {
  openDatabase,
  listModels,
  addModel,
  updateModel,
  deleteModel,
  APP_NAME,
} from "@llm-benchmark/core";
import type { Model, ModelInput, ModelUpdateInput } from "@llm-benchmark/core";

// ── Types ─────────────────────────────────────────────────────────────────────
type Screen = "menu" | "list" | "add" | "adding" | "deleting" | "edit" | "editing";
type AddField = "name" | "provider" | "modelId" | "apiKey" | "temperature" | "maxTokens" | "baseUrl";

const ADD_FIELDS: AddField[] = ["name", "provider", "modelId", "apiKey", "temperature", "maxTokens", "baseUrl"];
const FIELD_LABELS: Record<AddField, string> = {
  name: "Display name",
  provider: "Provider (e.g. anthropic, openai)",
  modelId: "Model ID (e.g. claude-opus-4-6)",
  apiKey: "API Key (hidden)",
  temperature: "Temperature (optional, e.g. 0.7 — Enter to skip)",
  maxTokens: "Max tokens (optional, e.g. 4096 — Enter to skip)",
  baseUrl: "Base URL (optional, for self-hosted — Enter to skip)",
};

const EMPTY_FORM: Record<AddField, string> = {
  name: "", provider: "", modelId: "", apiKey: "", temperature: "", maxTokens: "", baseUrl: "",
};

// ── Main App ──────────────────────────────────────────────────────────────────
function App() {
  const { exit } = useApp();
  const [screen, setScreen] = useState<Screen>("menu");
  const [models, setModels] = useState<Model[]>([]);
  const [cursor, setCursor] = useState(0);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Add-model form state (all strings; parsed to ModelInput at submit time)
  const [addForm, setAddForm] = useState<Record<AddField, string>>(EMPTY_FORM);
  const [addFieldIdx, setAddFieldIdx] = useState(0);

  // Edit-model form state
  const [editModelId, setEditModelId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Record<AddField, string>>(EMPTY_FORM);
  const [editFieldIdx, setEditFieldIdx] = useState(0);

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
        setAddForm(EMPTY_FORM);
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
      if (input === "e" && models.length > 0) {
        const m = models[cursor];
        if (!m) return;
        setEditModelId(m.id);
        setEditForm({
          name: m.name,
          provider: m.provider,
          modelId: m.modelId,
          apiKey: "",
          temperature: m.temperature !== null ? String(m.temperature) : "",
          maxTokens: m.maxTokens !== null ? String(m.maxTokens) : "",
          baseUrl: m.baseUrl ?? "",
        });
        setEditFieldIdx(0);
        setScreen("edit");
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

    // ── EDIT (field-by-field) ──────────────────────────────────────────────
    if (screen === "edit") {
      if (key.escape) {
        setScreen("list");
        return;
      }
    }
  });

  // ── ADD: advance field on Enter ───────────────────────────────────────────
  function handleFieldSubmit(value: string) {
    const field = ADD_FIELDS[addFieldIdx];
    if (!field) return;
    const updatedForm = { ...addForm, [field]: value };
    setAddForm(updatedForm);

    if (addFieldIdx < ADD_FIELDS.length - 1) {
      setAddFieldIdx((i) => i + 1);
    } else {
      // Last field submitted — parse and save the model
      const temperatureStr = updatedForm.temperature.trim();
      const maxTokensStr = updatedForm.maxTokens.trim();
      const baseUrlStr = updatedForm.baseUrl.trim();
      const modelInput: ModelInput = {
        name: updatedForm.name,
        provider: updatedForm.provider,
        modelId: updatedForm.modelId,
        apiKey: updatedForm.apiKey,
        temperature: temperatureStr !== "" ? parseFloat(temperatureStr) : null,
        maxTokens: maxTokensStr !== "" ? parseInt(maxTokensStr, 10) : null,
        baseUrl: baseUrlStr !== "" ? baseUrlStr : null,
      };
      setScreen("adding");
      addModel(modelInput)
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

  // ── EDIT: advance field on Enter ─────────────────────────────────────────
  function handleEditFieldSubmit(value: string) {
    const field = ADD_FIELDS[editFieldIdx];
    if (!field) return;
    const updatedForm = { ...editForm, [field]: value };
    setEditForm(updatedForm);

    if (editFieldIdx < ADD_FIELDS.length - 1) {
      setEditFieldIdx((i) => i + 1);
    } else {
      const temperatureStr = updatedForm.temperature.trim();
      const maxTokensStr = updatedForm.maxTokens.trim();
      const baseUrlStr = updatedForm.baseUrl.trim();
      const updateInput: ModelUpdateInput = {
        name: updatedForm.name,
        provider: updatedForm.provider,
        modelId: updatedForm.modelId,
        temperature: temperatureStr !== "" ? parseFloat(temperatureStr) : null,
        maxTokens: maxTokensStr !== "" ? parseInt(maxTokensStr, 10) : null,
        baseUrl: baseUrlStr !== "" ? baseUrlStr : null,
      };
      if (updatedForm.apiKey !== "") updateInput.apiKey = updatedForm.apiKey;
      setScreen("editing");
      updateModel(editModelId!, updateInput)
        .then(() => {
          loadModels();
          setStatusMsg("Model updated successfully.");
          setScreen("list");
        })
        .catch((e: unknown) => {
          setError(String(e));
          setScreen("edit");
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
          <Text dimColor>[↑↓] navigate  [e] edit  [d] delete  [q/Esc] back</Text>
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

      {screen === "edit" && (
        <Box flexDirection="column">
          <Text bold>Edit Model</Text>
          <Text dimColor>[Esc] cancel</Text>
          <Text> </Text>
          {ADD_FIELDS.map((field, i) => {
            const label = field === "apiKey"
              ? "New API Key (Enter to keep current)"
              : FIELD_LABELS[field];
            if (i < editFieldIdx) {
              const val = field === "apiKey"
                ? (editForm[field] ? "••••••••" : "(unchanged)")
                : editForm[field];
              return (
                <Text key={field} dimColor>
                  {label}: {val}
                </Text>
              );
            }
            if (i === editFieldIdx) {
              return (
                <Box key={field}>
                  <Text>{label}: </Text>
                  <TextInput
                    value={editForm[field]}
                    mask={field === "apiKey" ? "•" : undefined}
                    onChange={(val) => setEditForm((f) => ({ ...f, [field]: val }))}
                    onSubmit={handleEditFieldSubmit}
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
      {screen === "editing" && <Text>Updating model...</Text>}
      {screen === "deleting" && <Text>Deleting...</Text>}
    </Box>
  );
}

render(<App />);
