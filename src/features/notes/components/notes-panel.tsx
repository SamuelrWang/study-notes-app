"use client";

import { useRef, useState } from "react";
import type { OutlinePoint } from "../types";
import { RichEditor } from "./rich-editor";
import { ResizeHandle } from "./resize-handle";
import { applyFormat } from "../format";

type Props = {
  point: OutlinePoint | null;
  label: string | null;
  onChange: (field: "messageNotes" | "studyNotes", value: string) => void;
};

// Run a formatting command on the focused editor, then nudge React to pick up
// the DOM change via a bubbling input event.
function runCmd(action: () => void) {
  action();
  const el = document.activeElement as HTMLElement | null;
  el?.dispatchEvent(new Event("input", { bubbles: true }));
}

const MIN_PX = 64; // one line tall with even top/bottom padding

export function NotesPanel({ point, label, onChange }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const [frac, setFrac] = useState(0.5); // message-notes share of the height

  // The divider follows the pointer; both handles drive the same split.
  const onSplitStart = () => (ev: PointerEvent) => {
    const rect = wrap.current?.getBoundingClientRect();
    if (!rect) return;
    const minF = MIN_PX / rect.height;
    let f = (ev.clientY - rect.top) / rect.height;
    f = Math.min(1 - minF, Math.max(minF, f));
    setFrac(f);
  };

  if (!point) {
    return (
      <section className="bento flex h-full w-[34%] min-w-[320px] items-center justify-center px-6 text-center">
        <p className="text-sm text-[var(--muted)]">
          Select an outline point in the middle to attach notes.
        </p>
      </section>
    );
  }

  return (
    <section className="bento flex h-full w-[34%] min-w-[320px] flex-col overflow-hidden">
      <div className="border-b border-[var(--border-soft)] px-6 py-4">
        <div className="text-[11px] font-medium uppercase tracking-wide text-[var(--faint)]">
          Point {label}
        </div>
        <div className="mt-0.5 truncate text-sm font-semibold text-[var(--text)]">
          {point.text || "untitled point"}
        </div>
      </div>

      {/* Formatting toolbar — acts on the focused notes box */}
      <div className="flex items-center gap-1.5 border-b border-[var(--border-soft)] px-4 py-2.5">
        <FmtBtn label="Bold (⌘B)" onClick={() => runCmd(() => applyFormat("bold"))}>
          <span className="font-bold">B</span>
        </FmtBtn>
        <FmtBtn label="Underline (⌘U)" onClick={() => runCmd(() => applyFormat("underline"))}>
          <span className="underline">U</span>
        </FmtBtn>
        <FmtBtn label="Highlight (⌘H)" onClick={() => runCmd(() => applyFormat("highlight"))}>
          <mark className="rounded-sm px-1">H</mark>
        </FmtBtn>
      </div>

      <div ref={wrap} className="flex min-h-0 flex-1 flex-col gap-2 p-5">
        <NoteBox
          heading="Message Notes"
          grow={frac}
          value={point.messageNotes}
          onChange={(v) => onChange("messageNotes", v)}
          editorKey={`${point.id}:message`}
          corner="br"
          onStart={onSplitStart}
        />
        <NoteBox
          heading="Study Notes"
          grow={1 - frac}
          value={point.studyNotes}
          onChange={(v) => onChange("studyNotes", v)}
          editorKey={`${point.id}:study`}
          corner="tr"
          onStart={onSplitStart}
        />
      </div>
    </section>
  );
}

function NoteBox({
  heading,
  grow,
  value,
  onChange,
  editorKey,
  corner,
  onStart,
}: {
  heading: string;
  grow: number;
  value: string;
  onChange: (v: string) => void;
  editorKey: string;
  corner: "br" | "tr";
  onStart: (e: React.PointerEvent) => (ev: PointerEvent) => void;
}) {
  return (
    <div
      style={{ flexGrow: grow, flexBasis: 0 }}
      className="flex min-h-0 flex-col overflow-hidden rounded-[14px] border border-[var(--border-strong)]"
    >
      <div className="shrink-0 bg-[var(--card-2)] px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
        {heading}
      </div>
      {/* text entry area — the resize grip lives in its corner */}
      <div className="relative min-h-0 flex-1">
        <RichEditor
          key={editorKey}
          ariaLabel={heading}
          placeholder={`${heading.toLowerCase()}…`}
          value={value}
          onChange={onChange}
          className="rich-editor concave-field h-full w-full overflow-y-auto rounded-none border-0 p-3 text-sm leading-relaxed text-[var(--text)] outline-none"
        />
        <ResizeHandle corner={corner} onStart={onStart} />
      </div>
    </div>
  );
}

function FmtBtn({
  children,
  onClick,
  label,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      title={label}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="btn-light flex h-7 w-8 items-center justify-center rounded-md text-sm text-[var(--text)]"
    >
      {children}
    </button>
  );
}
