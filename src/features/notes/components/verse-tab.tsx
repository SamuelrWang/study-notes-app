"use client";

import { useState } from "react";
import type { VerseRef } from "../types";
import { LineEditor } from "./line-editor";
import { ResizeHandle } from "./resize-handle";

const verseNum = (ref: string) => ref.split(":").pop() ?? ref; // "Matt. 3:11" -> "11"

const MAX_H = 170; // current fixed height = the maximum
const MIN_H = 60;

type Props = {
  pointKey: string; // remounts line editors when the selected point changes
  refs: VerseRef[];
  onVerseEdit: (refIndex: number, verseIndex: number, html: string) => void;
  onToggleStar: (refIndex: number) => void;
};

export function VerseTab({ pointKey, refs, onVerseEdit, onToggleStar }: Props) {
  const [height, setHeight] = useState(MAX_H);

  // dragging the top edge: up = taller (to max), down = shorter (to min)
  const onStart = (e: React.PointerEvent) => {
    const startY = e.clientY;
    const startH = height;
    return (ev: PointerEvent) =>
      setHeight(Math.min(MAX_H, Math.max(MIN_H, startH - (ev.clientY - startY))));
  };

  return (
    <div style={{ height }} className="verse-tab relative m-3 shrink-0 overflow-hidden">
      <ResizeHandle corner="tr" onStart={onStart} />
      <div className="h-full overflow-y-auto px-4 py-3">
      {refs.length === 0 && (
        <p className="py-6 text-center text-xs text-[var(--faint)]">No verses on this point.</p>
      )}

      {refs.map((ref, ri) => (
        <div key={`${ref.label}-${ri}`} className="mb-2.5">
          {/* chunk header — star + full reference (book included) */}
          <div className="mb-0.5 flex items-center gap-1.5">
            <Star starred={!!ref.starred} onClick={() => onToggleStar(ri)} />
            <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--link)]">
              {ref.label}
            </span>
          </div>
          <div className="pl-5">
            {ref.verses.map((v, vi) => (
              <div key={v.ref} className="flex items-start gap-2 py-0.5">
                <span className="w-5 shrink-0 select-none pt-0.5 text-right text-[11px] font-medium tabular-nums text-[var(--faint)]">
                  {verseNum(v.ref)}
                </span>
                <LineEditor
                  key={`${pointKey}:${ref.label}:${v.ref}`}
                  value={v.text}
                  onChange={(html) => onVerseEdit(ri, vi, html)}
                />
              </div>
            ))}
          </div>
        </div>
      ))}
      </div>
    </div>
  );
}

function Star({ starred, onClick }: { starred: boolean; onClick: () => void }) {
  return (
    <span
      role="button"
      title={starred ? "Unstar" : "Star"}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="cursor-pointer select-none text-sm leading-none"
      style={{ color: starred ? "#d4a017" : "var(--faint)" }}
    >
      {starred ? "★" : "☆"}
    </span>
  );
}
