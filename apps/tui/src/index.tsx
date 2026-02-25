import React, { useState, useEffect } from "react";
import { render, Box, Text, useInput, useApp } from "ink";
import TextInput from "ink-text-input";
import fs from "fs";
import {
  openDatabase,
  listModels,
  addModel,
  updateModel,
  deleteModel,
  listCriteria,
  addCriterion,
  updateCriterion,
  deleteCriterion,
  listRuns,
  createRun,
  executeRun,
  getRun,
  createScoringSession,
  scoreResponse,
  listScoringSessions,
  computeResults,
  exportJSON,
  exportCSV,
  exportPDF,
  APP_NAME,
} from "@llm-benchmark/core";
import type {
  Model,
  ModelInput,
  ModelUpdateInput,
  Criterion,
  Run,
  RunInput,
  RunWithDetails,
  Response,
  ScoringSession,
  RunResults,
} from "@llm-benchmark/core";

// ── Types ─────────────────────────────────────────────────────────────────────
type Screen =
  | "menu"
  | "list" | "add" | "adding" | "deleting" | "edit" | "editing"
  | "criteria-list" | "criteria-add" | "criteria-edit"
  | "runs-menu" | "runs-list" | "runs-new" | "runs-running" | "runs-detail"
  | "scoring-start" | "scoring-response" | "scoring-done"
  | "results-list" | "results-detail" | "results-export" | "session-picker";

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
  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [criteriaCursor, setCriteriaCursor] = useState(0);
  const [criteriaForm, setCriteriaForm] = useState<Record<CriteriaField, string>>(EMPTY_CRITERIA_FORM);
  const [criteriaFieldIdx, setCriteriaFieldIdx] = useState(0);
  const [editCriterionId, setEditCriterionId] = useState<string | null>(null);
  const [editCriterionForm, setEditCriterionForm] = useState<Record<CriteriaField, string>>(EMPTY_CRITERIA_FORM);
  const [editCriterionFieldIdx, setEditCriterionFieldIdx] = useState(0);

  // ── Runs state ───────────────────────────────────────────────────────────────
  const [runs, setRuns] = useState<Run[]>([]);
  const [runsCursor, setRunsCursor] = useState(0);
  const [selectedRunModels, setSelectedRunModels] = useState<Set<string>>(new Set());
  const [selectedRunCriteria, setSelectedRunCriteria] = useState<Set<string>>(new Set());
  const [newRunModels, setNewRunModels] = useState<Model[]>([]);
  const [newRunCriteria, setNewRunCriteria] = useState<Criterion[]>([]);
  const [newRunModelsCursor, setNewRunModelsCursor] = useState(0);
  const [newRunCriteriaCursor, setNewRunCriteriaCursor] = useState(0);
  const [newRunStep, setNewRunStep] = useState<"models" | "criteria" | "prompt" | "requests">("models");
  const [newRunPrompt, setNewRunPrompt] = useState("");
  const [newRunRequests, setNewRunRequests] = useState("1");
  const [detailRun, setDetailRun] = useState<Run | null>(null);

  // ── Scoring state ────────────────────────────────────────────────────────────
  const [scoringRun, setScoringRun] = useState<RunWithDetails | null>(null);
  const [scoringSession, setScoringSession] = useState<ScoringSession | null>(null);
  const [scoringResponses, setScoringResponses] = useState<Response[]>([]);
  const [scoringIdx, setScoringIdx] = useState(0);
  const [scoringCriterionIdx, setScoringCriterionIdx] = useState(0);
  const [scoringValue, setScoringValue] = useState("");

  // ── Results state ────────────────────────────────────────────────────────────
  const [resultsData, setResultsData] = useState<RunResults | null>(null);
  const [resultsCursor, setResultsCursor] = useState(0);
  const [resultsRunId, setResultsRunId] = useState("");
  const [resultsSessionId, setResultsSessionId] = useState("");

  // ── Session picker state (when run has multiple sessions) ─────────────────
  const [sessionPickerList, setSessionPickerList] = useState<ScoringSession[]>([]);
  const [sessionPickerCursor, setSessionPickerCursor] = useState(0);

  function loadModels() {
    try { setModels(listModels()); } catch (e) { setError(String(e)); }
  }
  function loadCriteria() {
    try { setCriteria(listCriteria()); } catch (e) { setError(String(e)); }
  }
  function loadRuns() {
    try { setRuns(listRuns()); } catch (e) { setError(String(e)); }
  }

  // Opens results-list for a given run/session.
  function openResults(runId: string, sessionId: string) {
    try {
      const data = computeResults(runId, sessionId);
      setResultsData(data);
      setResultsRunId(runId);
      setResultsSessionId(sessionId);
      setResultsCursor(0);
      setScreen("results-list");
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

    // ── MENU ──────────────────────────────────────────────────────────────────
    if (screen === "menu") {
      if (input === "1") { loadModels(); setCursor(0); setScreen("list"); }
      else if (input === "2") { setAddForm(EMPTY_MODEL_FORM); setAddFieldIdx(0); setScreen("add"); }
      else if (input === "3") { loadCriteria(); setCriteriaCursor(0); setScreen("criteria-list"); }
      else if (input === "4") { loadRuns(); setScreen("runs-menu"); }
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

    // ── CRITERIA-LIST ──────────────────────────────────────────────────────────
    if (screen === "criteria-list") {
      if (key.escape || input === "q") { setScreen("menu"); return; }
      if (key.upArrow && criteriaCursor > 0) setCriteriaCursor((c) => c - 1);
      if (key.downArrow && criteriaCursor < criteria.length - 1) setCriteriaCursor((c) => c + 1);
      if (input === "a") { setCriteriaForm(EMPTY_CRITERIA_FORM); setCriteriaFieldIdx(0); setScreen("criteria-add"); }
      if (input === "e" && criteria.length > 0) {
        const c = criteria[criteriaCursor];
        if (!c) return;
        setEditCriterionId(c.id);
        setEditCriterionForm({ name: c.name, maxScore: String(c.maxScore), weight: String(c.weight) });
        setEditCriterionFieldIdx(0);
        setScreen("criteria-edit");
      }
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

    // ── CRITERIA-EDIT ──────────────────────────────────────────────────────────
    if (screen === "criteria-edit") { if (key.escape) { setScreen("criteria-list"); return; } }

    // ── RUNS-MENU ─────────────────────────────────────────────────────────────
    if (screen === "runs-menu") {
      if (input === "1") { loadRuns(); setRunsCursor(0); setScreen("runs-list"); }
      else if (input === "2") {
        const ms = listModels();
        const cs = listCriteria();
        setNewRunModels(ms);
        setNewRunCriteria(cs);
        setSelectedRunModels(new Set());
        setSelectedRunCriteria(new Set());
        setNewRunModelsCursor(0);
        setNewRunCriteriaCursor(0);
        setNewRunStep("models");
        setNewRunPrompt("");
        setNewRunRequests("1");
        setScreen("runs-new");
      }
      else if (key.escape || input === "q") { setScreen("menu"); }
      return;
    }

    // ── RUNS-LIST ─────────────────────────────────────────────────────────────
    if (screen === "runs-list") {
      if (key.escape || input === "q") { setScreen("runs-menu"); return; }
      if (key.upArrow && runsCursor > 0) setRunsCursor((c) => c - 1);
      if (key.downArrow && runsCursor < runs.length - 1) setRunsCursor((c) => c + 1);
      if (key.return && runs.length > 0) {
        const run = runs[runsCursor];
        if (!run) return;
        setDetailRun(run);
        setScreen("runs-detail");
      }
      return;
    }

    // ── RUNS-NEW (multi-step wizard) ──────────────────────────────────────────
    if (screen === "runs-new") {
      if (key.escape) {
        if (newRunStep === "models") { setScreen("runs-menu"); }
        else if (newRunStep === "criteria") { setNewRunStep("models"); }
        else if (newRunStep === "prompt") { setNewRunStep("criteria"); }
        else if (newRunStep === "requests") { setNewRunStep("prompt"); }
        return;
      }
      if (newRunStep === "models") {
        if (key.upArrow && newRunModelsCursor > 0) setNewRunModelsCursor((c) => c - 1);
        if (key.downArrow && newRunModelsCursor < newRunModels.length - 1) setNewRunModelsCursor((c) => c + 1);
        if (input === " " && newRunModels.length > 0) {
          const id = newRunModels[newRunModelsCursor]?.id;
          if (id) {
            setSelectedRunModels((prev) => {
              const next = new Set(prev);
              if (next.has(id)) next.delete(id); else next.add(id);
              return next;
            });
          }
        }
        if (key.return) {
          if (selectedRunModels.size === 0) { setError("Select at least one model."); return; }
          setError(null);
          setNewRunStep("criteria");
        }
      } else if (newRunStep === "criteria") {
        if (key.upArrow && newRunCriteriaCursor > 0) setNewRunCriteriaCursor((c) => c - 1);
        if (key.downArrow && newRunCriteriaCursor < newRunCriteria.length - 1) setNewRunCriteriaCursor((c) => c + 1);
        if (input === " " && newRunCriteria.length > 0) {
          const id = newRunCriteria[newRunCriteriaCursor]?.id;
          if (id) {
            setSelectedRunCriteria((prev) => {
              const next = new Set(prev);
              if (next.has(id)) next.delete(id); else next.add(id);
              return next;
            });
          }
        }
        if (key.return) { setNewRunStep("prompt"); }
      }
      return;
    }

    // ── RUNS-DETAIL ───────────────────────────────────────────────────────────
    if (screen === "runs-detail") {
      if (key.escape || input === "q") { setScreen("runs-menu"); return; }
      if (input === "s" && detailRun) {
        const fullRun = getRun(detailRun.id);
        const validResponses = fullRun.responses.filter((r) => !r.errorMsg);
        if (validResponses.length === 0) {
          setError("No scoreable responses.");
          return;
        }
        if (fullRun.criteria.length === 0) {
          setError("No criteria for this run.");
          return;
        }
        // Fisher-Yates shuffle
        const arr = [...validResponses];
        for (let i = arr.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [arr[i], arr[j]] = [arr[j]!, arr[i]!];
        }
        const session = createScoringSession(fullRun.id);
        setScoringRun(fullRun);
        setScoringSession(session);
        setScoringResponses(arr);
        setScoringIdx(0);
        setScoringCriterionIdx(0);
        setScoringValue("");
        setScreen("scoring-response");
      }
      if (input === "r" && detailRun) {
        const sessions = listScoringSessions(detailRun.id);
        if (sessions.length === 0) {
          setError("No scoring sessions for this run.");
          return;
        }
        if (sessions.length === 1) {
          // Go directly to results
          openResults(detailRun.id, sessions[0]!.id);
        } else {
          // Show session picker
          setSessionPickerList(sessions);
          setSessionPickerCursor(0);
          setScreen("session-picker");
        }
      }
      return;
    }

    // ── SCORING-RESPONSE ──────────────────────────────────────────────────────
    if (screen === "scoring-response") {
      if (key.escape) { setScreen("runs-detail"); return; }
    }

    // ── SCORING-DONE ──────────────────────────────────────────────────────────
    if (screen === "scoring-done") {
      if (key.escape || input === "q") { setScreen("runs-menu"); return; }
      if (input === "r" && scoringSession && detailRun) {
        openResults(detailRun.id, scoringSession.id);
      }
    }

    // ── SESSION-PICKER ────────────────────────────────────────────────────────
    if (screen === "session-picker") {
      if (key.escape || key.leftArrow) { setScreen("runs-detail"); return; }
      if (key.upArrow && sessionPickerCursor > 0) setSessionPickerCursor((c) => c - 1);
      if (key.downArrow && sessionPickerCursor < sessionPickerList.length - 1) setSessionPickerCursor((c) => c + 1);
      if (key.return && detailRun) {
        const session = sessionPickerList[sessionPickerCursor];
        if (!session) return;
        openResults(detailRun.id, session.id);
      }
      return;
    }

    // ── RESULTS-LIST ──────────────────────────────────────────────────────────
    if (screen === "results-list") {
      if (key.escape || key.leftArrow) { setScreen("runs-detail"); return; }
      if (key.upArrow && resultsCursor > 0) setResultsCursor((c) => c - 1);
      if ((key.downArrow) && resultsData && resultsCursor < resultsData.rankedModels.length - 1) {
        setResultsCursor((c) => c + 1);
      }
      if ((key.return || key.rightArrow) && resultsData && resultsData.rankedModels.length > 0) {
        setScreen("results-detail");
      }
      if (input === "e") {
        setScreen("results-export");
      }
      return;
    }

    // ── RESULTS-DETAIL ────────────────────────────────────────────────────────
    if (screen === "results-detail") {
      if (key.escape || key.leftArrow) { setScreen("results-list"); return; }
    }

    // ── RESULTS-EXPORT ────────────────────────────────────────────────────────
    if (screen === "results-export") {
      if (key.escape) { setScreen("results-list"); return; }
      if (input === "1" && resultsData) {
        try {
          const filename = `results-${resultsRunId}-${resultsSessionId}.json`;
          fs.writeFileSync(filename, exportJSON(resultsData), "utf8");
          setStatusMsg(`Saved: ${filename}`);
          setTimeout(() => { setStatusMsg(null); setScreen("results-list"); }, 2000);
        } catch (e) {
          setError(String(e));
        }
      }
      if (input === "2" && resultsData) {
        try {
          const filename = `results-${resultsRunId}-${resultsSessionId}.csv`;
          fs.writeFileSync(filename, exportCSV(resultsData), "utf8");
          setStatusMsg(`Saved: ${filename}`);
          setTimeout(() => { setStatusMsg(null); setScreen("results-list"); }, 2000);
        } catch (e) {
          setError(String(e));
        }
      }
      if (input === "3" && resultsData) {
        try {
          const filename = `results-${resultsRunId}-${resultsSessionId}.pdf`;
          fs.writeFileSync(filename, exportPDF(resultsData));
          setStatusMsg(`Saved: ${filename}`);
          setTimeout(() => { setStatusMsg(null); setScreen("results-list"); }, 2000);
        } catch (e) {
          setError(String(e));
        }
      }
      return;
    }
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

  // ── EDIT criterion: advance field on Enter ───────────────────────────────
  function handleCriteriaEditFieldSubmit(value: string) {
    const field = CRITERIA_FIELDS[editCriterionFieldIdx];
    if (!field) return;
    const updatedForm = { ...editCriterionForm, [field]: value };
    setEditCriterionForm(updatedForm);
    if (editCriterionFieldIdx < CRITERIA_FIELDS.length - 1) {
      setEditCriterionFieldIdx((i) => i + 1);
    } else {
      const maxScoreStr = updatedForm.maxScore.trim();
      const weightStr = updatedForm.weight.trim();
      updateCriterion(editCriterionId!, {
        name: updatedForm.name || undefined,
        maxScore: maxScoreStr !== "" ? parseFloat(maxScoreStr) : undefined,
        weight: weightStr !== "" ? parseFloat(weightStr) : undefined,
      });
      loadCriteria();
      setStatusMsg("Criterion updated.");
      setScreen("criteria-list");
    }
  }

  // ── Run wizard: prompt submit ─────────────────────────────────────────────
  function handleRunPromptSubmit(value: string) {
    const trimmed = value.trim();
    if (!trimmed) { setError("Prompt cannot be empty."); return; }
    setNewRunPrompt(trimmed);
    setNewRunRequests("1");
    setNewRunStep("requests");
  }

  // ── Run wizard: requests submit ───────────────────────────────────────────
  function handleRunRequestsSubmit(value: string) {
    const n = parseInt(value, 10);
    if (!n || n < 1) { setError("Enter a number >= 1."); return; }
    setScreen("runs-running");
    const input: RunInput = {
      prompt: newRunPrompt,
      requestsPerModel: n,
      modelIds: Array.from(selectedRunModels),
      criteriaIds: Array.from(selectedRunCriteria),
    };
    const run = createRun(input);
    executeRun(run.id)
      .then(() => {
        loadRuns();
        setDetailRun(run);
        setStatusMsg("Run complete.");
        setScreen("runs-detail");
      })
      .catch((e: unknown) => {
        setError(String(e));
        setScreen("runs-new");
      });
  }

  // ── Scoring: submit score for current criterion ───────────────────────────
  function handleScoringValueSubmit(value: string) {
    if (!scoringRun || !scoringSession) return;
    const criterion = scoringRun.criteria[scoringCriterionIdx];
    const response = scoringResponses[scoringIdx];
    if (!criterion || !response) return;

    const raw = parseFloat(value);
    const clamped = isNaN(raw) ? 0 : Math.max(0, Math.min(raw, criterion.maxScore));

    scoreResponse({
      sessionId: scoringSession.id,
      responseId: response.id,
      criterionId: criterion.id,
      score: clamped,
    });

    // Advance to next criterion, or next response, or done
    if (scoringCriterionIdx + 1 < scoringRun.criteria.length) {
      setScoringCriterionIdx((i) => i + 1);
      setScoringValue("");
    } else if (scoringIdx + 1 < scoringResponses.length) {
      setScoringIdx((i) => i + 1);
      setScoringCriterionIdx(0);
      setScoringValue("");
    } else {
      setStatusMsg(`Scored ${scoringResponses.length} response(s).`);
      setScreen("scoring-done");
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
          <Text>[4] Runs</Text>
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
          <Text dimColor>[↑↓] navigate  [a] add  [e] edit  [d] delete  [q/Esc] back</Text>
        </Box>
      )}

      {/* ── EDIT CRITERION ── */}
      {screen === "criteria-edit" && (
        <Box flexDirection="column">
          <Text bold>Edit Criterion</Text>
          <Text dimColor>[Esc] cancel</Text>
          <Text> </Text>
          {renderFieldForm(CRITERIA_FIELDS, CRITERIA_LABELS, editCriterionForm, editCriterionFieldIdx, setEditCriterionForm, handleCriteriaEditFieldSubmit)}
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

      {/* ── RUNS MENU ── */}
      {screen === "runs-menu" && (
        <Box flexDirection="column">
          <Text bold>Runs</Text>
          <Text>[1] List runs</Text>
          <Text>[2] New run</Text>
          <Text>[q/Esc] back</Text>
        </Box>
      )}

      {/* ── RUNS LIST ── */}
      {screen === "runs-list" && (
        <Box flexDirection="column">
          <Text bold>Runs ({runs.length})</Text>
          {runs.length === 0 && <Text dimColor>No runs yet.</Text>}
          {runs.map((r, i) => (
            <Text key={r.id} color={i === runsCursor ? "yellow" : undefined}>
              {i === runsCursor ? "▶ " : "  "}
              {r.prompt.length > 60 ? r.prompt.slice(0, 60) + "…" : r.prompt}
              <Text dimColor> ({r.requestsPerModel}req)</Text>
            </Text>
          ))}
          <Text> </Text>
          <Text dimColor>[↑↓] navigate  [Enter] open  [q/Esc] back</Text>
        </Box>
      )}

      {/* ── RUNS NEW (wizard) ── */}
      {screen === "runs-new" && (
        <Box flexDirection="column">
          <Text bold>New Run</Text>
          <Text dimColor>[Esc] back  [Space] toggle  [Enter] next</Text>
          <Text> </Text>
          {newRunStep === "models" && (
            <Box flexDirection="column">
              <Text bold>Step 1/4: Select models</Text>
              {newRunModels.length === 0 && <Text dimColor>No models configured.</Text>}
              {newRunModels.map((m, i) => (
                <Text key={m.id} color={i === newRunModelsCursor ? "yellow" : undefined}>
                  {selectedRunModels.has(m.id) ? "[x] " : "[ ] "}
                  {i === newRunModelsCursor ? "▶ " : "  "}
                  {m.name} — {m.provider}/{m.modelId}
                </Text>
              ))}
            </Box>
          )}
          {newRunStep === "criteria" && (
            <Box flexDirection="column">
              <Text bold>Step 2/4: Select criteria (optional)</Text>
              {newRunCriteria.length === 0 && <Text dimColor>No criteria configured.</Text>}
              {newRunCriteria.map((c, i) => (
                <Text key={c.id} color={i === newRunCriteriaCursor ? "yellow" : undefined}>
                  {selectedRunCriteria.has(c.id) ? "[x] " : "[ ] "}
                  {i === newRunCriteriaCursor ? "▶ " : "  "}
                  {c.name}
                </Text>
              ))}
              <Text dimColor>[Enter] to continue (criteria are optional)</Text>
            </Box>
          )}
          {newRunStep === "prompt" && (
            <Box flexDirection="column">
              <Text bold>Step 3/4: Enter prompt</Text>
              <Box>
                <Text>Prompt: </Text>
                <TextInput value={newRunPrompt} onChange={setNewRunPrompt} onSubmit={handleRunPromptSubmit} />
              </Box>
            </Box>
          )}
          {newRunStep === "requests" && (
            <Box flexDirection="column">
              <Text bold>Step 4/4: Requests per model</Text>
              <Box>
                <Text>Requests per model: </Text>
                <TextInput value={newRunRequests} onChange={setNewRunRequests} onSubmit={handleRunRequestsSubmit} />
              </Box>
            </Box>
          )}
        </Box>
      )}

      {/* ── RUNS RUNNING ── */}
      {screen === "runs-running" && <Text>Running... (this may take a moment)</Text>}

      {/* ── RUNS DETAIL ── */}
      {screen === "runs-detail" && detailRun && (
        <Box flexDirection="column">
          <Text bold>Run Detail</Text>
          <Text>Prompt: {detailRun.prompt.length > 60 ? detailRun.prompt.slice(0, 60) + "…" : detailRun.prompt}</Text>
          <Text dimColor>[s] score  [r] view results  [q/Esc] back</Text>
        </Box>
      )}

      {/* ── SCORING RESPONSE ── */}
      {screen === "scoring-response" && scoringRun && (
        <Box flexDirection="column">
          <Text bold>Scoring — Response {(scoringIdx + 1)} of {scoringResponses.length}</Text>
          <Text dimColor>[Esc] cancel</Text>
          <Text> </Text>
          <Text bold>Response content:</Text>
          <Box borderStyle="single" paddingX={1}>
            <Text wrap="wrap">
              {(scoringResponses[scoringIdx]?.content ?? "").slice(0, 500)}
              {(scoringResponses[scoringIdx]?.content ?? "").length > 500 ? "…" : ""}
            </Text>
          </Box>
          <Text> </Text>
          {scoringRun.criteria[scoringCriterionIdx] && (
            <Box>
              <Text>
                Criterion {scoringCriterionIdx + 1}/{scoringRun.criteria.length}:{" "}
                <Text bold>{scoringRun.criteria[scoringCriterionIdx]!.name}</Text>
                <Text dimColor> (0–{scoringRun.criteria[scoringCriterionIdx]!.maxScore})</Text>
                {" — "}
              </Text>
              <TextInput
                value={scoringValue}
                onChange={setScoringValue}
                onSubmit={handleScoringValueSubmit}
              />
            </Box>
          )}
        </Box>
      )}

      {/* ── SCORING DONE ── */}
      {screen === "scoring-done" && (
        <Box flexDirection="column">
          <Text bold color="green">Scoring complete!</Text>
          <Text dimColor>[r] view results  [Esc] back</Text>
        </Box>
      )}

      {/* ── SESSION PICKER ── */}
      {screen === "session-picker" && (
        <Box flexDirection="column">
          <Text bold>Select Scoring Session</Text>
          <Text dimColor>[↑↓] navigate  [Enter] select  [Esc/←] back</Text>
          <Text> </Text>
          {sessionPickerList.map((s, i) => (
            <Text key={s.id} color={i === sessionPickerCursor ? "yellow" : undefined}>
              {i === sessionPickerCursor ? "▶ " : "  "}
              Session {i + 1} — {new Date(s.createdAt).toLocaleString()}
            </Text>
          ))}
        </Box>
      )}

      {/* ── RESULTS LIST ── */}
      {screen === "results-list" && resultsData && (
        <Box flexDirection="column">
          <Text bold>Results</Text>
          <Text dimColor>
            Prompt: {resultsData.prompt.length > 60 ? resultsData.prompt.slice(0, 60) + "…" : resultsData.prompt}
          </Text>
          <Text> </Text>
          {resultsData.rankedModels.length === 0 && <Text dimColor>No results available.</Text>}
          {resultsData.rankedModels.map((m, i) => (
            <Text key={m.modelId} color={i === resultsCursor ? "yellow" : undefined}>
              {i === resultsCursor ? "▶ " : "  "}
              #{i + 1} {m.modelName} ({m.provider})  ·  Score: {m.totalScore.toFixed(2)}
            </Text>
          ))}
          <Text> </Text>
          <Text dimColor>[↑↓] navigate  [Enter/→] breakdown  [e] export  [Esc/←] back</Text>
        </Box>
      )}

      {/* ── RESULTS DETAIL ── */}
      {screen === "results-detail" && resultsData && (() => {
        const model = resultsData.rankedModels[resultsCursor];
        if (!model) return <Text color="red">No model selected.</Text>;
        // Column widths for table alignment
        const colCriterion = 16;
        const colRaw = 10;
        const colNorm = 8;
        const colWeight = 8;
        const colWeighted = 10;
        const pad = (s: string, n: number) => s.padEnd(n);
        const header =
          pad("Criterion", colCriterion) +
          pad("Raw", colRaw) +
          pad("Norm%", colNorm) +
          pad("Weight", colWeight) +
          "Weighted";
        const separator = "─".repeat(colCriterion + colRaw + colNorm + colWeight + colWeighted);
        return (
          <Box flexDirection="column">
            <Text bold>{model.modelName} ({model.provider})</Text>
            <Text dimColor>Total score: {model.totalScore.toFixed(2)}</Text>
            <Text> </Text>
            <Text>{header}</Text>
            <Text dimColor>{separator}</Text>
            {model.criteriaBreakdown.map((cs) => {
              const raw = `${cs.avgRawScore.toFixed(1)}/${cs.maxScore}`;
              const norm = `${cs.avgNormalized.toFixed(1)}%`;
              const weight = `×${cs.weight.toFixed(1)}`;
              const weighted = cs.weightedAvg.toFixed(2);
              return (
                <Text key={cs.criterionId}>
                  {pad(cs.criterionName.slice(0, colCriterion - 1), colCriterion)}
                  {pad(raw, colRaw)}
                  {pad(norm, colNorm)}
                  {pad(weight, colWeight)}
                  {weighted}
                </Text>
              );
            })}
            <Text dimColor>{separator}</Text>
            <Text>
              {pad("Total", colCriterion + colRaw + colNorm + colWeight)}
              {model.totalScore.toFixed(2)}
            </Text>
            <Text> </Text>
            <Text dimColor>[Esc/←] back to results list</Text>
          </Box>
        );
      })()}

      {/* ── RESULTS EXPORT ── */}
      {screen === "results-export" && (
        <Box flexDirection="column">
          <Text bold>Export Results</Text>
          <Text>[1] Export JSON</Text>
          <Text>[2] Export CSV</Text>
          <Text>[3] Export PDF</Text>
          <Text>[Esc] Back</Text>
        </Box>
      )}

      {screen === "adding" && <Text>Saving model...</Text>}
      {screen === "editing" && <Text>Updating model...</Text>}
      {screen === "deleting" && <Text>Deleting...</Text>}
    </Box>
  );
}

render(<App />);
