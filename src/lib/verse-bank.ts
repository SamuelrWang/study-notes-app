import { promises as fs } from "node:fs";
import path from "node:path";
import type { Note, VerseLine, VerseRef } from "@/features/notes/types";
import { refToKey } from "@/features/bible/lookup";
import { readIndex, readNote } from "./storage";
import { DATA_DIR } from "./data-dir";

// The verse bank: one canonical text per verse, shared by every note.
// Persisted as data/verse-bank.json — { "<bookId>:<ch>:<v>": "<verse html>" }.
// Notes remain the write path (saving a note upserts its verses here) and the
// bank is the read path (loading a note hydrates verse text from here), so
// note files are never bulk-rewritten.

export type VerseBank = Record<string, string>;

const BANK_PATH = path.join(DATA_DIR, "verse-bank.json");

// Walk every verse line in a note (scripture-reading pills, outline refs,
// and study-question refs).
function* verseLines(note: Note): Generator<VerseLine> {
  function* walkRefs(refs: VerseRef[] | undefined): Generator<VerseLine> {
    for (const r of refs ?? []) yield* r.verses;
  }
  function* walkPoints(points: Note["outline"]): Generator<VerseLine> {
    for (const p of points ?? []) {
      yield* walkRefs(p.refs);
      yield* walkPoints(p.children);
    }
  }
  yield* walkRefs(note.scriptureParts);
  yield* walkPoints(note.outline);
  for (const q of note.questions ?? []) {
    yield* walkRefs(q.refs);
    yield* walkRefs(q.answerRefs);
  }
}

const hasText = (line: VerseLine) => !!line.text && !!line.text.replace(/<[^>]*>/g, "").trim();

export async function readBank(): Promise<VerseBank> {
  try {
    return JSON.parse(await fs.readFile(BANK_PATH, "utf8")) as VerseBank;
  } catch {
    // First run: seed the bank from every verse already typed into notes.
    const bank = await seedFromNotes();
    await writeBank(bank);
    return bank;
  }
}

export async function writeBank(bank: VerseBank): Promise<void> {
  await fs.mkdir(path.dirname(BANK_PATH), { recursive: true });
  await fs.writeFile(BANK_PATH, JSON.stringify(bank, null, 2), "utf8");
}

async function seedFromNotes(): Promise<VerseBank> {
  const bank: VerseBank = {};
  const index = await readIndex();
  for (const folder of index.folders) {
    for (const ref of folder.notes) {
      const note = await readNote(ref.id);
      if (!note) continue;
      for (const line of verseLines(note)) {
        if (!hasText(line)) continue;
        const key = refToKey(line.ref);
        if (key && !bank[key]) bank[key] = line.text;
      }
    }
  }
  return bank;
}

// Copy bank text into a note's verse lines (bank is canonical on read).
// Returns the same note object, mutated.
export function hydrateNote(note: Note, bank: VerseBank): Note {
  for (const line of verseLines(note)) {
    const key = refToKey(line.ref);
    if (key && bank[key] !== undefined && bank[key] !== line.text) line.text = bank[key];
  }
  return note;
}

// Absorb a just-saved note's verse text into the bank (note is canonical on
// write). Clearing a line does NOT clear the bank — deletion is explicit,
// from the Verse Bank page. Returns true if the bank changed.
export function absorbNote(note: Note, bank: VerseBank): boolean {
  let changed = false;
  for (const line of verseLines(note)) {
    if (!hasText(line)) continue;
    const key = refToKey(line.ref);
    if (key && bank[key] !== line.text) {
      bank[key] = line.text;
      changed = true;
    }
  }
  return changed;
}
