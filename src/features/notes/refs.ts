import type { TextPart, VerseRef, VerseLine } from "./types";
import { bankClient } from "@/features/bible/bank-client";

// Expand a reference label ("Matt. 13:24-30") into verse lines. Verses the
// user has already typed anywhere land in the verse bank, so new refs start
// pre-filled from it; unknown verses start blank — fillable in the bottom
// tab. Existing refs keep their text (see parseEditedText).
export function expandLabel(label: string): VerseLine[] {
  const m = label.match(/^(.+?)\s+(\d+):(\d+)[a-c]?(?:[-–](\d+)[a-c]?)?$/);
  if (!m) return [{ ref: label, text: bankClient.get(label) }];
  const [, book, ch, a, b] = m;
  const start = parseInt(a, 10);
  const end = b ? parseInt(b, 10) : start;
  const out: VerseLine[] = [];
  for (let v = start; v <= end && v - start < 200; v++) {
    const ref = `${book} ${ch}:${v}`;
    out.push({ ref, text: bankClient.get(ref) });
  }
  return out;
}

// The editable plain-text form of a point: pills become "[Label]".
export function partsToEditable(textParts: TextPart[], refs: VerseRef[]): string {
  return textParts
    .map((p) => (typeof p === "string" ? p : `[${refs[p.r]?.label ?? ""}]`))
    .join("");
}

// Parse edited text back into parts + refs. "[Label]" becomes a pill; an
// unchanged label reuses its old verses/star, a new one is expanded empty.
export function parseEditedText(
  text: string,
  oldRefs: VerseRef[],
): { textParts: TextPart[]; refs: VerseRef[] } {
  const byLabel = new Map<string, VerseRef>();
  for (const r of oldRefs) if (!byLabel.has(r.label)) byLabel.set(r.label, r);

  const parts: TextPart[] = [];
  const refs: VerseRef[] = [];
  const re = /\[([^\]]+)\]/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const label = m[1].trim();
    const existing = byLabel.get(label);
    refs.push(
      existing
        ? { label, verses: existing.verses, starred: existing.starred }
        : { label, verses: expandLabel(label) },
    );
    parts.push({ r: refs.length - 1 });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));

  const textParts = parts.filter((p) => typeof p !== "string" || p.length > 0);
  return { textParts, refs };
}
