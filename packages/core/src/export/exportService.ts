import type { RunResults } from "../types.js";

/** Returns a formatted JSON string of the results. */
export function exportJSON(results: RunResults): string {
  return JSON.stringify(results, null, 2);
}

/**
 * Returns a CSV string.
 * Header: Rank,Model,Provider,TotalScore,<criterion1>,<criterion2>,...
 * One row per model with rank (1-based), name, provider, total score,
 * and per-criterion weighted averages in the same column order as the header.
 */
export function exportCSV(results: RunResults): string {
  // Collect all criterion names in a stable order derived from the first ranked model.
  // If rankedModels is empty there are no criterion columns.
  const criterionNames: string[] = [];
  if (results.rankedModels.length > 0) {
    for (const cs of results.rankedModels[0].criteriaBreakdown) {
      criterionNames.push(cs.criterionName);
    }
  }

  const header = ["Rank", "Model", "Provider", "TotalScore", ...criterionNames]
    .map(csvEscape)
    .join(",");

  const rows = results.rankedModels.map((model, index) => {
    // Build a lookup of criterionName → weightedAvg for this model
    const criterionLookup = new Map<string, number>();
    for (const cs of model.criteriaBreakdown) {
      criterionLookup.set(cs.criterionName, cs.weightedAvg);
    }

    const rank = index + 1;
    const criterionCells = criterionNames.map((name) => {
      const val = criterionLookup.get(name);
      return val !== undefined ? String(val) : "";
    });

    return [
      String(rank),
      csvEscape(model.modelName),
      csvEscape(model.provider),
      String(model.totalScore),
      ...criterionCells,
    ].join(",");
  });

  return [header, ...rows].join("\n");
}

/** Escapes a CSV field — wraps in quotes if it contains comma, quote, or newline. */
function csvEscape(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Returns a minimal valid PDF buffer containing:
 * - Title: "LLM Benchmark Results"
 * - Run ID and prompt (truncated to 200 chars)
 * - Ranked model table (rank / model / score)
 * - Date generated
 *
 * Uses raw PDF syntax — no external library.
 */
export function exportPDF(results: RunResults): Buffer {
  const dateStr = new Date().toISOString().slice(0, 10);
  const promptText = results.prompt.length > 200
    ? results.prompt.slice(0, 197) + "..."
    : results.prompt;

  // Build the text lines for the content stream
  const lines: string[] = [
    "LLM Benchmark Results",
    "",
    `Run ID: ${results.runId}`,
    `Session ID: ${results.sessionId}`,
    `Date: ${dateStr}`,
    "",
    `Prompt: ${pdfSafeText(promptText)}`,
    "",
    "Rankings:",
    "---------",
  ];

  for (let i = 0; i < results.rankedModels.length; i++) {
    const model = results.rankedModels[i];
    lines.push(
      `${i + 1}. ${pdfSafeText(model.modelName)} (${pdfSafeText(model.provider)}) — Score: ${model.totalScore.toFixed(2)}`
    );
  }

  // Build BT...ET block: use Courier 10pt, position at top-left (50, 750) moving down 14pt per line
  const contentLines: string[] = ["BT", "/F1 10 Tf", "50 750 Td", "14 TL"];
  for (const line of lines) {
    // Use T* (move to next line) + Tj (show string)
    contentLines.push(`(${pdfEscapeString(line)}) Tj T*`);
  }
  contentLines.push("ET");

  const contentStream = contentLines.join("\n");
  const streamBytes = Buffer.from(contentStream, "latin1");

  // ── Build PDF objects ──────────────────────────────────────────────────────
  // Object 1: Catalog
  // Object 2: Pages
  // Object 3: Page
  // Object 4: Font
  // Object 5: Content stream

  const offsets: number[] = [];
  const parts: string[] = [];

  parts.push("%PDF-1.4\n");
  // Binary comment to mark file as binary (helps viewers recognize it)
  parts.push("%\xFF\xFF\xFF\xFF\n");

  // Object 1 — Catalog
  offsets[1] = byteLength(parts);
  parts.push(
    "1 0 obj\n" +
    "<< /Type /Catalog /Pages 2 0 R >>\n" +
    "endobj\n"
  );

  // Object 2 — Pages
  offsets[2] = byteLength(parts);
  parts.push(
    "2 0 obj\n" +
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>\n" +
    "endobj\n"
  );

  // Object 4 — Font (referenced in page resources)
  offsets[4] = byteLength(parts);
  parts.push(
    "4 0 obj\n" +
    "<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>\n" +
    "endobj\n"
  );

  // Object 5 — Content stream
  offsets[5] = byteLength(parts);
  const streamLen = streamBytes.length;
  parts.push(
    "5 0 obj\n" +
    `<< /Length ${streamLen} >>\n` +
    "stream\n"
  );
  // Build the part after the stream
  const afterStream: string[] = [];
  afterStream.push("\nendstream\n");
  afterStream.push("endobj\n");

  offsets[3] = byteLength(parts) + streamBytes.length + byteLength(afterStream);

  // Rebuild offsets properly:
  // We need correct byte offsets for the xref table.
  // Re-build sequentially with a single byte array approach.
  const pdfParts: Buffer[] = [];

  const header = Buffer.from("%PDF-1.4\n%\xFF\xFF\xFF\xFF\n", "latin1");
  pdfParts.push(header);

  const xrefOffsets: number[] = new Array(6).fill(0);
  let pos = header.length;

  // Obj 1
  xrefOffsets[1] = pos;
  const obj1 = Buffer.from(
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "latin1"
  );
  pdfParts.push(obj1);
  pos += obj1.length;

  // Obj 2
  xrefOffsets[2] = pos;
  const obj2 = Buffer.from(
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
    "latin1"
  );
  pdfParts.push(obj2);
  pos += obj2.length;

  // Obj 4 — Font
  xrefOffsets[4] = pos;
  const obj4 = Buffer.from(
    "4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>\nendobj\n",
    "latin1"
  );
  pdfParts.push(obj4);
  pos += obj4.length;

  // Obj 5 — Content stream
  xrefOffsets[5] = pos;
  const obj5Header = Buffer.from(
    `5 0 obj\n<< /Length ${streamBytes.length} >>\nstream\n`,
    "latin1"
  );
  pdfParts.push(obj5Header);
  pos += obj5Header.length;
  pdfParts.push(streamBytes);
  pos += streamBytes.length;
  const obj5Footer = Buffer.from("\nendstream\nendobj\n", "latin1");
  pdfParts.push(obj5Footer);
  pos += obj5Footer.length;

  // Obj 3 — Page
  xrefOffsets[3] = pos;
  const obj3 = Buffer.from(
    "3 0 obj\n" +
    "<< /Type /Page\n" +
    "   /Parent 2 0 R\n" +
    "   /MediaBox [0 0 612 792]\n" +
    "   /Contents 5 0 R\n" +
    "   /Resources << /Font << /F1 4 0 R >> >>\n" +
    ">>\n" +
    "endobj\n",
    "latin1"
  );
  pdfParts.push(obj3);
  pos += obj3.length;

  // xref table
  const xrefOffset = pos;
  // 6 entries (0-5): free entry 0 + objects 1-5
  const xrefLines: string[] = [
    "xref\n",
    "0 6\n",
    // Entry 0: free
    "0000000000 65535 f \n",
  ];
  for (let i = 1; i <= 5; i++) {
    xrefLines.push(xrefOffsets[i].toString().padStart(10, "0") + " 00000 n \n");
  }
  const xrefBuf = Buffer.from(xrefLines.join(""), "latin1");
  pdfParts.push(xrefBuf);

  const trailer =
    "trailer\n" +
    "<< /Size 6 /Root 1 0 R >>\n" +
    "startxref\n" +
    `${xrefOffset}\n` +
    "%%EOF\n";
  pdfParts.push(Buffer.from(trailer, "latin1"));

  return Buffer.concat(pdfParts);
}

/** Returns total byte length of an array of strings (latin1 encoding). */
function byteLength(parts: string[]): number {
  return parts.reduce((sum, p) => sum + Buffer.byteLength(p, "latin1"), 0);
}

/** Escapes a string for use inside PDF parenthesized string literals. */
function pdfEscapeString(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/\r/g, "\\r")
    .replace(/\n/g, "\\n");
}

/**
 * Replaces characters outside the printable ASCII range (32-126) with a '?'
 * so they are safe to embed in a PDF string literal using latin1 encoding.
 */
function pdfSafeText(text: string): string {
  return text.replace(/[^\x20-\x7E]/g, "?");
}
