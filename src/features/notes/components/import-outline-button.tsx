"use client";

import { useRef, useState } from "react";
import type { Note } from "../types";
import { importOutline, type ImportProgress } from "../import-outline";

// Shown in the outline panel when a note has no outline yet: pick photos or
// PDFs of the printed outline and watch the points fill in live as the AI
// parses them.
export function ImportOutlineButton({
  onApply,
}: {
  onApply: (fn: (note: Note) => Note) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [progress, setProgress] = useState<ImportProgress | null>(null);

  const busy = !!progress && !progress.done;

  const start = async (files: File[]) => {
    if (!files.length) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setProgress({ points: 0, done: false, error: null });
    try {
      await importOutline(files, onApply, setProgress, controller.signal);
    } catch (err) {
      if (!controller.signal.aborted) {
        setProgress({
          points: 0,
          done: true,
          error: err instanceof Error ? err.message : "Import failed",
        });
      } else {
        setProgress(null);
      }
    }
  };

  return (
    <div className="mx-auto my-4 flex max-w-sm flex-col items-center gap-2 text-center">
      {!busy && (
        <>
          <button
            onClick={() => fileRef.current?.click()}
            className="btn-light flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-[var(--text)]"
          >
            <CameraIcon />
            Import outline from photos
          </button>
          <p className="text-xs leading-relaxed text-[var(--faint)]">
            Upload photos or a PDF of the printed outline — the points fill in
            automatically as they're read.
          </p>
        </>
      )}

      {busy && (
        <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
          <Spinner />
          <span>
            Reading outline… {progress!.points > 0 && `${progress!.points} points`}
          </span>
          <button
            onClick={() => abortRef.current?.abort()}
            className="btn-light ml-1 rounded-md px-2 py-0.5 text-xs text-[var(--text)]"
          >
            Stop
          </button>
        </div>
      )}

      {progress?.done && progress.error && (
        <p className="text-xs text-red-600">{progress.error}</p>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*,application/pdf"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          start(files);
        }}
      />
    </div>
  );
}

function CameraIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 7h3l2-2h6l2 2h3v13H4z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin text-[var(--muted)]" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path className="opacity-90" fill="currentColor" d="M12 2a10 10 0 0 1 10 10h-3a7 7 0 0 0-7-7V2z" />
    </svg>
  );
}
