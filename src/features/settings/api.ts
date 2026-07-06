import type { Settings } from "./types";
import type { VerseBank } from "@/features/bible/bank-client";

async function j<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

// Like j(), but surfaces the server's {error} message so backup fs failures
// (permission, missing volume) reach the UI verbatim instead of "500".
async function jm<T>(res: Response): Promise<T> {
  const data = (await res.json().catch(() => null)) as T & { error?: string };
  if (!res.ok) throw new Error(data?.error || `${res.status} ${res.statusText}`);
  return data as T;
}

export type SnapshotInfo = { name: string; date: string };
export type BackupStatus = {
  folder: string;
  lastBackupAt: string | null;
  snoozeUntil: string | null;
  snapshots: SnapshotInfo[];
  needed: boolean;
  reason: string;
};

export const backupApi = {
  status: () => fetch("/api/backup").then((r) => jm<BackupStatus>(r)),

  run: (folder?: string) =>
    fetch("/api/backup", {
      method: "POST",
      body: JSON.stringify({ action: "run", folder }),
    }).then((r) => jm<BackupStatus>(r)),

  snooze: () =>
    fetch("/api/backup", {
      method: "POST",
      body: JSON.stringify({ action: "snooze" }),
    }).then((r) => jm<BackupStatus>(r)),

  setFolder: (folder: string) =>
    fetch("/api/backup", {
      method: "POST",
      body: JSON.stringify({ action: "setFolder", folder }),
    }).then((r) => jm<BackupStatus>(r)),

  restore: (snapshot: string) =>
    fetch("/api/backup", {
      method: "POST",
      body: JSON.stringify({ action: "restore", snapshot }),
    }).then((r) => jm<BackupStatus>(r)),
};

export const settingsApi = {
  get: () => fetch("/api/settings").then((r) => j<Settings>(r)),

  save: (settings: Settings) =>
    fetch("/api/settings", { method: "PUT", body: JSON.stringify(settings) }).then((r) => j(r)),

  getBank: () => fetch("/api/verse-bank").then((r) => j<VerseBank>(r)),

  // Bulk verse upsert; empty text deletes the entry.
  saveBank: (updates: Record<string, string>) =>
    fetch("/api/verse-bank", { method: "PUT", body: JSON.stringify(updates) }).then((r) => j(r)),
};
