"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import type { StudyQuestion } from "../types";
import { questionColor } from "../questions";
import { parseEditedText, partsToEditable } from "../refs";
import { handleExpansionKey } from "@/features/settings/expansion";
import { Parts } from "./parts";
import { GripIcon } from "./icons";

// What a commit from either editable field carries back up.
export type QuestionFieldEdit = ReturnType<typeof parseEditedText>;

// One study-question bubble in the outline: a colored rectangle (dark border,
// light fill, squared-off thicker left edge that the coverage line hangs
// from) with a grip for dragging it between outline points. The question line
// and the answer both support inline verse pills with the same "[Rev. 4:5]"
// bracket syntax as outline points — click the text to edit it raw.
export function QuestionBubble({
  question,
  number,
  autoFocus,
  dragging,
  coveredLabels, // [pointId, "II.A.3"] pairs in outline order
  onTextCommit,
  onAnswerCommit,
  onDelete,
  onDragStart,
  onJumpToPoint,
}: {
  question: StudyQuestion;
  number: number; // 1-based position in the note's question list
  autoFocus: boolean;
  dragging: boolean;
  coveredLabels: [string, string][];
  onTextCommit: (edit: QuestionFieldEdit) => void;
  onAnswerCommit: (edit: QuestionFieldEdit) => void;
  onDelete: () => void;
  onDragStart: (e: React.PointerEvent) => void;
  onJumpToPoint: (pointId: string) => void;
}) {
  const c = questionColor(question);
  const [editing, setEditing] = useState<"text" | "answer" | null>(autoFocus ? "text" : null);

  const textParts = question.textParts?.length ? question.textParts : [question.text];
  const answerParts = question.answerParts?.length ? question.answerParts : [question.answer ?? ""];
  const hasAnswer = !!(question.answer ?? "").trim();

  return (
    <div
      id={`question-${question.id}`}
      className={clsx(
        "group/q mb-1.5 rounded-r-xl border px-3 py-2 transition-opacity",
        dragging && "opacity-40",
      )}
      style={{ borderColor: c.border, borderLeftWidth: 3, background: c.bg }}
    >
      <div className="flex items-center gap-1.5">
        <span
          role="button"
          aria-label="Drag question"
          onPointerDown={onDragStart}
          className="-ml-1 cursor-grab touch-none select-none rounded p-0.5 opacity-50 hover:opacity-100"
          style={{ color: c.border }}
        >
          <GripIcon />
        </span>
        <span
          className="text-[11px] font-semibold uppercase tracking-wide"
          style={{ color: c.text }}
        >
          Question {number}
        </span>
        <button
          onClick={onDelete}
          title="Delete question"
          className="ml-auto hidden rounded px-1 text-xs group-hover/q:block"
          style={{ color: c.text }}
        >
          ✕
        </button>
      </div>

      {/* the question itself — one line, click to edit raw brackets */}
      {editing === "text" ? (
        <PlainEditor
          initial={partsToEditable(textParts, question.refs ?? [])}
          onCommit={(raw) => {
            onTextCommit(parseEditedText(raw, question.refs ?? []));
            setEditing(null);
          }}
          className="mt-1 text-sm font-medium"
        />
      ) : (
        <div
          onClick={() => setEditing("text")}
          className="mt-1 cursor-text whitespace-pre-wrap break-words text-sm font-medium leading-relaxed text-[var(--text)]"
        >
          {question.text.trim() ? (
            <Parts parts={textParts} refs={question.refs ?? []} tint={c} />
          ) : (
            <span className="text-[var(--faint)]">type the study question…</span>
          )}
        </div>
      )}

      {/* covered outline points — click a pill to jump there */}
      {coveredLabels.length > 0 && (
        <div className="mt-1.5 flex flex-wrap items-center gap-1">
          {coveredLabels.map(([pointId, label]) => (
            <button
              key={pointId}
              onClick={() => onJumpToPoint(pointId)}
              className="rounded-full border bg-white/60 px-2 py-px text-[10px] font-semibold tabular-nums transition hover:bg-white"
              style={{ borderColor: c.border, color: c.text }}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* the user's answer — multi-line, same pill syntax */}
      <div className="mt-1.5 border-t pt-1.5" style={{ borderColor: `${c.border}33` }}>
        {editing === "answer" ? (
          <PlainEditor
            initial={partsToEditable(answerParts, question.answerRefs ?? [])}
            multiline
            onCommit={(raw) => {
              onAnswerCommit(parseEditedText(raw, question.answerRefs ?? []));
              setEditing(null);
            }}
            className="text-sm"
          />
        ) : (
          <div
            onClick={() => setEditing("answer")}
            className="cursor-text whitespace-pre-wrap break-words text-sm leading-relaxed text-[var(--text)]"
          >
            {hasAnswer ? (
              <Parts parts={answerParts} refs={question.answerRefs ?? []} tint={c} />
            ) : (
              <span className="text-[var(--faint)]">answer…</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Minimal plain-text contentEditable: shows raw "[Label]" brackets, commits
// on blur (and Enter unless multiline). Typing shortcuts apply.
function PlainEditor({
  initial,
  multiline,
  onCommit,
  className,
}: {
  initial: string;
  multiline?: boolean;
  onCommit: (raw: string) => void;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const done = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.innerText = initial;
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
    onCommit(ref.current?.innerText ?? "");
  };

  return (
    <div
      ref={ref}
      role="textbox"
      contentEditable
      suppressContentEditableWarning
      onKeyDown={(e) => {
        handleExpansionKey(e);
        if (e.key === "Enter" && !multiline) {
          e.preventDefault();
          ref.current?.blur();
        }
      }}
      onBlur={commit}
      className={clsx(
        "whitespace-pre-wrap break-words border-b border-[var(--ink)] pb-0.5 leading-relaxed text-[var(--text)] outline-none",
        className,
      )}
    />
  );
}
