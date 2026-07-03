"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import clsx from "clsx";
import { motion, LayoutGroup } from "framer-motion";
import type { Note, OutlinePoint, StudyQuestion, TextPart, VerseRef } from "../types";
import { flatten, fullLabelFor } from "../outline";
import { partsToEditable, parseEditedText } from "../refs";
import { questionColor } from "../questions";
import { handleTextareaExpansionKey } from "@/features/settings/expansion";
import { uiConfirm } from "@/features/ui/dialogs";
import { VerseTab } from "./verse-tab";
import { VersePill } from "./verse-pill";
import { SpeakerPill } from "./speaker-pill";
import { IntroEditor } from "./intro-editor";
import { PointEditor } from "./point-editor";
import { Parts } from "./parts";
import { QuestionBubble, type QuestionFieldEdit } from "./question-bubble";
import { ImportOutlineButton } from "./import-outline-button";
import { PencilIcon } from "./icons";

type Props = {
  note: Note;
  selectedPath: number[] | null;
  selectedPoint: OutlinePoint | null;
  onTitleChange: (title: string) => void;
  onSpeakerChange: (speaker: string) => void;
  onIntroChange: (html: string) => void;
  onVerseEdit: (refIndex: number, verseIndex: number, html: string) => void;
  onToggleStar: (refIndex: number) => void;
  onEditCommit: (pointId: string, textParts: TextPart[], refs: VerseRef[]) => void;
  onChangeDepth: (pointId: string, dir: -1 | 1) => void;
  onSelect: (path: number[]) => void;
  onImportApply: (fn: (note: Note) => Note) => void;
  onAddQuestion: () => string; // returns the new question's id
  onQuestionText: (id: string, edit: QuestionFieldEdit) => void;
  onQuestionAnswer: (id: string, edit: QuestionFieldEdit) => void;
  onQuestionMove: (id: string, anchorId: string | null) => void;
  onQuestionSpan: (id: string, span: number) => void;
  onQuestionDelete: (id: string) => void;
};

// While dragging a question bubble: which gap it would drop into.
// "top" = above the first outline point; otherwise the point id it lands after.
type DropSlot = "top" | string;

// Measured geometry (offsets within the outline scroll container) for each
// question's coverage line: it hangs from the bubble's left edge down past
// the covered points, ending in a draggable dot.
type Gutter = {
  lines: { qid: string; x: number; top: number; height: number; color: string }[];
};

const LINE_W = 3; // matches the bubble's thickened left border

const samePath = (a: number[] | null, b: number[]) =>
  !!a && a.length === b.length && a.every((v, i) => v === b[i]);

// Depth arrow — keeps the editor focused (no blur/commit) while re-nesting.
function DepthArrow({
  children,
  dark,
  onClick,
}: {
  children: React.ReactNode;
  dark?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onMouseDown={(e) => e.preventDefault()}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={clsx(
        "flex h-6 w-6 items-center justify-center rounded text-xl leading-none",
        dark ? "text-white/70 hover:text-white" : "text-[var(--muted)] hover:text-[var(--text)]",
      )}
    >
      {children}
    </button>
  );
}

const SLIDE = { type: "spring", stiffness: 600, damping: 44, mass: 0.7 } as const;

export function OutlinePanel({
  note,
  selectedPath,
  selectedPoint,
  onTitleChange,
  onSpeakerChange,
  onIntroChange,
  onVerseEdit,
  onToggleStar,
  onEditCommit,
  onChangeDepth,
  onSelect,
  onImportApply,
  onAddQuestion,
  onQuestionText,
  onQuestionAnswer,
  onQuestionMove,
  onQuestionSpan,
  onQuestionDelete,
}: Props) {
  const rows = flatten(note.outline);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [focusQuestionId, setFocusQuestionId] = useState<string | null>(null);

  // leave edit mode when switching notes
  useEffect(() => {
    setEditingId(null);
    setFocusQuestionId(null);
  }, [note.id]);

  // ---- study questions: placement + drag ----
  const questions = note.questions ?? [];
  const pointIds = new Set(rows.map((r) => r.point.id));
  // a question whose anchor point was deleted falls back to the top
  const anchorOf = (q: StudyQuestion): DropSlot =>
    q.anchorId && pointIds.has(q.anchorId) ? q.anchorId : "top";
  const questionsAt = (slot: DropSlot) => questions.filter((q) => anchorOf(q) === slot);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropSlot, setDropSlot] = useState<DropSlot | null>(null);
  const dropSlotRef = useRef<DropSlot | null>(null);
  const autoScrollDy = useRef(0);

  const beginQuestionDrag = (qid: string) => (e: React.PointerEvent) => {
    e.preventDefault();
    setDragId(qid);
    document.body.style.userSelect = "none";
    document.body.style.cursor = "grabbing";

    // auto-scroll the outline while the pointer hovers near its edges
    const scrollTimer = window.setInterval(() => {
      if (autoScrollDy.current && scrollRef.current)
        scrollRef.current.scrollTop += autoScrollDy.current;
    }, 16);

    const onMove = (ev: PointerEvent) => {
      const container = scrollRef.current;
      if (!container) return;
      const box = container.getBoundingClientRect();
      const EDGE = 48;
      autoScrollDy.current =
        ev.clientY < box.top + EDGE ? -9 : ev.clientY > box.bottom - EDGE ? 9 : 0;

      // nearest gap: after the last row whose midpoint is above the pointer
      let slot: DropSlot = "top";
      for (const row of container.querySelectorAll<HTMLElement>("[data-row-id]")) {
        const r = row.getBoundingClientRect();
        if (ev.clientY > r.top + r.height / 2) slot = row.dataset.rowId!;
        else break;
      }
      dropSlotRef.current = slot;
      setDropSlot(slot);
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.clearInterval(scrollTimer);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      const slot = dropSlotRef.current;
      if (slot) onQuestionMove(qid, slot === "top" ? null : slot);
      dropSlotRef.current = null;
      autoScrollDy.current = 0;
      setDragId(null);
      setDropSlot(null);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const dragColor = dragId
    ? questionColor(questions.find((q) => q.id === dragId) ?? questions[0])
    : null;

  // ---- coverage: a line off each bubble's left edge spanning the points
  // directly below it. Coverage is just a count (`span`, min 1), so it
  // follows the bubble wherever it moves.
  const flatIds = rows.map((r) => r.point.id);
  const startIdxOf = (q: StudyQuestion) => {
    const a = anchorOf(q);
    return a === "top" ? 0 : flatIds.indexOf(a) + 1;
  };
  const spanOf = (q: StudyQuestion) => {
    if (spanPreview?.qid === q.id) return spanPreview.span;
    const stored = q.span ?? q.pointIds?.length ?? 1; // pointIds = legacy shape
    const below = flatIds.length - startIdxOf(q);
    return Math.max(1, Math.min(stored, below));
  };
  const coveredIdsOf = (q: StudyQuestion) => {
    const start = startIdxOf(q);
    return flatIds.slice(start, start + spanOf(q));
  };

  const [spanPreview, setSpanPreview] = useState<{ qid: string; span: number } | null>(null);
  const spanPreviewRef = useRef(1);
  const [gutter, setGutter] = useState<Gutter>({ lines: [] });

  // Measure each coverage line from the rendered bubble + rows. Runs after
  // every render; the compare guard keeps it from looping.
  useLayoutEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const rowEls = new Map<string, HTMLElement>();
    container
      .querySelectorAll<HTMLElement>("[data-row-id]")
      .forEach((el) => rowEls.set(el.dataset.rowId!, el));

    const next: Gutter = { lines: [] };
    for (const q of questions) {
      const covered = coveredIdsOf(q);
      const bubble = document.getElementById(`question-${q.id}`);
      const lastEl = rowEls.get(covered[covered.length - 1] ?? "");
      if (!bubble || !lastEl) continue;
      const top = bubble.offsetTop + bubble.offsetHeight - 2; // overlap: flush with the left border
      next.lines.push({
        qid: q.id,
        x: bubble.offsetLeft,
        top,
        height: lastEl.offsetTop + lastEl.offsetHeight - 4 - top,
        color: questionColor(q).border,
      });
    }
    setGutter((cur) => (JSON.stringify(cur) === JSON.stringify(next) ? cur : next));
  });

  // Drag the dot at the end of a coverage line to include more (or fewer)
  // points. The span snaps a point into place once the pointer nears that
  // point's end; the first point below the bubble is always included.
  const beginSpanDrag = (qid: string) => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const q = questions.find((x) => x.id === qid);
    if (!q) return;
    const startIdx = startIdxOf(q);
    document.body.style.userSelect = "none";
    document.body.style.cursor = "ns-resize";
    const scrollTimer = window.setInterval(() => {
      if (autoScrollDy.current && scrollRef.current)
        scrollRef.current.scrollTop += autoScrollDy.current;
    }, 16);

    const onMove = (ev: PointerEvent) => {
      const container = scrollRef.current;
      if (!container) return;
      const box = container.getBoundingClientRect();
      const EDGE = 48;
      autoScrollDy.current =
        ev.clientY < box.top + EDGE ? -9 : ev.clientY > box.bottom - EDGE ? 9 : 0;

      let span = 1;
      container.querySelectorAll<HTMLElement>("[data-row-id]").forEach((el, i) => {
        if (i <= startIdx) return; // first covered point is automatic
        const r = el.getBoundingClientRect();
        if (ev.clientY > r.top + r.height * 0.6) span = i - startIdx + 1; // snap near its end
      });
      spanPreviewRef.current = span;
      setSpanPreview({ qid, span });
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.clearInterval(scrollTimer);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      autoScrollDy.current = 0;
      onQuestionSpan(qid, spanPreviewRef.current);
      setSpanPreview(null);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const jumpToPoint = (pointId: string) => {
    const row = rows.find((r) => r.point.id === pointId);
    if (!row) return;
    onSelect(row.path);
    scrollRef.current
      ?.querySelector(`[data-row-id="${pointId}"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  };


  const renderQuestions = (slot: DropSlot) => (
    <>
      {questionsAt(slot).map((q) => (
        <QuestionBubble
          key={q.id}
          question={q}
          number={questions.indexOf(q) + 1}
          autoFocus={q.id === focusQuestionId}
          dragging={q.id === dragId}
          coveredLabels={rows
            .filter((r) => coveredIdsOf(q).includes(r.point.id))
            .map((r) => [r.point.id, fullLabelFor(r.path)] as [string, string])}
          onTextCommit={(edit) => onQuestionText(q.id, edit)}
          onAnswerCommit={(edit) => onQuestionAnswer(q.id, edit)}
          onDelete={async () => {
            if (await uiConfirm(`Delete Question ${questions.indexOf(q) + 1}?`))
              onQuestionDelete(q.id);
          }}
          onDragStart={beginQuestionDrag(q.id)}
          onJumpToPoint={jumpToPoint}
        />
      ))}
      {dragId && dropSlot === slot && (
        <div
          className="mb-1.5 h-0.5 rounded-full"
          style={{ background: dragColor?.border ?? "var(--ink)" }}
        />
      )}
    </>
  );

  return (
    <section className="bento flex h-full min-w-0 flex-1 flex-col overflow-hidden">
      <div className="px-6 pt-5 pb-3">
        {/* Title — smaller, wraps */}
        <textarea
          value={note.title}
          onChange={(e) => onTitleChange(e.target.value)}
          onKeyDown={(e) => {
            const expanded = handleTextareaExpansionKey(e);
            if (expanded !== null) onTitleChange(expanded);
          }}
          placeholder="Untitled note"
          rows={1}
          className="title-area w-full resize-none bg-transparent text-lg font-semibold leading-snug tracking-tight text-[var(--text)] outline-none placeholder:text-[var(--faint)]"
        />

        {/* Scripture Reading pills */}
        {note.scriptureParts && note.scriptureParts.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[11px] font-medium uppercase tracking-wide text-[var(--faint)]">
              Scripture Reading
            </span>
            {note.scriptureParts.map((r, i) => (
              <VersePill key={`${r.label}-${i}`} verse={r} inline />
            ))}
          </div>
        )}

        {/* Speaker dropdown pill */}
        <div className="mt-3 flex items-center gap-2">
          <span className="text-[11px] font-medium uppercase tracking-wide text-[var(--faint)]">
            Speaker
          </span>
          <SpeakerPill value={note.speaker ?? ""} onChange={onSpeakerChange} />
        </div>
      </div>

      {/* study-question pills — click one to jump to its bubble */}
      <div className="flex items-center gap-1.5 overflow-x-auto border-b border-t border-[var(--border-soft)] px-6 py-2">
        {questions.map((q, i) => {
          const c = questionColor(q);
          return (
            <button
              key={q.id}
              onClick={() =>
                document
                  .getElementById(`question-${q.id}`)
                  ?.scrollIntoView({ behavior: "smooth", block: "center" })
              }
              className="shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold transition hover:brightness-95"
              style={{ borderColor: c.border, background: c.bg, color: c.text }}
            >
              Question {i + 1}
            </button>
          );
        })}
        <button
          onClick={() => setFocusQuestionId(onAddQuestion())}
          className="shrink-0 rounded-full border border-[var(--border-strong)] bg-[var(--inset)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--muted)] transition hover:text-[var(--text)]"
        >
          + Question
        </button>
      </div>

      <LayoutGroup>
        <div ref={scrollRef} className="relative flex-1 overflow-y-auto px-3 py-3">
          {/* coverage lines — each hangs from its bubble's left edge and ends
              in a draggable dot that extends the span point by point */}
          {gutter.lines.map((l) => (
            <div key={`line-${l.qid}`}>
              <div
                className="pointer-events-none absolute"
                style={{
                  left: l.x,
                  top: l.top,
                  width: LINE_W,
                  height: l.height,
                  background: l.color,
                }}
              />
              <div
                role="button"
                aria-label="Drag to span outline points"
                title="Drag down to cover more points"
                onPointerDown={beginSpanDrag(l.qid)}
                className="absolute z-20 flex h-4 w-4 cursor-ns-resize touch-none items-center justify-center"
                style={{ left: l.x + LINE_W / 2 - 8, top: l.top + l.height - 8 }}
              >
                <div className="h-2 w-2 rounded-full" style={{ background: l.color }} />
              </div>
            </div>
          ))}
          {/* Introduction — above the first outline point */}
          <div className="mb-3">
            <IntroEditor value={note.introduction ?? ""} onChange={onIntroChange} noteKey={note.id} />
          </div>

          {/* questions anchored above the first point */}
          {renderQuestions("top")}

          {rows.length === 0 && (
            <>
              <p className="px-3 pt-6 text-center text-xs text-[var(--faint)]">
                This note has no outline.
              </p>
              <ImportOutlineButton onApply={onImportApply} />
            </>
          )}

          {rows.map(({ point, depth, label, path }) => {
            const selected = samePath(selectedPath, path);
            const editing = editingId === point.id;
            const parts = point.textParts?.length ? point.textParts : [point.text];
            return (
              <div key={point.id}>
              <div
                data-row-id={point.id}
                style={{ marginLeft: depth * 22 }}
                onClick={() => !editing && onSelect(path)}
                className={clsx(
                  "group relative mb-1.5 flex gap-2.5 rounded-xl px-3 py-2 transition-colors",
                  editing ? "cursor-text" : "cursor-pointer",
                  !selected && !editing && "hover:bg-black/[0.04]",
                )}
              >
                {selected && (
                  <motion.div
                    layoutId="outline-thumb"
                    transition={SLIDE}
                    className="raised-black absolute inset-0 rounded-xl"
                  />
                )}

                {/* label — identical in both modes so nothing shifts */}
                <span
                  className={clsx(
                    "relative z-10 w-8 shrink-0 select-none pt-px text-right text-sm font-semibold tabular-nums",
                    selected ? "text-white/80" : "text-[var(--faint)]",
                  )}
                >
                  {label}.
                </span>

                {editing ? (
                  <PointEditor
                    initial={partsToEditable(parts, point.refs ?? [])}
                    dark={selected}
                    onCommit={(text) => {
                      const parsed = parseEditedText(text, point.refs ?? []);
                      onEditCommit(point.id, parsed.textParts, parsed.refs);
                      setEditingId(null);
                    }}
                  />
                ) : (
                  <div
                    className={clsx(
                      "relative z-10 min-w-0 flex-1 whitespace-normal break-words text-sm leading-relaxed",
                      selected ? "text-white" : "text-[var(--text)]",
                    )}
                  >
                    <Parts parts={parts} refs={point.refs ?? []} onDark={selected} />
                  </div>
                )}

                {/* edit pencil — top-left corner, on hover */}
                {!editing && (
                  <button
                    title="Edit point"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingId(point.id);
                    }}
                    className={clsx(
                      "absolute left-1 top-1 z-20 hidden rounded p-1 group-hover:block",
                      selected
                        ? "text-white/70 hover:text-white"
                        : "text-[var(--faint)] hover:text-[var(--text)]",
                    )}
                  >
                    <PencilIcon />
                  </button>
                )}

                {/* depth arrows — top-right corner, only while editing */}
                {editing && (
                  <span className="absolute right-1 top-1 z-20 flex items-center gap-0.5">
                    <DepthArrow dark={selected} onClick={() => onChangeDepth(point.id, -1)}>
                      ‹
                    </DepthArrow>
                    <DepthArrow dark={selected} onClick={() => onChangeDepth(point.id, 1)}>
                      ›
                    </DepthArrow>
                  </span>
                )}
              </div>

              {/* questions anchored after this point */}
              {renderQuestions(point.id)}
              </div>
            );
          })}
        </div>
      </LayoutGroup>

      {selectedPoint && (
        <VerseTab
          pointKey={selectedPoint.id}
          refs={selectedPoint.refs ?? []}
          onVerseEdit={onVerseEdit}
          onToggleStar={onToggleStar}
        />
      )}
    </section>
  );
}
