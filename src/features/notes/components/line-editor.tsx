"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { handleFormatKey } from "../format";
import { handleExpansionKey } from "@/features/settings/expansion";

// A single editable line (one verse). No box — just a bottom underline that
// signals state: light-gray when empty/idle, black when focused/empty, none
// once it has text. Supports ⌘B/⌘U/⌘H via the shared format util.
export function LineEditor({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [focused, setFocused] = useState(false);
  const [empty, setEmpty] = useState(!stripHtml(value));

  useEffect(() => {
    if (ref.current) ref.current.innerHTML = value || "";
    setEmpty(!stripHtml(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const emit = () => {
    const html = ref.current?.innerHTML ?? "";
    setEmpty(!(ref.current?.textContent ?? "").trim());
    onChange(html);
  };

  return (
    <div
      ref={ref}
      role="textbox"
      contentEditable
      suppressContentEditableWarning
      data-placeholder={placeholder}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onInput={emit}
      onKeyDown={(e) => {
        if (handleExpansionKey(e)) emit();
        if (e.key === "Enter") {
          e.preventDefault();
          ref.current?.blur();
          return;
        }
        if (handleFormatKey(e)) emit();
      }}
      className={clsx(
        "line-editor min-w-0 flex-1 border-b pb-0.5 text-sm leading-snug text-[var(--text)] outline-none transition-colors",
        empty && "line-empty",
        !empty ? "border-transparent" : focused ? "border-[var(--ink)]" : "border-[var(--border-strong)]",
      )}
    />
  );
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").trim();
}
