"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";

const SPEAKERS = ["Minoru Chen", "Ray Mulligan", "Ricky Acosta", "Ron Kangis"];

export function SpeakerPill({
  value,
  onChange,
}: {
  value: string;
  onChange: (name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div ref={wrap} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={clsx(
          "rounded-full border px-3 py-1 text-xs font-medium transition",
          value
            ? "border-[var(--border-strong)] bg-[var(--inset)] text-[var(--text)]"
            : "border-dashed border-[var(--border-strong)] bg-transparent text-[var(--muted)]",
          "hover:border-[var(--ink)]",
        )}
      >
        {value || "Select"} <span className="ml-0.5 text-[9px] text-[var(--faint)]">▼</span>
      </button>

      {open && (
        <div className="bento absolute left-0 top-full z-30 mt-1 w-44 overflow-hidden py-1">
          {SPEAKERS.map((name) => (
            <button
              key={name}
              onClick={() => {
                onChange(name);
                setOpen(false);
              }}
              className={clsx(
                "block w-full px-3 py-1.5 text-left text-[13px] transition hover:bg-black/[0.04]",
                name === value ? "font-medium text-[var(--text)]" : "text-[var(--muted)]",
              )}
            >
              {name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
