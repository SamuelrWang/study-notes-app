import type { Note, VerseRef } from "./types";
import { refToKey } from "@/features/bible/lookup";

// Set the text of every verse line in a note that resolves to the given
// verse-bank key — scripture-reading pills and all outline refs. Keeps every
// occurrence of a verse identical the moment one of them is edited.
export function applyBankText(note: Note, key: string, text: string): Note {
  const next = structuredClone(note);
  const setIn = (refs: VerseRef[] | undefined) => {
    for (const r of refs ?? [])
      for (const line of r.verses) if (refToKey(line.ref) === key) line.text = text;
  };
  setIn(next.scriptureParts);
  const walk = (points: Note["outline"]) => {
    for (const p of points ?? []) {
      setIn(p.refs);
      walk(p.children);
    }
  };
  walk(next.outline);
  for (const q of next.questions ?? []) {
    setIn(q.refs);
    setIn(q.answerRefs);
  }
  return next;
}
