"use client";

import { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import { getRunsList } from "./actions";
import type { Run } from "@llm-benchmark/core";

export default function RunsPage() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    startTransition(async () => {
      try {
        setRuns(await getRunsList());
      } catch (e) {
        setError(String(e));
      }
    });
  }, []);

  return (
    <main style={{ fontFamily: "monospace", maxWidth: 720, margin: "2rem auto", padding: "0 1rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>Runs</h1>
        <Link href="/runs/new">
          <button>New Run</button>
        </Link>
      </div>

      {error && <p style={{ color: "red" }}>Error: {error}</p>}
      {isPending && <p>Loading...</p>}

      {!isPending && runs.length === 0 && <p>No runs yet. <Link href="/runs/new">Create one.</Link></p>}

      <ul style={{ listStyle: "none", padding: 0 }}>
        {runs.map((r) => (
          <li key={r.id} style={{ borderBottom: "1px solid #ccc", padding: "0.75rem 0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <Link href={`/runs/${r.id}`}>
                  <strong>{r.prompt.length > 80 ? r.prompt.slice(0, 80) + "\u2026" : r.prompt}</strong>
                </Link>
                <div style={{ color: "#666", fontSize: "0.85em" }}>
                  {new Date(r.createdAt).toLocaleString()} &mdash; {r.requestsPerModel} request(s) per model
                </div>
              </div>
              <Link href={`/runs/${r.id}`}>View</Link>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
