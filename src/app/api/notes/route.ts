import { NextResponse } from "next/server";
import { readIndex, writeIndex, writeNote } from "@/lib/storage";
import type { Note } from "@/features/notes/types";

export async function POST(req: Request) {
  const { folderId, title } = (await req.json()) as { folderId?: string; title?: string };
  const index = await readIndex();
  const folder = index.folders.find((f) => f.id === folderId);
  if (!folder) return NextResponse.json({ error: "folder not found" }, { status: 404 });

  const note: Note = {
    id: crypto.randomUUID(),
    title: (title || "Untitled").trim() || "Untitled",
    outline: [],
  };
  await writeNote(note);
  folder.notes.push({ id: note.id, title: note.title });
  await writeIndex(index);
  return NextResponse.json(note);
}
