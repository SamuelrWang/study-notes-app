import type { Folder, Index, Note } from "./types";

async function j<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

export const api = {
  getIndex: () => fetch("/api/data").then((r) => j<Index>(r)),

  createFolder: (name: string) =>
    fetch("/api/folders", {
      method: "POST",
      body: JSON.stringify({ name }),
    }).then((r) => j<Folder>(r)),

  renameFolder: (id: string, name: string) =>
    fetch(`/api/folders/${id}`, { method: "PATCH", body: JSON.stringify({ name }) }).then((r) =>
      j<Folder>(r),
    ),

  deleteFolder: (id: string) => fetch(`/api/folders/${id}`, { method: "DELETE" }).then((r) => j(r)),

  createNote: (folderId: string, title: string) =>
    fetch("/api/notes", {
      method: "POST",
      body: JSON.stringify({ folderId, title }),
    }).then((r) => j<Note>(r)),

  getNote: (id: string) => fetch(`/api/notes/${id}`).then((r) => j<Note>(r)),

  saveNote: (note: Note) =>
    fetch(`/api/notes/${note.id}`, { method: "PUT", body: JSON.stringify(note) }).then((r) => j(r)),

  deleteNote: (id: string) => fetch(`/api/notes/${id}`, { method: "DELETE" }).then((r) => j(r)),
};
