"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import type { Index, Note } from "@/features/notes/types";
import { api } from "@/features/notes/api";
import type { TextPart, VerseRef } from "@/features/notes/types";
import {
  findByPath,
  flatten,
  indent,
  labelFor,
  outdent,
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
import { settingsApi } from "@/features/settings/api";
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

  // Load the active note's full content.
  const skipNextSave = useRef(false);
  useEffect(() => {
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
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  // selected point + its label for the right panel
  const selectedPoint = note && selectedPath ? findByPath(note.outline, selectedPath) : null;
  const selectedLabel =
    selectedPath && selectedPath.length
      ? labelFor(selectedPath[selectedPath.length - 1], selectedPath.length - 1)
      : null;
  // guard: ensure selectedPath still resolves after structural edits
  const validSelected = note && selectedPath ? flatten(note.outline).some((r) => samePath(r.path, selectedPath)) : false;

  return (
    <AuthGate>
    <main className="flex h-screen w-screen gap-2 overflow-hidden bg-[var(--frame)] p-2">
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
            selectedPath={validSelected ? selectedPath : null}
            selectedPoint={validSelected ? selectedPoint : null}
            onTitleChange={onTitleChange}
            onSpeakerChange={onSpeakerChange}
            onIntroChange={onIntroChange}
            onVerseEdit={onVerseEdit}
            onToggleStar={onToggleStar}
            onEditCommit={onEditCommit}
            onChangeDepth={onChangeDepth}
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
    </AuthGate>
  );
}
