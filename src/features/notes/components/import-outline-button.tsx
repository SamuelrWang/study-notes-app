"use client";

import { useRef, useState } from "react";
import type { Note } from "../types";
import { importOutline, type ImportProgress } from "../import-outline";

// Human-readable file size, e.g. "1.2 MB".
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(kb < 10 ? 1 : 0)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

// Shown in the outline panel when a note has no outline yet: stage photos or
// PDFs of the printed outline, then import them all at once and watch the
// points fill in live as the AI parses them.
export function ImportOutlineButton({
  onApply,
}: {
  onApply: (fn: (note: Note) => Note) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  // Files chosen but not yet imported. Selecting files only stages them.
  const [staged, setStaged] = useState<File[]>([]);

  const busy = !!progress && !progress.done;

  // Append newly picked files, de-duping by name + size so re-picking the same
  // file (or clicking "Add more" twice) doesn't stack duplicates.
  const addFiles = (files: File[]) => {
    setStaged((cur) => {
      const seen = new Set(cur.map((f) => `${f.name}:${f.size}`));
      const next = [...cur];
      for (const f of files) {
        const key = `${f.name}:${f.size}`;
        if (!seen.has(key)) {
          seen.add(key);
          next.push(f);
        }
      }
      return next;
    });
  };

  const removeAt = (i: number) => setStaged((cur) => cur.filter((_, idx) => idx !== i));
  const clearStaged = () => setStaged([]);

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
    <div className="mx-auto my-4 flex w-full max-w-sm flex-col items-center gap-2 text-center">
      {!busy && staged.length === 0 && (
        <>
          <button
            onClick={() => fileRef.current?.click()}
            className="btn-light flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-[var(--text)]"
          >
            <CameraIcon />
            Import outline from photos
          </button>
          <p className="text-xs leading-relaxed text-[var(--faint)]">
            Choose photos or a PDF of the printed outline — review the list, then
            import and the points fill in automatically as they're read.
          </p>
        </>
      )}

      {!busy && staged.length > 0 && (
        <div className="w-full rounded-lg border border-[var(--border-soft)] bg-[var(--inset)] p-3 text-left">
          <ul className="flex flex-col gap-1">
            {staged.map((f, i) => (
              <li
                key={`${f.name}:${f.size}:${i}`}
                className="flex items-center gap-2 text-sm text-[var(--text)]"
              >
                <span className="min-w-0 flex-1 truncate">{f.name}</span>
                <span className="shrink-0 text-xs text-[var(--faint)]">
                  {formatSize(f.size)}
                </span>
                <button
                  onClick={() => removeAt(i)}
                  aria-label={`Remove ${f.name}`}
                  title="Remove"
                  className="shrink-0 rounded p-0.5 text-[var(--faint)] transition-colors hover:text-[var(--text)]"
                >
                  <XIcon />
                </button>
              </li>
            ))}
          </ul>

          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={() => start(staged)}
              className="btn-light flex-1 rounded-md px-3 py-1.5 text-sm font-medium text-[var(--text)]"
            >
              Import {staged.length} file{staged.length === 1 ? "" : "s"}
            </button>
            <button
              onClick={() => fileRef.current?.click()}
              className="rounded-md px-2 py-1.5 text-xs font-medium text-[var(--muted)] transition-colors hover:text-[var(--text)]"
            >
              Add more
            </button>
            <button
              onClick={clearStaged}
              className="rounded-md px-2 py-1.5 text-xs font-medium text-[var(--muted)] transition-colors hover:text-[var(--text)]"
            >
              Cancel
            </button>
          </div>
        </div>
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
          addFiles(files);
        }}
      />
    </div>
  );
}

function XIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
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
