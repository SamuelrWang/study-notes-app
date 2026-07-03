"use client";

import { useEffect, useRef } from "react";
import { handleFormatKey } from "../format";
import { handleExpansionKey } from "@/features/settings/expansion";

type Props = {
  value: string; // HTML
  onChange: (html: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
  autoFocus?: boolean;
  blurOnEnter?: boolean; // single-line feel (e.g. the question line)
};

export function RichEditor({
  value,
  onChange,
  placeholder,
  ariaLabel,
  className,
  autoFocus,
  blurOnEnter,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);

  // Load initial HTML once on mount. Remounted (via key) when the note/point
  // changes, so this re-runs with fresh content without yanking the caret.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.innerHTML = value || "";
    if (autoFocus) {
      el.focus();
      const r = document.createRange();
      r.selectNodeContents(el);
      r.collapse(false);
      const s = window.getSelection();
      s?.removeAllRanges();
      s?.addRange(r);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const emit = () => onChange(ref.current?.innerHTML ?? "");

  return (
    <div
      ref={ref}
      role="textbox"
      aria-label={ariaLabel}
      aria-multiline="true"
      contentEditable
      suppressContentEditableWarning
      onInput={emit}
      onKeyDown={(e) => {
        handleExpansionKey(e); // expansion's own input event re-emits
        if (blurOnEnter && e.key === "Enter") {
          e.preventDefault();
          ref.current?.blur();
          return;
        }
        if (handleFormatKey(e)) emit();
      }}
      data-placeholder={placeholder}
      className={
        className ??
        "rich-editor concave-field flex-1 overflow-y-auto rounded-lg p-3 text-sm leading-relaxed text-[var(--text)] outline-none"
      }
    />
  );
}
