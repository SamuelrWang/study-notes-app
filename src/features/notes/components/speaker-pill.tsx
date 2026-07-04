"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";

export function SpeakerPill({
  value,
  onChange,
}: {
  value: string;
  onChange: (name: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const input = useRef<HTMLInputElement>(null);

  // focus + select on entering edit mode, seeded with the current value
  useEffect(() => {
    if (!editing) return;
    setDraft(value);
    const el = input.current;
    if (el) {
      el.focus();
      el.select();
    }
  }, [editing, value]);

  const commit = () => {
    const next = draft.trim();
    if (next !== value) onChange(next); // empty clears back to "Add speaker"
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        ref={input}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          } else if (e.key === "Escape") {
            e.preventDefault();
            setEditing(false);
          }
        }}
        placeholder="Add speaker"
        className="w-36 rounded-full border border-[var(--border-strong)] bg-[var(--inset)] px-3 py-1 text-xs font-medium text-[var(--text)] outline-none placeholder:text-[var(--muted)]"
      />
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className={clsx(
        "rounded-full border px-3 py-1 text-xs font-medium transition",
        value
          ? "border-[var(--border-strong)] bg-[var(--inset)] text-[var(--text)]"
          : "border-dashed border-[var(--border-strong)] bg-transparent text-[var(--muted)]",
        "hover:border-[var(--ink)]",
      )}
    >
      {value || "Add speaker"}
    </button>
  );
}
