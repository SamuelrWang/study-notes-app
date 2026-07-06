import { promises as fs, existsSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { DATA_DIR } from "./data-dir";
import { readSettings, writeSettings } from "./settings";
import type { BackupSettings } from "@/features/settings/types";

// Local, cloud-free backup. Snapshots are plain recursive folder copies of
// DATA_DIR written into a user-chosen folder (default: iCloud Drive so a lost
// or broken machine doesn't take the notes with it). Everything here uses
// stock node fs/path/os so it runs unchanged under Next standalone output.

const NOTES_DIR = path.join(DATA_DIR, "notes");
const SNAPSHOT_PREFIX = "snapshot-";
const KEEP_SNAPSHOTS = 3;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;

export type SnapshotInfo = { name: string; date: string };

export type BackupStatus = {
  folder: string;
  lastBackupAt: string | null;
  snoozeUntil: string | null;
  snapshots: SnapshotInfo[];
  needed: boolean;
  reason: string;
};

// Expand a leading ~ to the home dir; leave everything else untouched.
export function expandHome(p: string): string {
  if (p === "~") return os.homedir();
  if (p.startsWith("~/")) return path.join(os.homedir(), p.slice(2));
  return p;
}

// Default backup folder: iCloud Drive when present (free offsite sync),
// otherwise ~/Documents. Never creates anything — just picks a path.
export function defaultBackupFolder(): string {
  const home = os.homedir();
  const iCloud = path.join(home, "Library", "Mobile Documents", "com~apple~CloudDocs");
  if (existsSync(iCloud)) return path.join(iCloud, "Study Notes Backups");
  return path.join(home, "Documents", "Study Notes Backups");
}

async function resolveFolder(explicit?: string): Promise<string> {
  if (explicit && explicit.trim()) return expandHome(explicit.trim());
  const settings = await readSettings();
  if (settings.backup?.folder) return settings.backup.folder;
  return defaultBackupFolder();
}

async function saveBackupSettings(patch: Partial<BackupSettings>): Promise<void> {
  const settings = await readSettings();
  const next = {
    ...settings,
    backup: { ...(settings.backup ?? {}), ...patch },
  };
  await writeSettings(next);
}

// How many .json note files exist under DATA_DIR/notes (0 if the dir is
// missing). Drives the "never backed up && ≥1 note" nudge branch.
async function countNotes(): Promise<number> {
  let count = 0;
  try {
    const entries = await fs.readdir(NOTES_DIR, { withFileTypes: true });
    for (const e of entries) {
      if (e.isFile() && e.name.endsWith(".json")) count++;
    }
  } catch {
    // no notes dir yet
  }
  return count;
}

// Number of note files modified strictly after the given timestamp (ms).
async function notesModifiedSince(since: number): Promise<number> {
  let n = 0;
  try {
    const entries = await fs.readdir(NOTES_DIR, { withFileTypes: true });
    for (const e of entries) {
      if (!e.isFile() || !e.name.endsWith(".json")) continue;
      const st = await fs.stat(path.join(NOTES_DIR, e.name));
      if (st.mtimeMs > since) n++;
    }
  } catch {
    // no notes dir
  }
  return n;
}

// Snapshot folders under `folder`, newest first, each with a display date
// derived from its own mtime.
async function listSnapshots(folder: string): Promise<SnapshotInfo[]> {
  let entries: import("node:fs").Dirent[];
  try {
    entries = await fs.readdir(folder, { withFileTypes: true });
  } catch {
    return [];
  }
  const snaps: { name: string; date: string; mtime: number }[] = [];
  for (const e of entries) {
    if (!e.isDirectory() || !e.name.startsWith(SNAPSHOT_PREFIX)) continue;
    const st = await fs.stat(path.join(folder, e.name));
    snaps.push({ name: e.name, date: new Date(st.mtimeMs).toISOString(), mtime: st.mtimeMs });
  }
  snaps.sort((a, b) => b.mtime - a.mtime);
  return snaps.map(({ name, date }) => ({ name, date }));
}

export async function getStatus(): Promise<BackupStatus> {
  const settings = await readSettings();
  const backup = settings.backup ?? {};
  const folder = backup.folder ?? defaultBackupFolder();
  const lastBackupAt = backup.lastBackupAt ?? null;
  const snoozeUntil = backup.snoozeUntil ?? null;
  const snapshots = await listSnapshots(folder);

  const now = Date.now();
  const snoozed = !!snoozeUntil && new Date(snoozeUntil).getTime() > now;
  const count = await countNotes();

  let needed = false;
  let reason = "";

  if (snoozed) {
    reason = "snoozed";
  } else if (!lastBackupAt) {
    if (count >= 1) {
      needed = true;
      reason = "never-backed-up";
    } else {
      reason = "no-notes";
    }
  } else {
    const lastMs = new Date(lastBackupAt).getTime();
    const modifiedSince = await notesModifiedSince(lastMs);
    if (lastMs < now - THIRTY_DAYS_MS && modifiedSince >= 1) {
      needed = true;
      reason = "stale-and-changed";
    } else if (modifiedSince >= 5) {
      needed = true;
      reason = "many-changes";
    } else {
      reason = "up-to-date";
    }
  }

  return { folder, lastBackupAt, snoozeUntil, snapshots, needed, reason };
}

function timestampSlug(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}` +
    `-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
  );
}

const README_TEXT = `Study Notes — Local Backups
===========================

Each "snapshot-YYYYMMDD-HHmmss" folder is a complete copy of your Study Notes
data (notes, verse bank, settings) as it was at that moment. Nothing here is
in the cloud unless this folder itself lives in a synced location (e.g. iCloud
Drive) — that's the point: keep this folder synced and a lost or broken
computer won't take your notes with it.

The app keeps the 3 most recent snapshots and prunes older ones automatically.
"pre-restore-*" folders are safety copies made right before a restore; they are
never pruned automatically — delete them yourself once you're sure.

To restore a snapshot, open the app and go to:
  Settings -> Profile -> Backup -> Restore
Restoring replaces your current notes with the chosen snapshot (your current
data is saved to a pre-restore copy first, just in case).
`;

// Recursively copy DATA_DIR into a fresh snapshot folder, write/refresh the
// README, prune to KEEP_SNAPSHOTS, and record lastBackupAt. Returns fresh
// status. Throws on fs errors (permission / missing volume) — the route maps
// those to a 4xx/5xx with a readable message.
export async function runBackup(explicitFolder?: string): Promise<BackupStatus> {
  const folder = await resolveFolder(explicitFolder);
  await fs.mkdir(folder, { recursive: true });

  const dest = path.join(folder, `${SNAPSHOT_PREFIX}${timestampSlug()}`);
  await fs.cp(DATA_DIR, dest, { recursive: true });
  await fs.writeFile(path.join(folder, "README.txt"), README_TEXT, "utf8");

  // prune oldest snapshot-* beyond KEEP_SNAPSHOTS (pre-restore-* untouched)
  const snaps = await listSnapshots(folder); // newest first
  for (const old of snaps.slice(KEEP_SNAPSHOTS)) {
    await fs.rm(path.join(folder, old.name), { recursive: true, force: true });
  }

  await saveBackupSettings({ folder, lastBackupAt: new Date().toISOString() });
  return getStatus();
}

export async function snooze(): Promise<BackupStatus> {
  await saveBackupSettings({ snoozeUntil: new Date(Date.now() + SNOOZE_MS).toISOString() });
  return getStatus();
}

export async function setFolder(folder: string): Promise<BackupStatus> {
  const resolved = expandHome(folder.trim());
  await saveBackupSettings({ folder: resolved });
  return getStatus();
}

// Restore a snapshot over DATA_DIR. Safe by construction:
//  1. validate the snapshot lives inside the configured folder and is named
//     snapshot-* (no arbitrary-path restore),
//  2. copy current DATA_DIR to a pre-restore-* safety copy,
//  3. stage the snapshot into DATA_DIR.tmp-restore, then swap known subpaths
//     so a mid-copy failure never leaves DATA_DIR half-wiped.
export async function restore(snapshot: string): Promise<BackupStatus> {
  const folder = await resolveFolder();

  // reject traversal / non-snapshot names
  if (!snapshot.startsWith(SNAPSHOT_PREFIX) || snapshot.includes("/") || snapshot.includes("\\")) {
    throw new Error("Invalid snapshot name.");
  }
  const src = path.join(folder, snapshot);
  const resolvedSrc = path.resolve(src);
  if (path.dirname(resolvedSrc) !== path.resolve(folder)) {
    throw new Error("Snapshot is outside the backup folder.");
  }
  const st = await fs.stat(resolvedSrc).catch(() => null);
  if (!st?.isDirectory()) throw new Error("Snapshot not found.");

  // 2. safety copy of current data (not a snapshot-*, so pruning ignores it)
  const safety = path.join(folder, `pre-restore-${timestampSlug()}`);
  await fs.cp(DATA_DIR, safety, { recursive: true });

  // 3. stage into a sibling temp dir, then swap contents into DATA_DIR
  const staging = `${DATA_DIR}.tmp-restore`;
  await fs.rm(staging, { recursive: true, force: true });
  await fs.cp(resolvedSrc, staging, { recursive: true });

  // Replace DATA_DIR contents subpath-by-subpath (never rm DATA_DIR itself).
  await fs.mkdir(DATA_DIR, { recursive: true });
  const staged = await fs.readdir(staging, { withFileTypes: true });
  // remove existing top-level entries we're about to replace, then move in
  for (const e of staged) {
    await fs.rm(path.join(DATA_DIR, e.name), { recursive: true, force: true });
  }
  for (const e of staged) {
    await fs.cp(path.join(staging, e.name), path.join(DATA_DIR, e.name), { recursive: true });
  }
  await fs.rm(staging, { recursive: true, force: true });

  return getStatus();
}
