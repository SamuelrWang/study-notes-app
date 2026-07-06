"use client";

import type { Note, OutlinePoint } from "./types";
import { newPoint } from "./outline";
import { expandLabel, parseEditedText, splitCompoundRef } from "./refs";
import { getSupabase } from "@/lib/supabase-client";

// Client half of the outline import: prepare uploaded files, stream the
// parsed outline from /api/import-outline, and apply it to the note line by
// line so points appear in real time.

export type ImportProgress = {
  points: number;
  done: boolean;
  error: string | null;
};

// Images are downscaled client-side: Claude reads up to ~2576px on the long
// edge, and smaller uploads keep the request under API size limits.
const MAX_EDGE = 2000;

async function imageToJpegBase64(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
  return dataUrl.slice(dataUrl.indexOf(",") + 1);
}

const fileToBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve((r.result as string).split(",")[1]);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });

export async function prepareFiles(files: File[]) {
  return Promise.all(
    files.map(async (f) =>
      f.type === "application/pdf"
        ? { kind: "pdf" as const, media_type: f.type, data: await fileToBase64(f) }
        : { kind: "image" as const, media_type: "image/jpeg", data: await imageToJpegBase64(f) },
    ),
  );
}

// Append a point at the given depth: walk the last-child chain, creating
// implicit parents if the outline skips a level (defensive — shouldn't happen
// with well-formed output).
function appendAtDepth(outline: OutlinePoint[], depth: number, point: OutlinePoint): OutlinePoint[] {
  const root = structuredClone(outline);
  let siblings = root;
  for (let d = 0; d < depth; d++) {
    if (siblings.length === 0) siblings.push(newPoint());
    siblings = siblings[siblings.length - 1].children;
  }
  siblings.push(point);
  return root;
}

// One NDJSON record from the model.
type ImportRecord =
  | { kind: "meta"; number?: string; title?: string; scriptureReading?: string }
  | { kind: "point"; depth: number; text: string }
  | { kind: "error"; message: string };

// Apply one NDJSON line to the note. Off-protocol/partial lines are ignored.
export function applyImportLine(
  line: string,
  onApply: (fn: (note: Note) => Note) => void,
): { error?: string; point?: boolean } {
  const trimmed = line.trim();
  if (!trimmed.startsWith("{")) return {};

  let record: ImportRecord;
  try {
    record = JSON.parse(trimmed) as ImportRecord;
  } catch {
    return {}; // partial or malformed line — skip
  }

  if (record.kind === "error") return { error: record.message };

  if (record.kind === "meta") {
    const { title, number, scriptureReading } = record;
    onApply((n) => {
      let next = n;
      if (title && (!n.title || n.title === "Untitled")) next = { ...next, title };
      if (number && !n.number) next = { ...next, number };
      if (scriptureReading) {
        const parts = splitCompoundRef(scriptureReading)
          .filter(Boolean)
          .map((label) => ({ label, verses: expandLabel(label) }));
        next = { ...next, scriptureReading, scriptureParts: parts };
      }
      return next;
    });
    return {};
  }

  if (record.kind === "point" && typeof record.text === "string") {
    const depth = Math.max(0, Math.min(Number(record.depth) || 0, 5));
    const { textParts, refs } = parseEditedText(record.text, []); // verse text fills from the bank
    const point: OutlinePoint = {
      ...newPoint(),
      text: textParts.map((p) => (typeof p === "string" ? p : "")).join(""),
      textParts,
      refs,
    };
    onApply((n) => ({ ...n, outline: appendAtDepth(n.outline, depth, point) }));
    return { point: true };
  }

  return {};
}

// Run the whole import: upload, stream, apply line by line.
export async function importOutline(
  files: File[],
  onApply: (fn: (note: Note) => Note) => void,
  onProgress: (p: ImportProgress) => void,
  signal: AbortSignal,
): Promise<void> {
  // The import runs through a Supabase Edge Function that holds the shared
  // Anthropic key server-side; the user's sign-in token gates access.
  const { data } = await getSupabase().auth.getSession();
  const token = data.session?.access_token;
  if (!token) {
    onProgress({ points: 0, done: true, error: "Sign in (and be online) to import outlines." });
    return;
  }

  const prepared = await prepareFiles(files);
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/import-outline`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ files: prepared }),
      signal,
    },
  );

  if (!res.ok || !res.body) {
    const msg = (await res.json().catch(() => null))?.error ?? `Import failed (${res.status})`;
    onProgress({ points: 0, done: true, error: msg });
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let points = 0;
  let error: string | null = null;

  const consume = (line: string) => {
    const result = applyImportLine(line, onApply);
    if (result.error) error = result.error;
    if (result.point) points++;
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl;
    while ((nl = buffer.indexOf("\n")) >= 0) {
      consume(buffer.slice(0, nl));
      buffer = buffer.slice(nl + 1);
      onProgress({ points, done: false, error });
    }
  }
  consume(buffer); // trailing line without newline
  onProgress({ points, done: true, error });
}
