"use client";

import { useState, useTransition } from "react";
import { downloadJSON, downloadCSV } from "./actions";
import type { RunResults } from "@llm-benchmark/core";

interface Props {
  results: RunResults;
  runId: string;
  sessionId: string;
}

type SortKey = "response" | "model" | string;
type SortDir = "asc" | "desc";

interface ResponseRow {
  responseIndex: number; // 1-based display number
  modelName: string;
  provider: string;
  // criterionId → score value (may be undefined if not scored)
  criterionScores: Record<string, number>;
}

function triggerDownload(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function DetailTable({ results, runId, sessionId }: Props) {
  const [filter, setFilter] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("response");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [isPending, startTransition] = useTransition();
  const [exportError, setExportError] = useState<string | null>(null);

  // Collect all criterion ids+names in stable order (from first ranked model)
  const criteriaColumns: { id: string; name: string }[] = [];
  if (results.rankedModels.length > 0) {
    for (const cs of results.rankedModels[0].criteriaBreakdown) {
      criteriaColumns.push({ id: cs.criterionId, name: cs.criterionName });
    }
  }

  // Build a flat list of response rows with per-criterion scores.
  // We derive criterion scores from the ranked models' criteriaBreakdown avgRawScore
  // as a per-model aggregate (since full per-response scores are not in RunResults).
  // The responses list on each ModelResult gives individual responses for a model.
  const allRows: ResponseRow[] = [];
  let responseCounter = 0;
  for (const model of results.rankedModels) {
    const criterionScores: Record<string, number> = {};
    for (const cs of model.criteriaBreakdown) {
      criterionScores[cs.criterionId] = cs.avgRawScore;
    }
    for (let r = 0; r < model.responses.length; r++) {
      responseCounter++;
      allRows.push({
        responseIndex: responseCounter,
        modelName: model.modelName,
        provider: model.provider,
        criterionScores,
      });
    }
  }

  // Apply model name filter
  const filtered = filter.trim()
    ? allRows.filter((r) =>
        r.modelName.toLowerCase().includes(filter.trim().toLowerCase())
      )
    : allRows;

  // Apply sort
  const sorted = [...filtered].sort((a, b) => {
    let cmp = 0;
    if (sortKey === "response") {
      cmp = a.responseIndex - b.responseIndex;
    } else if (sortKey === "model") {
      cmp = a.modelName.localeCompare(b.modelName);
    } else {
      // sort by criterion score
      const av = a.criterionScores[sortKey] ?? -Infinity;
      const bv = b.criterionScores[sortKey] ?? -Infinity;
      cmp = av - bv;
    }
    return sortDir === "asc" ? cmp : -cmp;
  });

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function sortIndicator(key: SortKey): string {
    if (key !== sortKey) return "";
    return sortDir === "asc" ? " \u25b2" : " \u25bc";
  }

  function handleExportJSON() {
    setExportError(null);
    startTransition(async () => {
      try {
        const json = await downloadJSON(runId, sessionId);
        triggerDownload(`results-${runId}-${sessionId}.json`, json, "application/json");
      } catch (e) {
        setExportError(String(e));
      }
    });
  }

  function handleExportCSV() {
    setExportError(null);
    startTransition(async () => {
      try {
        const csv = await downloadCSV(runId, sessionId);
        triggerDownload(`results-${runId}-${sessionId}.csv`, csv, "text/csv");
      } catch (e) {
        setExportError(String(e));
      }
    });
  }

  const thStyle: React.CSSProperties = {
    padding: "0.4rem 0.6rem",
    borderBottom: "2px solid #555",
    textAlign: "left",
    cursor: "pointer",
    userSelect: "none",
    whiteSpace: "nowrap",
  };

  const tdStyle: React.CSSProperties = {
    padding: "0.4rem 0.6rem",
    borderBottom: "1px solid #333",
  };

  return (
    <section style={{ marginTop: "2rem" }}>
      <h2>Response Detail Table</h2>

      {/* Export buttons */}
      <div style={{ display: "flex", gap: 8, marginBottom: "1rem", flexWrap: "wrap" }}>
        <button
          onClick={handleExportJSON}
          disabled={isPending}
          style={{
            fontFamily: "monospace",
            padding: "0.4rem 1rem",
            cursor: isPending ? "wait" : "pointer",
            border: "1px solid #555",
            borderRadius: 4,
            background: "#222",
            color: "#fff",
          }}
        >
          Export JSON
        </button>
        <button
          onClick={handleExportCSV}
          disabled={isPending}
          style={{
            fontFamily: "monospace",
            padding: "0.4rem 1rem",
            cursor: isPending ? "wait" : "pointer",
            border: "1px solid #555",
            borderRadius: 4,
            background: "#222",
            color: "#fff",
          }}
        >
          Export CSV
        </button>
        <a
          href={`/runs/${runId}/results/${sessionId}/pdf`}
          download={`results-${runId}-${sessionId}.pdf`}
          style={{
            fontFamily: "monospace",
            padding: "0.4rem 1rem",
            border: "1px solid #555",
            borderRadius: 4,
            background: "#222",
            color: "#fff",
            textDecoration: "none",
            display: "inline-block",
          }}
        >
          Export PDF
        </a>
      </div>

      {exportError && (
        <p style={{ color: "red", marginBottom: "1rem" }}>Export error: {exportError}</p>
      )}

      {/* Filter input */}
      <div style={{ marginBottom: "0.75rem" }}>
        <input
          type="text"
          placeholder="Filter by model name..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{
            fontFamily: "monospace",
            padding: "0.35rem 0.6rem",
            border: "1px solid #555",
            borderRadius: 4,
            background: "#111",
            color: "#fff",
            width: 260,
          }}
        />
      </div>

      {sorted.length === 0 && (
        <p style={{ color: "#888" }}>No responses match the current filter.</p>
      )}

      {sorted.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              borderCollapse: "collapse",
              fontFamily: "monospace",
              fontSize: "0.9em",
              width: "100%",
              minWidth: 400,
            }}
          >
            <thead>
              <tr>
                <th style={thStyle} onClick={() => handleSort("response")}>
                  Response #{sortIndicator("response")}
                </th>
                <th style={thStyle} onClick={() => handleSort("model")}>
                  Model{sortIndicator("model")}
                </th>
                {criteriaColumns.map((col) => (
                  <th
                    key={col.id}
                    style={thStyle}
                    onClick={() => handleSort(col.id)}
                  >
                    {col.name}{sortIndicator(col.id)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((row) => (
                <tr key={`${row.responseIndex}-${row.modelName}`}>
                  <td style={tdStyle}>{row.responseIndex}</td>
                  <td style={tdStyle}>
                    {row.modelName}
                    <span style={{ color: "#888", marginLeft: "0.4rem", fontSize: "0.85em" }}>
                      ({row.provider})
                    </span>
                  </td>
                  {criteriaColumns.map((col) => (
                    <td key={col.id} style={tdStyle}>
                      {row.criterionScores[col.id] !== undefined
                        ? row.criterionScores[col.id].toFixed(2)
                        : "\u2014"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
