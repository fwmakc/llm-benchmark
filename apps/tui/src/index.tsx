import React, { useState, useEffect } from "react";
import { render, Box, Text, useInput, useApp } from "ink";
import TextInput from "ink-text-input";
import {
  openDatabase,
  listModels,
  addModel,
  updateModel,
  deleteModel,
  listCriteriaSets,
  addCriteriaSet,
  deleteCriteriaSet,
  listCriteria,
  addCriterion,
  deleteCriterion,
  APP_NAME,
} from "@llm-benchmark/core";
import type { Model, ModelInput, ModelUpdateInput, CriteriaSet, Criterion } from "@llm-benchmark/core";

// ── Types ─────────────────────────────────────────────────────────────────────
type Screen =
  | "menu"
  | "list" | "add" | "adding" | "deleting" | "edit" | "editing"
  | "criteria-menu"
  | "sets-list" | "sets-add"
  | "criteria-list" | "criteria-add";

type ModelField = "name" | "provider" | "modelId" | "apiKey" | "temperature" | "maxTokens" | "baseUrl";
type CriteriaField = "name" | "maxScore" | "weight";

const MODEL_FIELDS: ModelField[] = ["name", "provider", "modelId", "apiKey", "temperature", "maxTokens", "baseUrl"];
const MODEL_LABELS: Record<ModelField, string> = {
  name: "Display name",
  provider: "Provider (e.g. anthropic, openai)",
  modelId: "Model ID (e.g. claude-opus-4-6)",
  apiKey: "API Key (hidden)",
  temperature: "Temperature (optional, e.g. 0.7 — Enter to skip)",
  maxTokens: "Max tokens (optional, e.g. 4096 — Enter to skip)",
  baseUrl: "Base URL (optional, for self-hosted — Enter to skip)",
};
const EMPTY_MODEL_FORM: Record<ModelField, string> = {
  name: "", provider: "", modelId: "", apiKey: "", temperature: "", maxTokens: "", baseUrl: "",
};

const CRITERIA_FIELDS: CriteriaField[] = ["name", "maxScore", "weight"];
const CRITERIA_LABELS: Record<CriteriaField, string> = {
  name: "Criterion name",
  maxScore: "Max score (default 10 — Enter to skip)",
  weight: "Weight (default 1 — Enter to skip)",
};
const EMPTY_CRITERIA_FORM: Record<CriteriaField, string> = { name: "", maxScore: "", weight: "" };

// ── Main App ──────────────────────────────────────────────────────────────────
function App() {
  const { exit } = useApp();
  const [screen, setScreen] = useState<Screen>("menu");
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ── Models state ────────────────────────────────────────────────────────────
  const [models, setModels] = useState<Model[]>([]);
  const [cursor, setCursor] = useState(0);
  const [addForm, setAddForm] = useState<Record<ModelField, string>>(EMPTY_MODEL_FORM);
  const [addFieldIdx, setAddFieldIdx] = useState(0);
  const [editModelId, setEditModelId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Record<ModelField, string>>(EMPTY_MODEL_FORM);
  const [editFieldIdx, setEditFieldIdx] = useState(0);

  // ── Criteria state ──────────────────────────────────────────────────────────
  const [sets, setSets] = useState<CriteriaSet[]>([]);
  const [setsCursor, setSetsCursor] = useState(0);
  const [setName, setSetName] = useState("");
  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [criteriaCursor, setCriteriaCursor] = useState(0);
  const [criteriaForm, setCriteriaForm] = useState<Record<CriteriaField, string>>(EMPTY_CRITERIA_FORM);
  const [criteriaFieldIdx, setCriteriaFieldIdx] = useState(0);

  function loadModels() {
    try { setModels(listModels()); } catch (e) { setError(String(e)); }
  }
  function loadSets() {
    try { setSets(listCriteriaSets()); } catch (e) { setError(String(e)); }
  }
  function loadCriteria() {
    try { setCriteria(listCriteria()); } catch (e) { setError(String(e)); }
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

    // ── MENU ──────────────────────────────────────────────────────────────────
    if (screen === "menu") {
      if (input === "1") { loadModels(); setCursor(0); setScreen("list"); }
      else if (input === "2") { setAddForm(EMPTY_MODEL_FORM); setAddFieldIdx(0); setScreen("add"); }
      else if (input === "3") { loadSets(); loadCriteria(); setScreen("criteria-menu"); }
      else if (input === "q" || key.escape) { exit(); }
      return;
    }

    // ── LIST (models) ──────────────────────────────────────────────────────────
    if (screen === "list") {
      if (key.escape || input === "q") { setScreen("menu"); return; }
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

    // ── ADD / EDIT (models) ────────────────────────────────────────────────────
    if (screen === "add") { if (key.escape) { setScreen("menu"); return; } }
    if (screen === "edit") { if (key.escape) { setScreen("list"); return; } }

    // ── CRITERIA-MENU ──────────────────────────────────────────────────────────
    if (screen === "criteria-menu") {
      if (input === "1") { loadSets(); setSetsCursor(0); setScreen("sets-list"); }
      else if (input === "2") { loadCriteria(); setCriteriaCursor(0); setScreen("criteria-list"); }
      else if (key.escape || input === "q") { setScreen("menu"); }
      return;
    }

    // ── SETS-LIST ──────────────────────────────────────────────────────────────
    if (screen === "sets-list") {
      if (key.escape || input === "q") { setScreen("criteria-menu"); return; }
      if (key.upArrow && setsCursor > 0) setSetsCursor((c) => c - 1);
      if (key.downArrow && setsCursor < sets.length - 1) setSetsCursor((c) => c + 1);
      if (input === "a") { setSetName(""); setScreen("sets-add"); }
      if (input === "d" && sets.length > 0) {
        const id = sets[setsCursor]?.id;
        if (!id) return;
        deleteCriteriaSet(id);
        loadSets();
        setSetsCursor((c) => Math.max(0, c - 1));
        setStatusMsg("Set deleted.");
      }
      return;
    }

    // ── SETS-ADD ───────────────────────────────────────────────────────────────
    if (screen === "sets-add") { if (key.escape) { setScreen("sets-list"); return; } }

    // ── CRITERIA-LIST ──────────────────────────────────────────────────────────
    if (screen === "criteria-list") {
      if (key.escape || input === "q") { setScreen("criteria-menu"); return; }
      if (key.upArrow && criteriaCursor > 0) setCriteriaCursor((c) => c - 1);
      if (key.downArrow && criteriaCursor < criteria.length - 1) setCriteriaCursor((c) => c + 1);
      if (input === "a") { setCriteriaForm(EMPTY_CRITERIA_FORM); setCriteriaFieldIdx(0); setScreen("criteria-add"); }
      if (input === "d" && criteria.length > 0) {
        const id = criteria[criteriaCursor]?.id;
        if (!id) return;
        deleteCriterion(id);
        loadCriteria();
        setCriteriaCursor((c) => Math.max(0, c - 1));
        setStatusMsg("Criterion deleted.");
      }
      return;
    }

    // ── CRITERIA-ADD ───────────────────────────────────────────────────────────
    if (screen === "criteria-add") { if (key.escape) { setScreen("criteria-list"); return; } }
  });

  // ── ADD model: advance field on Enter ─────────────────────────────────────
  function handleFieldSubmit(value: string) {
    const field = MODEL_FIELDS[addFieldIdx];
    if (!field) return;
    const updatedForm = { ...addForm, [field]: value };
    setAddForm(updatedForm);
    if (addFieldIdx < MODEL_FIELDS.length - 1) {
      setAddFieldIdx((i) => i + 1);
    } else {
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
        .then(() => { loadModels(); setStatusMsg("Model added."); setScreen("list"); })
        .catch((e: unknown) => { setError(String(e)); setScreen("add"); });
    }
  }

  // ── EDIT model: advance field on Enter ────────────────────────────────────
  function handleEditFieldSubmit(value: string) {
    const field = MODEL_FIELDS[editFieldIdx];
    if (!field) return;
    const updatedForm = { ...editForm, [field]: value };
    setEditForm(updatedForm);
    if (editFieldIdx < MODEL_FIELDS.length - 1) {
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
        .then(() => { loadModels(); setStatusMsg("Model updated."); setScreen("list"); })
        .catch((e: unknown) => { setError(String(e)); setScreen("edit"); });
    }
  }

  // ── ADD set: single field submit ──────────────────────────────────────────
  function handleSetNameSubmit(value: string) {
    const trimmed = value.trim();
    if (!trimmed) { setScreen("sets-list"); return; }
    addCriteriaSet(trimmed);
    loadSets();
    setStatusMsg("Set added.");
    setScreen("sets-list");
  }

  // ── ADD criterion: advance field on Enter ─────────────────────────────────
  function handleCriteriaFieldSubmit(value: string) {
    const field = CRITERIA_FIELDS[criteriaFieldIdx];
    if (!field) return;
    const updatedForm = { ...criteriaForm, [field]: value };
    setCriteriaForm(updatedForm);
    if (criteriaFieldIdx < CRITERIA_FIELDS.length - 1) {
      setCriteriaFieldIdx((i) => i + 1);
    } else {
      const maxScoreStr = updatedForm.maxScore.trim();
      const weightStr = updatedForm.weight.trim();
      addCriterion({
        name: updatedForm.name,
        maxScore: maxScoreStr !== "" ? parseFloat(maxScoreStr) : 10,
        weight: weightStr !== "" ? parseFloat(weightStr) : 1,
      });
      loadCriteria();
      setStatusMsg("Criterion added.");
      setScreen("criteria-list");
    }
  }

  // ── Render helpers ────────────────────────────────────────────────────────
  function renderFieldForm<F extends string>(
    fields: F[],
    labels: Record<F, string>,
    form: Record<F, string>,
    fieldIdx: number,
    setForm: React.Dispatch<React.SetStateAction<Record<F, string>>>,
    onSubmit: (value: string) => void,
    maskField?: F,
  ) {
    return fields.map((field, i) => {
      const label = field === maskField ? `${labels[field]} (Enter to keep current)` : labels[field];
      if (i < fieldIdx) {
        const val = field === maskField ? (form[field] ? "••••••••" : "(unchanged)") : form[field];
        return <Text key={field} dimColor>{label}: {val}</Text>;
      }
      if (i === fieldIdx) {
        return (
          <Box key={field}>
            <Text>{label}: </Text>
            <TextInput
              value={form[field]}
              mask={field === maskField ? "•" : undefined}
              onChange={(val) => setForm((f) => ({ ...f, [field]: val }))}
              onSubmit={onSubmit}
            />
          </Box>
        );
      }
      return <Text key={field} dimColor>{label}: </Text>;
    });
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color="cyan">{APP_NAME}</Text>
      <Text> </Text>

      {error && <Text color="red">Error: {error}</Text>}
      {statusMsg && <Text color="green">{statusMsg}</Text>}

      {/* ── MENU ── */}
      {screen === "menu" && (
        <Box flexDirection="column">
          <Text>[1] Models</Text>
          <Text>[2] Add model</Text>
          <Text>[3] Criteria</Text>
          <Text>[q] Quit</Text>
        </Box>
      )}

      {/* ── MODEL LIST ── */}
      {screen === "list" && (
        <Box flexDirection="column">
          <Text bold>Models ({models.length})</Text>
          {models.length === 0 && <Text dimColor>No models yet.</Text>}
          {models.map((m, i) => (
            <Text key={m.id} color={i === cursor ? "yellow" : undefined}>
              {i === cursor ? "▶ " : "  "}{m.name} — {m.provider} / {m.modelId}
            </Text>
          ))}
          <Text> </Text>
          <Text dimColor>[↑↓] navigate  [e] edit  [d] delete  [q/Esc] back</Text>
        </Box>
      )}

      {/* ── ADD MODEL ── */}
      {screen === "add" && (
        <Box flexDirection="column">
          <Text bold>Add Model</Text>
          <Text dimColor>[Esc] cancel</Text>
          <Text> </Text>
          {renderFieldForm(MODEL_FIELDS, MODEL_LABELS, addForm, addFieldIdx, setAddForm, handleFieldSubmit, "apiKey")}
        </Box>
      )}

      {/* ── EDIT MODEL ── */}
      {screen === "edit" && (
        <Box flexDirection="column">
          <Text bold>Edit Model</Text>
          <Text dimColor>[Esc] cancel</Text>
          <Text> </Text>
          {renderFieldForm(MODEL_FIELDS, MODEL_LABELS, editForm, editFieldIdx, setEditForm, handleEditFieldSubmit, "apiKey")}
        </Box>
      )}

      {/* ── CRITERIA MENU ── */}
      {screen === "criteria-menu" && (
        <Box flexDirection="column">
          <Text bold>Criteria</Text>
          <Text>[1] Manage sets</Text>
          <Text>[2] Manage criteria</Text>
          <Text>[q/Esc] back</Text>
        </Box>
      )}

      {/* ── SETS LIST ── */}
      {screen === "sets-list" && (
        <Box flexDirection="column">
          <Text bold>Criteria Sets ({sets.length})</Text>
          {sets.length === 0 && <Text dimColor>No sets yet.</Text>}
          {sets.map((s, i) => (
            <Text key={s.id} color={i === setsCursor ? "yellow" : undefined}>
              {i === setsCursor ? "▶ " : "  "}{s.name}
            </Text>
          ))}
          <Text> </Text>
          <Text dimColor>[↑↓] navigate  [a] add  [d] delete  [q/Esc] back</Text>
        </Box>
      )}

      {/* ── ADD SET ── */}
      {screen === "sets-add" && (
        <Box flexDirection="column">
          <Text bold>Add Criteria Set</Text>
          <Text dimColor>[Esc] cancel</Text>
          <Text> </Text>
          <Box>
            <Text>Set name: </Text>
            <TextInput value={setName} onChange={setSetName} onSubmit={handleSetNameSubmit} />
          </Box>
        </Box>
      )}

      {/* ── CRITERIA LIST ── */}
      {screen === "criteria-list" && (
        <Box flexDirection="column">
          <Text bold>Criteria ({criteria.length})</Text>
          {criteria.length === 0 && <Text dimColor>No criteria yet.</Text>}
          {criteria.map((c, i) => (
            <Text key={c.id} color={i === criteriaCursor ? "yellow" : undefined}>
              {i === criteriaCursor ? "▶ " : "  "}{c.name}
              <Text dimColor> max={c.maxScore} w={c.weight}</Text>
            </Text>
          ))}
          <Text> </Text>
          <Text dimColor>[↑↓] navigate  [a] add  [d] delete  [q/Esc] back</Text>
        </Box>
      )}

      {/* ── ADD CRITERION ── */}
      {screen === "criteria-add" && (
        <Box flexDirection="column">
          <Text bold>Add Criterion</Text>
          <Text dimColor>[Esc] cancel</Text>
          <Text> </Text>
          {renderFieldForm(CRITERIA_FIELDS, CRITERIA_LABELS, criteriaForm, criteriaFieldIdx, setCriteriaForm, handleCriteriaFieldSubmit)}
        </Box>
      )}

      {screen === "adding" && <Text>Saving model...</Text>}
      {screen === "editing" && <Text>Updating model...</Text>}
      {screen === "deleting" && <Text>Deleting...</Text>}
    </Box>
  );
}

render(<App />);
