import { notFound } from "next/navigation";
import Link from "next/link";
import { openDatabase, computeResults } from "@llm-benchmark/core";
import type { RunResults, ModelResult, CriterionScore } from "@llm-benchmark/core";
import DetailTable from "./DetailTable";

interface Props {
  params: Promise<{ id: string; sessionId: string }>;
}

export default async function ResultsPage({ params }: Props) {
  const { id, sessionId } = await params;

  openDatabase();

  let results: RunResults;
  try {
    results = computeResults(id, sessionId);
  } catch {
    notFound();
  }

  const tdStyle: React.CSSProperties = {
    padding: "0.4rem 0.6rem",
    borderBottom: "1px solid #333",
  };

  const thStyle: React.CSSProperties = {
    padding: "0.4rem 0.6rem",
    borderBottom: "2px solid #555",
    textAlign: "left",
    whiteSpace: "nowrap",
  };

  return (
    <main style={{ fontFamily: "monospace", maxWidth: 960, margin: "2rem auto", padding: "0 1rem" }}>
      <div style={{ marginBottom: "1rem" }}>
        <Link href={`/runs/${id}`}>&larr; Back to run</Link>
      </div>

      <h1>Results</h1>

      <p style={{ color: "#888", marginBottom: "1.5rem" }}>
        Session: {sessionId}
      </p>

      {/* Prompt summary */}
      <section style={{ marginBottom: "1.5rem" }}>
        <h2>Prompt</h2>
        <pre
          style={{
            background: "#111",
            border: "1px solid #333",
            padding: "0.75rem 1rem",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            borderRadius: 4,
            margin: 0,
            color: "#eee",
          }}
        >
          {results.prompt}
        </pre>
      </section>

      {/* Ranked list */}
      <section style={{ marginBottom: "2rem" }}>
        <h2>Ranked Models</h2>

        {results.rankedModels.length === 0 && (
          <p style={{ color: "#888" }}>No scored results found for this session.</p>
        )}

        {results.rankedModels.map((model: ModelResult, index: number) => (
          <details
            key={model.modelId}
            style={{
              border: "1px solid #333",
              borderRadius: 4,
              marginBottom: "0.5rem",
              background: "#0d0d0d",
            }}
          >
            <summary
              style={{
                cursor: "pointer",
                padding: "0.6rem 1rem",
                display: "flex",
                alignItems: "center",
                gap: "1rem",
                listStyle: "none",
                userSelect: "none",
              }}
            >
              {/* Rank badge */}
              <span
                style={{
                  fontWeight: "bold",
                  fontSize: "1.1em",
                  minWidth: 28,
                  color: index === 0 ? "#ffd700" : index === 1 ? "#c0c0c0" : index === 2 ? "#cd7f32" : "#ccc",
                }}
              >
                #{index + 1}
              </span>

              {/* Model name and provider */}
              <span style={{ flex: 1 }}>
                <strong>{model.modelName}</strong>
                <span style={{ color: "#888", marginLeft: "0.5rem", fontSize: "0.9em" }}>
                  {model.provider}
                </span>
              </span>

              {/* Total score */}
              <span style={{ fontWeight: "bold", fontSize: "1.05em" }}>
                {model.totalScore.toFixed(2)}
              </span>
            </summary>

            {/* Per-criterion breakdown */}
            <div style={{ padding: "0.5rem 1rem 0.75rem", borderTop: "1px solid #222" }}>
              <table
                style={{
                  borderCollapse: "collapse",
                  fontSize: "0.88em",
                  width: "100%",
                }}
              >
                <thead>
                  <tr>
                    <th style={thStyle}>Criterion</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>Avg Raw</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>Avg Norm %</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>Weight</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>Weighted Avg</th>
                  </tr>
                </thead>
                <tbody>
                  {model.criteriaBreakdown.map((cs: CriterionScore) => (
                    <tr key={cs.criterionId}>
                      <td style={tdStyle}>{cs.criterionName}</td>
                      <td style={{ ...tdStyle, textAlign: "right" }}>
                        {cs.avgRawScore.toFixed(2)} / {cs.maxScore}
                      </td>
                      <td style={{ ...tdStyle, textAlign: "right" }}>
                        {cs.avgNormalized.toFixed(1)}%
                      </td>
                      <td style={{ ...tdStyle, textAlign: "right" }}>
                        {cs.weight}
                      </td>
                      <td style={{ ...tdStyle, textAlign: "right", fontWeight: "bold" }}>
                        {cs.weightedAvg.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        ))}
      </section>

      {/* Detail table — client component for sort/filter and export */}
      <DetailTable results={results} runId={id} sessionId={sessionId} />
    </main>
  );
}
