"use client";

import { useState } from "react";
import { RichEditor } from "./rich-editor";
import { ResizeHandle } from "./resize-handle";

const MIN_H = 96; // ~3 lines

// Full-width "Introduction" header across the top; concave box below,
// drag-resizable with the shared corner grip (bottom-right).
export function IntroEditor({
  value,
  onChange,
  noteKey,
}: {
  value: string;
  onChange: (html: string) => void;
  noteKey: string;
}) {
  const [height, setHeight] = useState(MIN_H);

  const onStart = (e: React.PointerEvent) => {
    const startY = e.clientY;
    const startH = height;
    return (ev: PointerEvent) => setHeight(Math.max(MIN_H, startH + (ev.clientY - startY)));
  };

  return (
    <div className="w-full overflow-hidden rounded-[14px] border border-[var(--border-strong)]">
      <div className="bg-[var(--card-2)] px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
        Introduction
      </div>
      <div className="relative" style={{ height }}>
        <RichEditor
          key={`intro-${noteKey}`}
          ariaLabel="Introduction"
          placeholder="introduction…"
          value={value}
          onChange={onChange}
          className="rich-editor concave-field h-full w-full overflow-y-auto rounded-none border-0 p-3 text-sm leading-relaxed text-[var(--text)] outline-none"
        />
        <ResizeHandle corner="br" onStart={onStart} />
      </div>
    </div>
  );
}
