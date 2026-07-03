import { NextResponse } from "next/server";
import { readIndex, writeIndex, deleteNoteFile } from "@/lib/storage";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  const { name } = (await req.json()) as { name?: string };
  const index = await readIndex();
  const folder = index.folders.find((f) => f.id === id);
  if (!folder) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (typeof name === "string") folder.name = name.trim() || folder.name;
  await writeIndex(index);
  return NextResponse.json(folder);
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const index = await readIndex();
  const folder = index.folders.find((f) => f.id === id);
  if (folder) {
    for (const note of folder.notes) await deleteNoteFile(note.id);
  }
  index.folders = index.folders.filter((f) => f.id !== id);
  await writeIndex(index);
  return NextResponse.json({ ok: true });
}
