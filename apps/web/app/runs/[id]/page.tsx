import { notFound } from "next/navigation";
import Link from "next/link";
import { openDatabase, getRun, listScoringSessions } from "@llm-benchmark/core";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function RunDetailPage({ params }: Props) {
  const { id } = await params;
  openDatabase();

  let run;
  try {
    run = getRun(id);
  } catch {
    notFound();
  }

  const scoringSessions = listScoringSessions(id);

  return (
    <main style={{ fontFamily: "monospace", maxWidth: 900, margin: "2rem auto", padding: "0 1rem" }}>
      <div style={{ marginBottom: "1rem" }}>
        <Link href="/runs">&larr; All Runs</Link>
      </div>

      <h1>Run Detail</h1>

      <section style={{ marginBottom: "1.5rem" }}>
        <p><strong>Created:</strong> {new Date(run.createdAt).toLocaleString()}</p>
        <p><strong>Requests per model:</strong> {run.requestsPerModel}</p>
        <p><strong>Models:</strong> {run.models.map((m) => `${m.name} (${m.modelId})`).join(", ") || "\u2014"}</p>
        <p><strong>Criteria:</strong> {run.criteria.map((c) => c.name).join(", ") || "\u2014"}</p>
      </section>

      {/* Score this run */}
      <section style={{ marginBottom: "1.5rem" }}>
        <Link
          href={`/runs/${id}/score`}
          style={{
            display: "inline-block",
            padding: "0.5rem 1.25rem",
            background: "#333",
            color: "#fff",
            textDecoration: "none",
            borderRadius: 4,
            fontFamily: "monospace",
          }}
        >
          Score this run &rarr;
        </Link>
      </section>

      <section style={{ marginBottom: "1.5rem" }}>
        <h2>Prompt</h2>
        <pre style={{ background: "#f4f4f4", padding: "1rem", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
          {run.prompt}
        </pre>
      </section>

      <section style={{ marginBottom: "1.5rem" }}>
        <h2>Responses ({run.responses.length})</h2>
        {run.responses.length === 0 && <p>No responses yet.</p>}
        {run.responses.map((resp, i) => {
          const model = run.models.find((m) => m.id === resp.modelId);
          return (
            <div key={resp.id} style={{ border: "1px solid #ccc", padding: "1rem", marginBottom: "1rem", borderRadius: 4 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                <strong>Response #{i + 1} &mdash; {model?.name ?? resp.modelId}</strong>
                <span style={{ color: "#666", fontSize: "0.85em" }}>
                  {resp.latencyMs != null && `${resp.latencyMs}ms`}
                  {resp.tokensUsed != null && ` \u00b7 ${resp.tokensUsed} tokens`}
                </span>
              </div>
              {resp.errorMsg ? (
                <p style={{ color: "red" }}>Error: {resp.errorMsg}</p>
              ) : (
                <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                  {resp.content}
                </pre>
              )}
            </div>
          );
        })}
      </section>

      {/* Past scoring sessions */}
      <section>
        <h2>Scoring Sessions ({scoringSessions.length})</h2>
        {scoringSessions.length === 0 && <p>No scoring sessions yet. Use the button above to score responses.</p>}
        {scoringSessions.map((session, i) => (
          <div
            key={session.id}
            style={{ border: "1px solid #ccc", padding: "0.75rem 1rem", marginBottom: "0.75rem", borderRadius: 4 }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>
                <strong>Session #{scoringSessions.length - i}</strong>
                {" \u2014 "}
                {new Date(session.createdAt).toLocaleString()}
              </span>
              <Link
                href={`/runs/${id}/results/${session.id}`}
                style={{
                  fontFamily: "monospace",
                  fontSize: "0.9em",
                  padding: "0.3rem 0.75rem",
                  background: "#333",
                  color: "#fff",
                  textDecoration: "none",
                  borderRadius: 4,
                }}
              >
                View Results &rarr;
              </Link>
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}
