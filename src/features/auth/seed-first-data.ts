import { api } from "@/features/notes/api";

// After a fresh sign-UP that lands the user straight in, give them something
// to look at instead of an empty screen: one folder with one note, then open
// it. Data is local-per-machine — the emptiness check is the guard, so a
// signup on a machine that already has notes seeds nothing, and a double call
// is a no-op (the folder created by the first call makes the index non-empty).
//
// Fails silently: any fetch error just drops the user into the normal empty
// state rather than blocking login.
export async function seedFirstDataIfEmpty(): Promise<void> {
  try {
    const index = await api.getIndex();
    const hasFolders = index.folders.length > 0;
    const hasNotes = index.folders.some((f) => f.notes.length > 0);
    if (hasFolders || hasNotes) return;

    const folder = await api.createFolder("Untitled Folder");
    const note = await api.createNote(folder.id, "New Note");

    // The URL is the source of truth for the open note (/f/<folderId>/n/<noteId>).
    // A full navigation lands on the note regardless of auth-gate remount timing.
    window.location.assign(`/f/${folder.id}/n/${note.id}`);
  } catch {
    // Seeding is best-effort — never block sign-in on it.
  }
}
