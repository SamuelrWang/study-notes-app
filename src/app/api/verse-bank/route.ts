import { NextResponse } from "next/server";
import { readBank, writeBank } from "@/lib/verse-bank";

export async function GET() {
  return NextResponse.json(await readBank());
}

// Bulk upsert from the Verse Bank page: { "<bookId>:<ch>:<v>": "<html>" }.
// Empty text deletes the entry. Notes pick the change up on their next load
// (reads hydrate from the bank).
export async function PUT(req: Request) {
  const updates = (await req.json()) as Record<string, string>;
  const bank = await readBank();
  for (const [key, text] of Object.entries(updates)) {
    if (text && text.replace(/<[^>]*>/g, "").trim()) bank[key] = text;
    else delete bank[key];
  }
  await writeBank(bank);
  return NextResponse.json({ ok: true });
}
