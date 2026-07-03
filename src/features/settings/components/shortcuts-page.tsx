"use client";

import type { ShortcutRule } from "../types";

// Rules table for typing auto-expansion. Triggers match whole words only,
// case-sensitively, when a boundary key (space, Enter, punctuation) commits
// the word — see settings/expansion.ts.

type Props = {
  rules: ShortcutRule[];
  onChange: (rules: ShortcutRule[]) => void;
};

export function ShortcutsPage({ rules, onChange }: Props) {
  const update = (id: string, patch: Partial<ShortcutRule>) =>
    onChange(rules.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const remove = (id: string) => onChange(rules.filter((r) => r.id !== id));
  const add = () =>
    onChange([...rules, { id: crypto.randomUUID(), trigger: "", replacement: "" }]);

  return (
    <div className="px-6 py-5">
      <h2 className="text-sm font-semibold text-[var(--text)]">Typing shortcuts</h2>
      <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">
        While you type in any note, a shortcut expands the moment you finish the word — press
        space, Enter, or punctuation after it. Matching is case-sensitive and whole-word only:
        with a rule <b>NJ → New Jerusalem</b>, typing “NJ ” expands but “nj” or “NJx” never will.
      </p>

      <div className="mt-5">
        <div className="mb-1.5 grid grid-cols-[10rem_1fr_2rem] gap-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--faint)]">
          <span>When I type</span>
          <span>Replace with</span>
          <span />
        </div>

        {rules.length === 0 && (
          <p className="rounded-lg border border-dashed border-[var(--border-strong)] px-3 py-5 text-center text-xs text-[var(--faint)]">
            No shortcuts yet. Add one below — e.g. “X” → “Christ”.
          </p>
        )}

        {rules.map((rule) => (
          <div key={rule.id} className="mb-1.5 grid grid-cols-[10rem_1fr_2rem] items-center gap-2">
            <input
              value={rule.trigger}
              // triggers are single words — spaces can never match a token
              onChange={(e) => update(rule.id, { trigger: e.target.value.replace(/\s+/g, "") })}
              placeholder="NJ"
              className="concave-field rounded-lg px-2.5 py-1.5 text-sm text-[var(--text)] outline-none"
            />
            <input
              value={rule.replacement}
              onChange={(e) => update(rule.id, { replacement: e.target.value })}
              placeholder="New Jerusalem"
              className="concave-field rounded-lg px-2.5 py-1.5 text-sm text-[var(--text)] outline-none"
            />
            <button
              onClick={() => remove(rule.id)}
              className="rounded px-1 text-sm text-[var(--muted)] hover:text-red-500"
              title="Delete shortcut"
            >
              ✕
            </button>
          </div>
        ))}

        <button
          onClick={add}
          className="btn-light mt-2 rounded-md px-2.5 py-1 text-xs font-medium text-[var(--text)]"
        >
          + Add shortcut
        </button>
      </div>
    </div>
  );
}
