import { NextResponse } from "next/server";
import { getStatus, runBackup, snooze, setFolder, restore } from "@/lib/backup";

// Local backup control surface. GET → status (used by the profile page and the
// nudge banner). POST → run / snooze / setFolder / restore. fs errors surface
// as a 4xx/5xx with a human-readable message the UI shows verbatim.

export async function GET() {
  try {
    return NextResponse.json(await getStatus());
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

type Body =
  | { action: "run"; folder?: string }
  | { action: "snooze" }
  | { action: "setFolder"; folder: string }
  | { action: "restore"; snapshot: string };

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  try {
    switch (body.action) {
      case "run":
        return NextResponse.json(await runBackup(body.folder));
      case "snooze":
        return NextResponse.json(await snooze());
      case "setFolder":
        if (!body.folder?.trim())
          return NextResponse.json({ error: "Folder is required." }, { status: 400 });
        return NextResponse.json(await setFolder(body.folder));
      case "restore":
        if (!body.snapshot)
          return NextResponse.json({ error: "Snapshot is required." }, { status: 400 });
        return NextResponse.json(await restore(body.snapshot));
      default:
        return NextResponse.json({ error: "Unknown action." }, { status: 400 });
    }
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    const msg = err.message || "Backup failed.";
    // The user's-to-fix failures → 400: validation (plain Error, no code) and
    // permission / missing-volume fs errors. Anything else is a real 500.
    const userFixable =
      !err.code ||
      ["EACCES", "EPERM", "ENOENT", "EROFS", "ENOSPC", "ENOTDIR"].includes(err.code);
    return NextResponse.json({ error: msg }, { status: userFixable ? 400 : 500 });
  }
}
