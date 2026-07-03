import type { ShortcutRule } from "./types";

// Auto-expansion of typing shortcuts ("NJ" -> "New Jerusalem"). A rule fires
// only at word-commit time — when a boundary key (space, Enter, punctuation)
// is pressed — and only if the whole token behind the caret exactly equals
// the trigger, case-sensitively. "Xylephone" never matches "X": the token is
// the full word, and a mid-word caret has no boundary on its left.
//
// Rules live in a module-level store so every editor shares one source of
// truth without prop-drilling; page.tsx loads them from settings.

let rules: ShortcutRule[] = [];

export function setExpansionRules(next: ShortcutRule[]) {
  rules = next.filter((r) => r.trigger.trim() && r.replacement);
}

// Keys that commit a word. Typing any of these checks the token just behind
// the caret. The key itself still inserts normally after the expansion.
const BOUNDARY_KEYS = new Set([
  " ", "Enter", ".", ",", ";", ":", "!", "?", ")", "]", "}", '"', "'",
]);

// Characters that delimit a token on its left (plus start-of-text).
const LEFT_BOUNDARY = /[\s.,;:!?()[\]{}"'«»–—]/;

// Call from a contentEditable's onKeyDown, before other handling. Returns
// true if an expansion was applied (an input event fires automatically).
export function handleExpansionKey(e: React.KeyboardEvent<HTMLElement>): boolean {
  if (rules.length === 0 || !BOUNDARY_KEYS.has(e.key)) return false;
  const sel = window.getSelection();
  if (!sel || !sel.isCollapsed || sel.rangeCount === 0) return false;

  const range = sel.getRangeAt(0);
  const node = range.startContainer;
  if (node.nodeType !== Node.TEXT_NODE) return false;

  const text = node.textContent ?? "";
  const caret = range.startOffset;
  let start = caret;
  while (start > 0 && !LEFT_BOUNDARY.test(text[start - 1])) start--;
  const token = text.slice(start, caret);
  if (!token) return false;

  const rule = rules.find((r) => r.trigger === token); // exact, case-sensitive
  if (!rule) return false;

  // Select the token and replace via execCommand so ⌘Z undoes it in one step.
  const tokenRange = document.createRange();
  tokenRange.setStart(node, start);
  tokenRange.setEnd(node, caret);
  sel.removeAllRanges();
  sel.addRange(tokenRange);
  document.execCommand("insertText", false, rule.replacement);
  return true;
}

// Same logic for a <textarea> (the note title). Returns the new value, or
// null if nothing expanded; the caller feeds it back through React state.
export function handleTextareaExpansionKey(
  e: React.KeyboardEvent<HTMLTextAreaElement>,
): string | null {
  if (rules.length === 0 || !BOUNDARY_KEYS.has(e.key)) return null;
  const el = e.currentTarget;
  if (el.selectionStart !== el.selectionEnd) return null;

  const caret = el.selectionStart;
  const text = el.value;
  let start = caret;
  while (start > 0 && !LEFT_BOUNDARY.test(text[start - 1])) start--;
  const token = text.slice(start, caret);
  if (!token) return null;

  const rule = rules.find((r) => r.trigger === token);
  if (!rule) return null;

  el.setRangeText(rule.replacement, start, caret, "end");
  return el.value;
}
