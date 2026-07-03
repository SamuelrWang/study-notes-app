"use client";

import { useEffect, useRef } from "react";
import clsx from "clsx";
import { handleExpansionKey } from "@/features/settings/expansion";

// Inline outline-point editor: plain text with "[Label]" for verses, a bottom
// underline as the only affordance. Enter or blur commits (and exits).
export function PointEditor({
  initial,
  dark,
  onCommit,
}: {
  initial: string;
  dark?: boolean;
  onCommit: (text: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const done = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.textContent = initial;
    el.focus();
    const r = document.createRange();
    r.selectNodeContents(el);
    r.collapse(false);
    const s = window.getSelection();
    s?.removeAllRanges();
    s?.addRange(r);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const commit = () => {
    if (done.current) return;
    done.current = true;
    onCommit(ref.current?.textContent ?? "");
  };

  return (
    <div
      ref={ref}
      role="textbox"
      aria-label="Edit outline point"
      contentEditable
      suppressContentEditableWarning
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        handleExpansionKey(e);
        if (e.key === "Enter") {
          e.preventDefault();
          ref.current?.blur();
        }
      }}
      onBlur={commit}
      className={clsx(
        "relative z-10 min-w-0 flex-1 whitespace-normal break-words border-b-2 pb-0.5 text-sm leading-relaxed outline-none",
        dark ? "border-white/70 text-white" : "border-[var(--ink)] text-[var(--text)]",
      )}
    />
  );
}
