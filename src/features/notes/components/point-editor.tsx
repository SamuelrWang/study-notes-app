"use client";

import { useEffect, useRef } from "react";
import clsx from "clsx";
import { handleExpansionKey } from "@/features/settings/expansion";

// Inline outline-point editor: plain text with "[Label]" for verses, a bottom
// underline as the only affordance. Enter or blur commits (and exits). While
// typing, the raw text is pushed up on a short debounce via onLiveCommit so
// the page-level autosave picks it up without waiting for blur — the caret is
// left alone because the DOM is only seeded once on mount.
export function PointEditor({
  initial,
  dark,
  onCommit,
  onLiveCommit,
  registerFlush,
  onSplit,
  onIndent,
  onOutdent,
  onDeleteEmpty,
}: {
  initial: string;
  dark?: boolean;
  onCommit: (text: string) => void;
  onLiveCommit?: (text: string) => void;
  // Register a flush that commits the current text without exiting edit mode.
  registerFlush?: (flush: () => void) => () => void;
  // Enter at the end of the text: commit this point, then create a sibling
  // below and focus it. Receives the committed text.
  onSplit?: (text: string) => void;
  // Tab / Shift+Tab: re-nest this point one level without leaving edit mode.
  onIndent?: () => void;
  onOutdent?: () => void;
  // Backspace in an empty point: delete it and focus the previous point.
  onDeleteEmpty?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const done = useRef(false);
  const liveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Latest onLiveCommit, so the once-registered flush always calls the current
  // closure (fresh refs) rather than the one from edit-start.
  const liveRef = useRef(onLiveCommit);
  liveRef.current = onLiveCommit;

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

  // Push the current text up now (used by debounced input + the flush hook).
  const pushLive = () => {
    if (liveTimer.current) clearTimeout(liveTimer.current);
    liveTimer.current = null;
    liveRef.current?.(ref.current?.textContent ?? "");
  };

  // Register a flush for note-switch / app-quit; unregister on unmount.
  useEffect(() => {
    if (!registerFlush) return;
    return registerFlush(pushLive);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registerFlush]);

  const commit = () => {
    if (liveTimer.current) clearTimeout(liveTimer.current);
    if (done.current) return;
    done.current = true;
    onCommit(ref.current?.textContent ?? "");
  };

  // True when the caret is collapsed at the very end of the text — used to
  // decide whether Enter splits into a new sibling vs. inserts a newline.
  const caretAtEnd = () => {
    const el = ref.current;
    const sel = window.getSelection();
    if (!el || !sel || sel.rangeCount === 0 || !sel.isCollapsed) return false;
    const r = sel.getRangeAt(0).cloneRange();
    r.selectNodeContents(el);
    r.setStart(sel.getRangeAt(0).endContainer, sel.getRangeAt(0).endOffset);
    return r.toString().length === 0;
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
      onInput={() => {
        if (!onLiveCommit) return;
        if (liveTimer.current) clearTimeout(liveTimer.current);
        liveTimer.current = setTimeout(pushLive, 500);
      }}
      onKeyDown={(e) => {
        handleExpansionKey(e);
        const text = ref.current?.textContent ?? "";
        if (e.key === "Enter") {
          e.preventDefault();
          // At the end of a point, Enter commits and spawns a sibling below;
          // otherwise it just commits/exits like before.
          if (onSplit && caretAtEnd()) {
            if (liveTimer.current) clearTimeout(liveTimer.current);
            done.current = true; // suppress the blur re-commit
            onSplit(text);
          } else {
            ref.current?.blur();
          }
        } else if (e.key === "Tab") {
          e.preventDefault();
          // Re-nesting keeps the caret; push current text up first so the
          // tree mutation doesn't drop an un-committed edit.
          pushLive();
          if (e.shiftKey) onOutdent?.();
          else onIndent?.();
        } else if (e.key === "Backspace" && text.length === 0 && onDeleteEmpty) {
          e.preventDefault();
          if (liveTimer.current) clearTimeout(liveTimer.current);
          done.current = true; // this point is going away — don't commit it
          onDeleteEmpty();
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
