import { promises as fs } from "node:fs";
import path from "node:path";
import type { Index, Note } from "@/features/notes/types";
import { DATA_DIR } from "./data-dir";

// All note data lives under DATA_DIR (see data-dir.ts). Local-only.
const NOTES_DIR = path.join(DATA_DIR, "notes");
const INDEX_PATH = path.join(DATA_DIR, "index.json");

async function ensureDirs() {
  await fs.mkdir(NOTES_DIR, { recursive: true });
}

export async function readIndex(): Promise<Index> {
  await ensureDirs();
  try {
    const raw = await fs.readFile(INDEX_PATH, "utf8");
    return JSON.parse(raw) as Index;
  } catch {
    const empty: Index = { folders: [] };
    await writeIndex(empty);
    return empty;
  }
}

export async function writeIndex(index: Index): Promise<void> {
  await ensureDirs();
  await fs.writeFile(INDEX_PATH, JSON.stringify(index, null, 2), "utf8");
}

export async function readNote(id: string): Promise<Note | null> {
  try {
    const raw = await fs.readFile(path.join(NOTES_DIR, `${id}.json`), "utf8");
    return JSON.parse(raw) as Note;
  } catch {
    return null;
  }
}

export async function writeNote(note: Note): Promise<void> {
  await ensureDirs();
  await fs.writeFile(
    path.join(NOTES_DIR, `${note.id}.json`),
    JSON.stringify(note, null, 2),
    "utf8",
  );
}

export async function deleteNoteFile(id: string): Promise<void> {
  try {
    await fs.unlink(path.join(NOTES_DIR, `${id}.json`));
  } catch {
    // already gone — fine
  }
}
