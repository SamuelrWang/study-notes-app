"use client";

import { useRef } from "react";
import clsx from "clsx";

// Format an ISO "YYYY-MM-DD" as e.g. "Jul 4, 2026". Parsed as local time
// (no Date("YYYY-MM-DD") UTC-shift) so the shown day matches what was picked.
function formatDate(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function DatePill({
  value,
  onChange,
}: {
  value: string; // ISO "YYYY-MM-DD" or "" when unset
  onChange: (iso: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);

  // Open the native picker over the pill. showPicker() where supported;
  // otherwise focusing the (invisible, overlaid) input opens it on click.
  const openPicker = () => {
    const el = input.current;
    if (!el) return;
    try {
      el.showPicker();
    } catch {
      el.focus();
    }
  };

  return (
    <div className="group relative inline-flex items-center">
      <button
        onClick={openPicker}
        className={clsx(
          "rounded-full border px-3 py-1 text-xs font-medium transition",
          value
            ? "border-[var(--border-strong)] bg-[var(--inset)] text-[var(--text)] pr-6" // room for the clear ×
            : "border-dashed border-[var(--border-strong)] bg-transparent text-[var(--muted)]",
          "hover:border-[var(--ink)]",
        )}
      >
        {value ? formatDate(value) : "Add date"}
      </button>

      {value && (
        <button
          title="Clear date"
          onClick={() => onChange("")}
          className="absolute right-1.5 top-1/2 z-10 hidden -translate-y-1/2 rounded-full px-1 text-[11px] leading-none text-[var(--muted)] transition hover:text-[var(--text)] group-hover:block"
        >
          ×
        </button>
      )}

      {/* Invisible native picker overlaying the pill — keeps the pill look while
          the browser's date UI does the actual editing. */}
      <input
        ref={input}
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        tabIndex={-1}
        aria-hidden
        className="pointer-events-none absolute inset-0 h-full w-full opacity-0"
      />
    </div>
  );
}
