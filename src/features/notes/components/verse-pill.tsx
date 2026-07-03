"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";
import type { VerseRef } from "../types";

type Pos = { x: number; y: number } | null;

const shortRef = (ref: string) => ref.split(" ").pop() ?? ref; // "Matt. 14:6" -> "14:6"

// Optional color override so pills can match their surroundings (e.g. the
// study-question bubbles tint their pills with the question's color).
export type PillTint = { border: string; text: string };

export function VersePill({
  verse,
  inline,
  onDark,
  tint,
}: {
  verse: VerseRef;
  inline?: boolean;
  onDark?: boolean;
  tint?: PillTint;
}) {
  const [pos, setPos] = useState<Pos>(null);

  const filled = verse.verses.filter((v) => v.text && v.text.trim());
  const hasText = filled.length > 0;
  const starred = !!verse.starred;

  const tinted = tint && !starred;
  return (
    <>
      <button
        onMouseEnter={(e) => hasText && setPos({ x: e.clientX, y: e.clientY })}
        onMouseMove={(e) => hasText && setPos({ x: e.clientX, y: e.clientY })}
        onMouseLeave={() => setPos(null)}
        onClick={(e) => e.stopPropagation()}
        style={
          tinted
            ? {
                borderColor: tint.border,
                color: tint.text,
                background: hasText ? "rgba(255,255,255,0.6)" : "transparent",
                opacity: hasText ? 1 : 0.55,
              }
            : undefined
        }
        className={clsx(
          "rounded-full border font-medium transition",
          inline ? "mx-0.5 inline-block align-baseline px-1.5 py-0 text-xs" : "px-2.5 py-1 text-xs",
          tinted
            ? hasText
              ? "hover:!bg-white"
              : "cursor-default border-dashed"
            : starred
              ? "border-[#c89b2c] bg-[#ecc94b] text-[#3a2c00]"
              : onDark
                ? hasText
                  ? "border-white/25 bg-white/15 text-white hover:bg-white/25"
                  : "cursor-default border-white/10 bg-white/5 text-white/40"
                : hasText
                  ? "border-[var(--border-strong)] bg-[var(--inset)] text-[var(--text)] hover:border-[var(--ink)]"
                  : "cursor-default border-dashed border-[var(--border)] bg-transparent text-[var(--faint)]",
        )}
      >
        {verse.label}
      </button>
      {pos && hasText && (
        <VerseTooltip label={verse.label} filled={filled} x={pos.x} y={pos.y} />
      )}
    </>
  );
}

function VerseTooltip({
  label,
  filled,
  x,
  y,
}: {
  label: string;
  filled: { ref: string; text: string }[];
  x: number;
  y: number;
}) {
  if (typeof document === "undefined") return null;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const single = filled.length === 1;

  return createPortal(
    <div
      className="pointer-events-none fixed z-[9999] max-h-80 w-[26rem] max-w-[80vw] overflow-hidden rounded-xl border border-[var(--border-strong)] p-3.5 text-sm shadow-xl"
      style={{
        left: Math.min(x + 14, vw - 430),
        top: Math.min(y + 14, vh - 320),
        backgroundColor: "#ffffff",
      }}
    >
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
        {label}
      </div>
      <div className="space-y-1.5">
        {filled.map((v) => (
          <p
            key={v.ref}
            className="leading-snug text-[var(--text)]"
            dangerouslySetInnerHTML={{
              __html: single ? v.text : `<span class="verse-num">${shortRef(v.ref)}</span> ${v.text}`,
            }}
          />
        ))}
      </div>
    </div>,
    document.body,
  );
}
