"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { usePathname } from "next/navigation";
import type { Index, Note } from "@/features/notes/types";
import { api } from "@/features/notes/api";
import type { TextPart, VerseRef } from "@/features/notes/types";
import {
  addSiblingAfter,
  addTopLevel,
  findByPath,
  flatten,
  fullLabelFor,
  indent,
  outdent,
  prevPointId,
  removeAt,
  setPointParts,
  setVerseText,
  toggleStar,
  updateField,
} from "@/features/notes/outline";
import { newQuestion } from "@/features/notes/questions";
import { Sidebar } from "@/features/notes/components/sidebar";
import { OutlinePanel } from "@/features/notes/components/outline-panel";
import { NotesPanel } from "@/features/notes/components/notes-panel";
import { applyBankText } from "@/features/notes/bank-sync";
import { bankClient } from "@/features/bible/bank-client";
import { refToKey } from "@/features/bible/lookup";
import { settingsApi, backupApi, type BackupStatus } from "@/features/settings/api";
import { setExpansionRules } from "@/features/settings/expansion";
import { DEFAULT_SETTINGS, type Settings } from "@/features/settings/types";
import { SettingsModal } from "@/features/settings/components/settings-modal";
import { DialogHost, uiPrompt } from "@/features/ui/dialogs";
import { AuthGate } from "@/features/auth/auth-gate";
import { getSupabase } from "@/lib/supabase-client";

const samePath = (a: number[] | null, b: number[] | null) =>
  !!a && !!b && a.length === b.length && a.every((v, i) => v === b[i]);

// The URL is the source of truth for the open note: /f/<folderId>/n/<noteId>.
// Ids are the stable UUIDs notes/folders already have, so renaming never
// breaks a link and a reload lands back on the same note.
const noteIdFromPath = (pathname: string): string | null =>
  pathname.match(/^\/f\/[^/]+\/n\/([^/]+)$/)?.[1] ?? null;

const notePath = (folderId: string, noteId: string) => `/f/${folderId}/n/${noteId}`;

export default function Home() {
  const [index, setIndex] = useState<Index | null>(null);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [note, setNote] = useState<Note | null>(null);
  const [selectedPath, setSelectedPath] = useState<number[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [backupNeeded, setBackupNeeded] = useState(false);
  const [backupDismissed, setBackupDismissed] = useState(false);

  // Ask the server once on mount whether a backup is due; the banner shows only
  // when needed and un-dismissed. Failures stay silent (never block the app).
  useEffect(() => {
    backupApi
      .status()
      .then((s: BackupStatus) => setBackupNeeded(s.needed))
      .catch(() => {});
  }, []);

  const refreshIndex = useCallback(async () => {
    setIndex(await api.getIndex());
  }, []);

  useEffect(() => {
    refreshIndex();
  }, [refreshIndex]);

  // Keep the active note in lockstep with the URL — covers initial load,
  // pushState navigation, and the browser back/forward buttons.
  const pathname = usePathname();
  const urlNoteId = noteIdFromPath(pathname);
  useEffect(() => {
    setActiveNoteId(urlNoteId);
  }, [urlNoteId]);

  const openNote = (folderId: string, noteId: string) =>
    window.history.pushState(null, "", notePath(folderId, noteId));
  const closeNote = () => window.history.replaceState(null, "", "/");
  const folderIdOf = (noteId: string) =>
    index?.folders.find((f) => f.notes.some((n) => n.id === noteId))?.id ?? null;
  const onSelectNote = (noteId: string) => {
    const folderId = folderIdOf(noteId);
    if (folderId) openNote(folderId, noteId);
  };

  // Load settings + verse bank once; both feed module-level stores that the
  // editors read (expansion rules, verse auto-fill). Empty profile fields are
  // backfilled from the signed-in account (never overwriting what's set).
  useEffect(() => {
    settingsApi.get().then(async (s) => {
      setSettings(s);
      setExpansionRules(s.shortcuts);
      if (!s.profile.name || !s.profile.email) {
        const { data } = await getSupabase().auth.getSession();
        const user = data.session?.user;
        if (!user) return;
        const profile = {
          ...s.profile,
          name: s.profile.name || (user.user_metadata?.full_name as string) || "",
          email: s.profile.email || user.email || "",
        };
        if (profile.name !== s.profile.name || profile.email !== s.profile.email) {
          const next = { ...s, profile };
          setSettings(next);
          settingsApi.save(next);
        }
      }
    });
    settingsApi.getBank().then((b) => bankClient.setAll(b));
  }, []);

  // Debounced settings save, mirroring the note autosave pattern.
  const settingsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onSettingsChange = (next: Settings) => {
    setSettings(next);
    setExpansionRules(next.shortcuts);
    if (settingsTimer.current) clearTimeout(settingsTimer.current);
    settingsTimer.current = setTimeout(() => settingsApi.save(next), 500);
  };

  // A verse changed on the Verse Bank page — reflect it in the open note.
  const onBankEdit = (key: string, text: string) => {
    if (text.replace(/<[^>]*>/g, "").trim())
      setNote((cur) => (cur ? applyBankText(cur, key, text) : cur));
  };

  // Debounced autosave timer, declared up here so flushPendingSave can fire it
  // early. The effect that arms it lives below (needs the handlers first).
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The note the autosave effect currently holds, so a flush can persist the
  // in-flight value without waiting for the effect to re-run. Kept in a ref so
  // flushPendingSave (below) always sees the latest note without re-binding.
  const noteRef = useRef<Note | null>(null);
  useEffect(() => {
    noteRef.current = note;
  }, [note]);

  // Fire any pending debounced save right now. Called before a note switch and
  // on unload so the previous note lands before the next one loads. Editors
  // flush their in-progress value into note state first (see flushEditors).
  const flushPendingSave = useCallback(() => {
    if (!saveTimer.current) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = null;
    const n = noteRef.current;
    if (n) {
      api.saveNote(n);
      setSaving(false);
    }
  }, []);

  // Editors register a flush callback here while focused; it commits their
  // in-progress raw value into note state. Cleared on blur/commit. A Set so
  // an unexpected double-register can't leak stale flushers. flushSync forces
  // the setNote from each flusher (and the noteRef effect) to land before the
  // caller reads noteRef — so a subsequent save sees the just-typed text.
  const editorFlushers = useRef(new Set<() => void>());
  const flushEditors = useCallback(() => {
    if (editorFlushers.current.size === 0) return;
    flushSync(() => {
      for (const f of editorFlushers.current) f();
    });
  }, []);
  // An editor calls this on focus with its flush fn; the returned unregister
  // runs on blur/unmount. Passed down to PointEditor and the question editors.
  const registerEditorFlush = useCallback((flush: () => void) => {
    editorFlushers.current.add(flush);
    return () => {
      editorFlushers.current.delete(flush);
    };
  }, []);

  // Load the active note's full content.
  const skipNextSave = useRef(false);
  useEffect(() => {
    // Persist the outgoing note before swapping — commit any focused editor's
    // pending text, then fire the pending debounced save synchronously.
    flushEditors();
    flushPendingSave();
    if (!activeNoteId) {
      setNote(null);
      setSelectedPath(null);
      return;
    }
    let live = true;
    api
      .getNote(activeNoteId)
      .then((n) => {
        if (!live) return;
        skipNextSave.current = true; // don't autosave the freshly-loaded note
        setNote(n);
        setSelectedPath(n.outline.length ? [0] : null);
      })
      .catch(() => {
        // stale URL (note deleted elsewhere) — fall back to the root
        if (live) window.history.replaceState(null, "", "/");
        if (live) setActiveNoteId(null);
      });
    return () => {
      live = false;
    };
  }, [activeNoteId]);

  // Debounced autosave whenever the note changes.
  useEffect(() => {
    if (!note) return;
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaving(true);
    saveTimer.current = setTimeout(async () => {
      await api.saveNote(note);
      setSaving(false);
      // keep the left tree title in sync without a full refetch flash
      setIndex((idx) => {
        if (!idx) return idx;
        return {
          folders: idx.folders.map((f) => ({
            ...f,
            notes: f.notes.map((n) => (n.id === note.id ? { ...n, title: note.title } : n)),
          })),
        };
      });
    }, 500);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [note]);

  // No data loss if the app/window is quit mid-edit: commit the focused
  // editor's pending text, then push the note synchronously. A keepalive fetch
  // survives the unload where a normal fetch would be aborted.
  useEffect(() => {
    const onBeforeUnload = () => {
      flushEditors();
      const n = noteRef.current;
      if (!n) return;
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        saveTimer.current = null;
      }
      fetch(`/api/notes/${n.id}`, {
        method: "PUT",
        body: JSON.stringify(n),
        keepalive: true,
      });
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [flushEditors]);

  // ---- structural handlers (left panel) ----
  const onNewFolder = async () => {
    const name = await uiPrompt("New folder", "New Folder", "Create");
    if (name === null) return;
    await api.createFolder(name || "New Folder");
    await refreshIndex();
  };
  const onNewNote = async (folderId: string) => {
    const title = await uiPrompt("New note", "Untitled", "Create");
    if (title === null) return;
    const created = await api.createNote(folderId, title || "Untitled");
    await refreshIndex();
    openNote(folderId, created.id);
  };
  const onRenameFolder = async (id: string, name: string) => {
    await api.renameFolder(id, name);
    await refreshIndex();
  };
  const onDeleteFolder = async (id: string) => {
    await api.deleteFolder(id);
    if (note && index?.folders.find((f) => f.id === id)?.notes.some((n) => n.id === note.id)) {
      closeNote();
      setActiveNoteId(null);
    }
    await refreshIndex();
  };
  const onRenameNote = async (id: string, title: string) => {
    const n = await api.getNote(id);
    await api.saveNote({ ...n, title });
    await refreshIndex();
    if (id === activeNoteId) setNote((cur) => (cur ? { ...cur, title } : cur));
  };
  const onDeleteNote = async (id: string) => {
    await api.deleteNote(id);
    if (id === activeNoteId) {
      closeNote();
      setActiveNoteId(null);
    }
    await refreshIndex();
  };

  // ---- outline handlers (middle panel) ----
  const mutateOutline = (fn: (outline: Note["outline"]) => Note["outline"]) =>
    setNote((cur) => (cur ? { ...cur, outline: fn(cur.outline) } : cur));

  const onTitleChange = (title: string) => setNote((cur) => (cur ? { ...cur, title } : cur));
  const onSpeakerChange = (speaker: string) => setNote((cur) => (cur ? { ...cur, speaker } : cur));
  const onDateChange = (date: string) => setNote((cur) => (cur ? { ...cur, date } : cur));
  const onIntroChange = (introduction: string) =>
    setNote((cur) => (cur ? { ...cur, introduction } : cur));
  // Editing a verse updates every occurrence of it (this note's other points
  // and the scripture-reading pills) plus the client verse bank; the server
  // absorbs it into data/verse-bank.json on autosave. Clearing a line only
  // clears that line — the bank keeps its text.
  const onVerseEdit = (refIndex: number, verseIndex: number, html: string) => {
    if (!selectedPath) return;
    const line = selectedPoint?.refs?.[refIndex]?.verses?.[verseIndex];
    const key = line ? refToKey(line.ref) : null;
    if (key && html.replace(/<[^>]*>/g, "").trim()) {
      bankClient.setByKey(key, html);
      setNote((cur) => (cur ? applyBankText(cur, key, html) : cur));
    } else {
      mutateOutline((o) => setVerseText(o, selectedPath, refIndex, verseIndex, html));
    }
  };
  const onToggleStar = (refIndex: number) =>
    selectedPath && mutateOutline((o) => toggleStar(o, selectedPath, refIndex));

  // ---- study questions ----
  const mutateQuestions = (fn: (qs: NonNullable<Note["questions"]>) => Note["questions"]) =>
    setNote((cur) => (cur ? { ...cur, questions: fn(cur.questions ?? []) } : cur));

  const onAddQuestion = (): string => {
    const q = newQuestion(note?.questions ?? []);
    mutateQuestions((qs) => [...qs, q]);
    return q.id;
  };
  const onQuestionText = (id: string, edit: { textParts: TextPart[]; refs: VerseRef[] }) =>
    mutateQuestions((qs) =>
      qs.map((q) =>
        q.id === id
          ? {
              ...q,
              text: edit.textParts.map((p) => (typeof p === "string" ? p : "")).join(""),
              textParts: edit.textParts,
              refs: edit.refs,
            }
          : q,
      ),
    );
  const onQuestionAnswer = (id: string, edit: { textParts: TextPart[]; refs: VerseRef[] }) =>
    mutateQuestions((qs) =>
      qs.map((q) =>
        q.id === id
          ? {
              ...q,
              answer: edit.textParts.map((p) => (typeof p === "string" ? p : "")).join(""),
              answerParts: edit.textParts,
              answerRefs: edit.refs,
            }
          : q,
      ),
    );
  const onQuestionMove = (id: string, anchorId: string | null) =>
    mutateQuestions((qs) => qs.map((q) => (q.id === id ? { ...q, anchorId } : q)));
  const onQuestionSpan = (id: string, span: number) =>
    // drop the legacy pointIds shape once a span is set
    mutateQuestions((qs) => qs.map((q) => (q.id === id ? { ...q, span, pointIds: undefined } : q)));
  const onQuestionDelete = (id: string) => mutateQuestions((qs) => qs.filter((q) => q.id !== id));

  const pathById = (id: string) =>
    note ? (flatten(note.outline).find((r) => r.point.id === id)?.path ?? null) : null;
  const onEditCommit = (id: string, textParts: TextPart[], refs: VerseRef[]) => {
    const p = pathById(id);
    if (p) mutateOutline((o) => setPointParts(o, p, textParts, refs));
  };
  const onChangeDepth = (id: string, dir: -1 | 1) => {
    const p = pathById(id);
    if (p) mutateOutline((o) => (dir < 0 ? outdent(o, p) : indent(o, p)));
  };

  // ---- manual outline building (no import) ----
  // Append a fresh top-level point and hand its id back so the panel can drop
  // straight into edit mode on it. Reads current outline from noteRef.
  const onCreateFirstPoint = (): string | null => {
    const cur = noteRef.current;
    if (!cur) return null;
    const { outline, id } = addTopLevel(cur.outline);
    setNote((c) => (c ? { ...c, outline } : c));
    return id;
  };
  // Enter at the end of a point: insert a sibling right below it, return its id.
  const onCreateSibling = (afterId: string): string | null => {
    const p = pathById(afterId);
    if (!p) return null;
    const { outline, id } = addSiblingAfter(noteRef.current!.outline, p);
    setNote((c) => (c ? { ...c, outline } : c));
    return id;
  };
  // Backspace in an empty point: remove it, return the id of the point above
  // to focus (null when it was the only/first point).
  const onDeletePoint = (id: string): string | null => {
    const p = pathById(id);
    if (!p) return null;
    const prev = prevPointId(noteRef.current!.outline, p);
    mutateOutline((o) => removeAt(o, p));
    return prev;
  };

  // selected point + its label for the right panel
  const selectedPoint = note && selectedPath ? findByPath(note.outline, selectedPath) : null;
  const selectedLabel =
    selectedPath && selectedPath.length ? fullLabelFor(selectedPath) : null;
  // guard: ensure selectedPath still resolves after structural edits
  const validSelected = note && selectedPath ? flatten(note.outline).some((r) => samePath(r.path, selectedPath)) : false;

  return (
    <AuthGate>
    <div className="flex h-screen w-screen flex-col bg-[var(--frame)]">
      {backupNeeded && !backupDismissed && (
        <BackupBanner
          onDone={() => setBackupNeeded(false)}
          onDismiss={() => setBackupDismissed(true)}
        />
      )}
    <main className="flex w-full flex-1 gap-2 overflow-hidden p-2">
      {index ? (
        <Sidebar
          index={index}
          activeNoteId={activeNoteId}
          profile={settings.profile}
          onOpenSettings={() => setSettingsOpen(true)}
          onSelectNote={onSelectNote}
          onNewFolder={onNewFolder}
          onNewNote={onNewNote}
          onRenameFolder={onRenameFolder}
          onDeleteFolder={onDeleteFolder}
          onRenameNote={onRenameNote}
          onDeleteNote={onDeleteNote}
        />
      ) : (
        <div className="bento w-72 shrink-0" />
      )}

      {note ? (
        <>
          <OutlinePanel
            note={note}
            registerEditorFlush={registerEditorFlush}
            selectedPath={validSelected ? selectedPath : null}
            selectedPoint={validSelected ? selectedPoint : null}
            onTitleChange={onTitleChange}
            onSpeakerChange={onSpeakerChange}
            onDateChange={onDateChange}
            onIntroChange={onIntroChange}
            onVerseEdit={onVerseEdit}
            onToggleStar={onToggleStar}
            onEditCommit={onEditCommit}
            onChangeDepth={onChangeDepth}
            onCreateFirstPoint={onCreateFirstPoint}
            onCreateSibling={onCreateSibling}
            onDeletePoint={onDeletePoint}
            onSelect={setSelectedPath}
            onImportApply={(fn) => setNote((cur) => (cur ? fn(cur) : cur))}
            onAddQuestion={onAddQuestion}
            onQuestionText={onQuestionText}
            onQuestionAnswer={onQuestionAnswer}
            onQuestionMove={onQuestionMove}
            onQuestionSpan={onQuestionSpan}
            onQuestionDelete={onQuestionDelete}
          />
          <NotesPanel
            point={validSelected ? selectedPoint : null}
            label={validSelected ? selectedLabel : null}
            onChange={(field, value) =>
              selectedPath && mutateOutline((o) => updateField(o, selectedPath, field, value))
            }
          />
        </>
      ) : (
        <div className="bento flex flex-1 items-center justify-center text-sm text-[var(--muted)]">
          Select or create a note to begin.
        </div>
      )}

      <DialogHost />
      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onSettingsChange={onSettingsChange}
        onBankEdit={onBankEdit}
      />

      {saving && (
        <div className="pointer-events-none fixed bottom-3 right-4 text-[11px] text-[var(--muted)]">
          saving…
        </div>
      )}
    </main>
    </div>
    </AuthGate>
  );
}

// Slim, dismissible nudge shown at the top of the app when a local backup is
// due. Not a modal — it never blocks editing. "Back up now" runs a snapshot
// inline; "Remind me later" snoozes for a week; × hides it for this session.
function BackupBanner({ onDone, onDismiss }: { onDone: () => void; onDismiss: () => void }) {
  const [state, setState] = useState<"idle" | "running" | "done">("idle");

  const backUp = async () => {
    setState("running");
    try {
      await backupApi.run();
      setState("done");
      setTimeout(onDone, 1200);
    } catch {
      setState("idle"); // let them retry or open Settings for the error detail
    }
  };
  const later = async () => {
    onDismiss();
    backupApi.snooze().catch(() => {});
  };

  return (
    <div className="flex items-center gap-3 border-b border-[var(--border-soft)] bg-[var(--inset)] px-4 py-2 text-xs text-[var(--muted)]">
      <span className="flex-1">
        {state === "done"
          ? "Backed up ✓"
          : "Your notes aren’t backed up. Nothing is stored in the cloud — everything lives on this computer."}
      </span>
      {state !== "done" && (
        <>
          <button
            onClick={backUp}
            disabled={state === "running"}
            className="btn-light rounded-md px-2.5 py-1 text-xs font-medium text-[var(--text)] disabled:opacity-60"
          >
            {state === "running" ? "Backing up…" : "Back up now"}
          </button>
          <button onClick={later} className="text-xs text-[var(--muted)] hover:text-[var(--text)]">
            Remind me later
          </button>
          <button
            onClick={onDismiss}
            aria-label="Dismiss"
            className="text-[var(--faint)] hover:text-[var(--text)]"
          >
            ✕
          </button>
        </>
      )}
    </div>
  );
}
