import { NextResponse } from "next/server";
import { openDatabase, computeResults, exportPDF } from "@llm-benchmark/core";

interface RouteParams {
  params: Promise<{ id: string; sessionId: string }>;
}

export async function GET(_request: Request, { params }: RouteParams): Promise<NextResponse> {
  const { id, sessionId } = await params;

  openDatabase();

  let pdfBuffer: Buffer;
  try {
    const results = computeResults(id, sessionId);
    pdfBuffer = exportPDF(results);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new NextResponse(message, { status: 404 });
  }

  // Slice to get a clean ArrayBuffer (Buffer may share the underlying ArrayBuffer with offset)
  const arrayBuffer = pdfBuffer.buffer.slice(
    pdfBuffer.byteOffset,
    pdfBuffer.byteOffset + pdfBuffer.byteLength
  );

  return new NextResponse(arrayBuffer as ArrayBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="results-${id}-${sessionId}.pdf"`,
    },
  });
}
