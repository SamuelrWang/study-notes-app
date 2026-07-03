import { NextResponse } from "next/server";
import { readIndex } from "@/lib/storage";

export async function GET() {
  const index = await readIndex();
  return NextResponse.json(index);
}
