import { promises as fs } from "node:fs";
import path from "node:path";
import type { Note, TextPart, VerseLine, VerseRef, StudyQuestion, OutlinePoint } from "@/features/notes/types";
import { refToKey } from "@/features/bible/lookup";
import { splitCompoundRef, expandLabelRefs } from "@/features/notes/refs";
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

// --- Self-healing for jumbled compound refs -----------------------------
// Older imports stored a whole compound reference ("Phil. 1:20-21a; 3:9") as a
// single pill, with garbled verse keys. On read we split any such ref into
// several standalone refs (with correct verse keys), re-index the pill markers
// in textParts, and preserve per-verse text that still maps cleanly. The bank
// then re-fills the rest, and the healed shape persists on the next autosave.

const isCompoundLabel = (label: string) => label.includes(";") || label.includes(",");

// Rebuild a (textParts, refs) pair, splitting any compound-label ref into one
// ref per standalone citation and remapping the `{ r }` markers. Returns the
// originals untouched when nothing needs splitting. `null` textParts means the
// caller had none (older data) — we still heal refs and leave parts as given.
function healParts(
  textParts: TextPart[] | undefined,
  refs: VerseRef[] | undefined,
): { textParts: TextPart[] | undefined; refs: VerseRef[] } | null {
  if (!refs || refs.length === 0) return null;
  if (!refs.some((r) => isCompoundLabel(r.label))) return null;

  // Old verse text, keyed by canonical verse key, so split lines that still map
  // to a known verse keep their text (bank fills any that don't).
  const textByKey = new Map<string, string>();
  for (const r of refs)
    for (const line of r.verses ?? []) {
      if (!line.text) continue;
      const key = refToKey(line.ref);
      if (key && !textByKey.has(key)) textByKey.set(key, line.text);
    }

  const newRefs: VerseRef[] = [];
  // old ref index -> the list of new ref indexes it expanded into
  const remap: number[][] = [];
  refs.forEach((ref, oldIdx) => {
    const labels = isCompoundLabel(ref.label) ? splitCompoundRef(ref.label) : [ref.label];
    if (labels.length === 1 && labels[0] === ref.label) {
      remap[oldIdx] = [newRefs.length];
      newRefs.push(ref);
      return;
    }
    const idxs: number[] = [];
    for (const label of labels) {
      const verses: VerseLine[] = expandLabelRefs(label).map((r) => ({
        ref: r,
        text: textByKey.get(refToKey(r) ?? "") ?? "",
      }));
      idxs.push(newRefs.length);
      newRefs.push(ref.starred ? { label, verses, starred: true } : { label, verses });
    }
    remap[oldIdx] = idxs;
  });

  // Re-thread textParts: each pill marker becomes the run of markers it split
  // into. Points/questions that predate textParts get a rebuilt parts list.
  let newParts: TextPart[] | undefined;
  if (textParts && textParts.length) {
    newParts = [];
    for (const p of textParts) {
      if (typeof p === "string") newParts.push(p);
      else for (const ni of remap[p.r] ?? []) newParts.push({ r: ni });
    }
  } else {
    newParts = newRefs.map((_, i) => ({ r: i }));
  }

  return { textParts: newParts, refs: newRefs };
}

function healPoints(points: OutlinePoint[] | undefined) {
  for (const p of points ?? []) {
    const healed = healParts(p.textParts, p.refs);
    if (healed) {
      p.refs = healed.refs;
      if (healed.textParts) p.textParts = healed.textParts;
    }
    healPoints(p.children);
  }
}

function healQuestion(q: StudyQuestion) {
  const t = healParts(q.textParts, q.refs);
  if (t) {
    q.refs = t.refs;
    if (t.textParts) q.textParts = t.textParts;
  }
  const a = healParts(q.answerParts, q.answerRefs);
  if (a) {
    q.answerRefs = a.refs;
    if (a.textParts) q.answerParts = a.textParts;
  }
}

// Split any stored compound refs across a whole note. Mutates in place.
export function healCompoundRefs(note: Note): Note {
  const sr = healParts(undefined, note.scriptureParts);
  if (sr) note.scriptureParts = sr.refs;
  healPoints(note.outline);
  for (const q of note.questions ?? []) healQuestion(q);
  return note;
}

// Copy bank text into a note's verse lines (bank is canonical on read).
// Returns the same note object, mutated.
export function hydrateNote(note: Note, bank: VerseBank): Note {
  // Heal jumbled compound pills first, so the freshly-split refs get their
  // verse text filled from the bank in the same pass.
  healCompoundRefs(note);
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
