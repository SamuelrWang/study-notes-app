import { BIBLE_BOOKS, type BibleBook } from "./structure";

// Book-name matching is forgiving about periods/case/spacing so note refs
// like "Matt. 13:24", "1 Chron. 5:1", or "S.S. 1:2" all resolve.
const norm = (s: string) => s.toLowerCase().replace(/\./g, "").replace(/\s+/g, " ").trim();

const byNorm = new Map<string, BibleBook>();
for (const b of BIBLE_BOOKS) {
  byNorm.set(norm(b.name), b);
  byNorm.set(norm(b.abbrev), b);
}
// alternate names people type
const ALIASES: Record<string, string> = {
  psalm: "psalms",
  ps: "psalms",
  "song of solomon": "song-of-songs",
  sos: "song-of-songs",
  philemon: "philemon",
  "1 thess": "1-thessalonians",
  "2 thess": "2-thessalonians",
};
for (const [alias, id] of Object.entries(ALIASES)) {
  const book = BIBLE_BOOKS.find((b) => b.id === id);
  if (book) byNorm.set(alias, book);
}

export function findBook(bookText: string): BibleBook | null {
  return byNorm.get(norm(bookText)) ?? null;
}

export type ParsedRef = { book: BibleBook; chapter: number; verse: number };

// Parse a single-verse reference ("Rev. 12:5", "1 Cor 15:58a") into its book,
// chapter, and verse. Returns null for anything unrecognized.
export function parseRef(ref: string): ParsedRef | null {
  const m = ref.match(/^(.+?)\s+(\d+):(\d+)/);
  if (!m) return null;
  const book = findBook(m[1]);
  if (!book) return null;
  const chapter = parseInt(m[2], 10);
  const verse = parseInt(m[3], 10);
  if (chapter < 1 || verse < 1) return null;
  return { book, chapter, verse };
}

// Canonical verse-bank key. Book ids are kebab-case so ":" is a safe separator.
export const verseKey = (bookId: string, chapter: number, verse: number) =>
  `${bookId}:${chapter}:${verse}`;

export function refToKey(ref: string): string | null {
  const p = parseRef(ref);
  return p ? verseKey(p.book.id, p.chapter, p.verse) : null;
}
