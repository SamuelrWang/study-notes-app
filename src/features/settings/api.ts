import type { Settings } from "./types";
import type { VerseBank } from "@/features/bible/bank-client";

async function j<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

export const settingsApi = {
  get: () => fetch("/api/settings").then((r) => j<Settings>(r)),

  save: (settings: Settings) =>
    fetch("/api/settings", { method: "PUT", body: JSON.stringify(settings) }).then((r) => j(r)),

  getBank: () => fetch("/api/verse-bank").then((r) => j<VerseBank>(r)),

  // Bulk verse upsert; empty text deletes the entry.
  saveBank: (updates: Record<string, string>) =>
    fetch("/api/verse-bank", { method: "PUT", body: JSON.stringify(updates) }).then((r) => j(r)),
};
