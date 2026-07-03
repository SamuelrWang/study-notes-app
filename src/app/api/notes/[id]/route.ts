import { NextResponse } from "next/server";
import { readIndex, writeIndex, readNote, writeNote, deleteNoteFile } from "@/lib/storage";
import { readBank, writeBank, hydrateNote, absorbNote } from "@/lib/verse-bank";
import type { Note } from "@/features/notes/types";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const note = await readNote(id);
  if (!note) return NextResponse.json({ error: "not found" }, { status: 404 });
  // Verse bank is canonical on read — fills blanks and picks up edits made
  // from other notes or the bank page since this note was last saved.
  return NextResponse.json(hydrateNote(note, await readBank()));
}

// Full save of a note (title + outline). Used by autosave.
export async function PUT(req: Request, { params }: Ctx) {
  const { id } = await params;
  const body = (await req.json()) as Note;
  const note: Note = { ...body, id };
  // The note is canonical on write — its typed verse text updates the bank.
  const bank = await readBank();
  if (absorbNote(note, bank)) await writeBank(bank);
  await writeNote(note);

  // keep the title in the index tree in sync
  const index = await readIndex();
  for (const folder of index.folders) {
    const ref = folder.notes.find((n) => n.id === id);
    if (ref) {
      ref.title = note.title;
      break;
    }
  }
  await writeIndex(index);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  await deleteNoteFile(id);
  const index = await readIndex();
  for (const folder of index.folders) {
    folder.notes = folder.notes.filter((n) => n.id !== id);
  }
  await writeIndex(index);
  return NextResponse.json({ ok: true });
}
