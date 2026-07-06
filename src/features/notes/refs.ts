import type { TextPart, VerseRef, VerseLine } from "./types";
import { bankClient } from "@/features/bible/bank-client";
import { findBook } from "@/features/bible/lookup";

// A single citation ("Book Ch:V", "Ch:V", or bare "V"), with letter suffixes
// and ranges preserved. The chapter/verse groups keep their raw text so the
// pill label reads exactly as written ("1:20-21a").
const CITATION_RE =
  /^\s*(?<book>(?:[1-3]\s*)?[A-Za-z][A-Za-z.]*(?:\s+[A-Za-z][A-Za-z.]*)*\s+)?(?<chapter>\d+)\s*:\s*(?<rest>\d+[a-c]?(?:\s*[-–]\s*\d+[a-c]?)?)\s*$/;
// A verse-only fragment ("17", "10b-11") — inherits book+chapter from context.
const VERSE_ONLY_RE = /^\s*(?<rest>\d+[a-c]?(?:\s*[-–]\s*\d+[a-c]?)?)\s*$/;

// Split a compound reference string into standalone pill labels using Bible
// citation inheritance. `;` starts a new chapter (or new book when a book name
// precedes it); `,` stays within the current chapter and only changes verses.
//   "Phil. 1:20-21a; 3:9-10"          -> ["Phil. 1:20-21a", "Phil. 3:9-10"]
//   "John 10:10b-11, 17"              -> ["John 10:10b-11", "John 10:17"]
//   "Gal. 2:20; 2 Cor. 4:10-11"       -> ["Gal. 2:20", "2 Cor. 4:10-11"]
// A plain single ref ("Phil. 3:7-10") comes back unchanged as one label.
// Segments that don't parse as citations are left intact (never dropped).
export function splitCompoundRef(label: string): string[] {
  const raw = label.trim();
  if (!raw || (!raw.includes(";") && !raw.includes(","))) return [raw];

  // Split on ; and , but remember which separator preceded each segment.
  const segments: { text: string; sep: ";" | "," | null }[] = [];
  let buf = "";
  let sep: ";" | "," | null = null;
  for (const ch of raw) {
    if (ch === ";" || ch === ",") {
      segments.push({ text: buf, sep });
      buf = "";
      sep = ch;
    } else {
      buf += ch;
    }
  }
  segments.push({ text: buf, sep });

  const out: string[] = [];
  let book = ""; // current book text, e.g. "Phil." (empty until first stated)
  let chapter = ""; // current chapter number as text

  for (const seg of segments) {
    const text = seg.text.trim();
    if (!text) continue;

    const cite = text.match(CITATION_RE);
    if (cite?.groups) {
      const segBook = cite.groups.book?.trim();
      // A book name is only real if it resolves; otherwise treat as verse-only
      // context bleeding in (defensive — shouldn't happen for real refs).
      if (segBook && findBook(segBook)) book = segBook.replace(/\s+/g, " ");
      chapter = cite.groups.chapter;
      out.push(book ? `${book} ${chapter}:${cite.groups.rest}` : `${chapter}:${cite.groups.rest}`);
      continue;
    }

    const vOnly = text.match(VERSE_ONLY_RE);
    if (vOnly?.groups && chapter) {
      // ","-style verse-only fragment: reuse current book + chapter.
      out.push(book ? `${book} ${chapter}:${vOnly.groups.rest}` : `${chapter}:${vOnly.groups.rest}`);
      continue;
    }

    // Unparseable segment — keep it verbatim rather than lose data.
    out.push(text);
  }

  return out.length ? out : [raw];
}

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

// The bare verse-ref strings a label expands to ("John 10:10b-11" ->
// ["John 10:10", "John 10:11"]), without touching any verse-text source.
// Server-safe (no bank access) — used when healing stored compound refs, where
// text is re-filled by the bank on read.
export function expandLabelRefs(label: string): string[] {
  const m = label.match(/^(.+?)\s+(\d+):(\d+)[a-c]?(?:[-–](\d+)[a-c]?)?$/);
  if (!m) return [label];
  const [, book, ch, a, b] = m;
  const start = parseInt(a, 10);
  const end = b ? parseInt(b, 10) : start;
  const out: string[] = [];
  for (let v = start; v <= end && v - start < 200; v++) out.push(`${book} ${ch}:${v}`);
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
    // A compound "[Phil. 1:20-21a; 3:9-10]" becomes several pills, one per
    // standalone citation, with book/chapter inheritance applied.
    for (const label of splitCompoundRef(m[1].trim())) {
      const existing = byLabel.get(label);
      refs.push(
        existing
          ? { label, verses: existing.verses, starred: existing.starred }
          : { label, verses: expandLabel(label) },
      );
      parts.push({ r: refs.length - 1 });
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));

  const textParts = parts.filter((p) => typeof p !== "string" || p.length > 0);
  return { textParts, refs };
}
