import { NextResponse } from "next/server";
import { readIndex, writeIndex } from "@/lib/storage";
import type { Folder } from "@/features/notes/types";

export async function POST(req: Request) {
  const { name } = (await req.json()) as { name?: string };
  const index = await readIndex();
  const folder: Folder = {
    id: crypto.randomUUID(),
    name: (name || "New Folder").trim() || "New Folder",
    notes: [],
  };
  index.folders.push(folder);
  await writeIndex(index);
  return NextResponse.json(folder);
}
