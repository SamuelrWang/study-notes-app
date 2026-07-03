"use client";

import { useState } from "react";
import clsx from "clsx";
import { motion, LayoutGroup } from "framer-motion";
import type { Index } from "../types";
import { uiConfirm, uiPrompt } from "@/features/ui/dialogs";
import type { Profile } from "@/features/settings/types";
import { Avatar } from "@/features/settings/components/avatar";
import { GearIcon, PencilIcon } from "./icons";

const SLIDE = { type: "spring", stiffness: 600, damping: 44, mass: 0.7 } as const;

type Props = {
  index: Index;
  activeNoteId: string | null;
  profile: Profile;
  onOpenSettings: () => void;
  onSelectNote: (id: string) => void;
  onNewFolder: () => void;
  onNewNote: (folderId: string) => void;
  onRenameFolder: (id: string, name: string) => void;
  onDeleteFolder: (id: string) => void;
  onRenameNote: (id: string, title: string) => void;
  onDeleteNote: (id: string) => void;
};

export function Sidebar({
  index,
  activeNoteId,
  profile,
  onOpenSettings,
  onSelectNote,
  onNewFolder,
  onNewNote,
  onRenameFolder,
  onDeleteFolder,
  onRenameNote,
  onDeleteNote,
}: Props) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  return (
    <aside className="bento flex h-full w-72 shrink-0 flex-col overflow-hidden bg-[var(--sidebar)]">
      <div className="flex items-center justify-between px-4 py-3.5">
        <h1 className="text-sm font-semibold tracking-tight text-[var(--text)]">Notes</h1>
        <button
          onClick={onNewFolder}
          className="btn-light rounded-md px-2.5 py-1 text-xs font-medium text-[var(--text)]"
          title="New folder"
        >
          + Folder
        </button>
      </div>

      <LayoutGroup>
      <div className="flex-1 overflow-y-auto px-2.5 pb-4">
        {index.folders.length === 0 && (
          <p className="px-3 py-6 text-center text-xs text-[var(--faint)]">
            No folders yet. Create one to start.
          </p>
        )}

        {index.folders.map((folder) => {
          const isCollapsed = collapsed[folder.id];
          return (
            <div key={folder.id} className="mb-2">
              <div className="group flex items-center gap-1 rounded-lg px-1.5 py-1.5 transition hover:bg-black/[0.035]">
                <button
                  onClick={() => setCollapsed((c) => ({ ...c, [folder.id]: !isCollapsed }))}
                  className="text-[var(--faint)]"
                >
                  <span className="inline-block w-3 text-center text-[9px]">
                    {isCollapsed ? "▶" : "▼"}
                  </span>
                </button>
                <button
                  onDoubleClick={async () => {
                    const name = await uiPrompt("Rename folder", folder.name);
                    if (name) onRenameFolder(folder.id, name);
                  }}
                  onClick={() => setCollapsed((c) => ({ ...c, [folder.id]: !isCollapsed }))}
                  className="flex-1 truncate text-left text-[13px] font-semibold tracking-tight text-[var(--text)]"
                  title="Double-click to rename"
                >
                  {folder.name}
                </button>
                <button
                  onClick={() => onNewNote(folder.id)}
                  className="hidden rounded px-1.5 text-sm text-[var(--muted)] hover:text-[var(--text)] group-hover:block"
                  title="New note"
                >
                  +
                </button>
                <button
                  onClick={async () => {
                    const name = await uiPrompt("Rename folder", folder.name);
                    if (name) onRenameFolder(folder.id, name);
                  }}
                  className="hidden rounded px-1.5 text-xs text-[var(--muted)] hover:text-[var(--text)] group-hover:block"
                  title="Rename folder"
                >
                  <PencilIcon />
                </button>
                <button
                  onClick={async () => {
                    const ok = await uiConfirm(`Delete folder "${folder.name}"?`, {
                      message: "All notes inside it will be deleted too.",
                    });
                    if (ok) onDeleteFolder(folder.id);
                  }}
                  className="hidden rounded px-1.5 text-sm text-[var(--muted)] hover:text-red-500 group-hover:block"
                  title="Delete folder"
                >
                  ✕
                </button>
              </div>

              {!isCollapsed && (
                <ul className="mt-1 flex flex-col gap-0.5 pl-1.5">
                  {folder.notes.length === 0 && (
                    <li className="px-2 py-1 text-xs text-[var(--faint)]">empty</li>
                  )}
                  {folder.notes.map((note) => {
                    const active = note.id === activeNoteId;
                    const label = note.number
                      ? `${note.number}: ${note.title}`
                      : note.title || "Untitled";
                    return (
                      <li key={note.id} className="group/note relative flex items-center">
                        {active && (
                          <motion.div
                            layoutId="note-thumb"
                            transition={SLIDE}
                            className="concave-sel absolute inset-0 rounded-lg"
                          />
                        )}
                        <button
                          onClick={() => onSelectNote(note.id)}
                          onDoubleClick={async () => {
                            const title = await uiPrompt("Rename note", note.title);
                            if (title) onRenameNote(note.id, title);
                          }}
                          className={clsx(
                            "relative z-10 flex-1 truncate rounded-lg px-2.5 py-1.5 text-left text-[13px] transition-colors",
                            active
                              ? "font-medium text-[var(--text)]"
                              : "text-[var(--muted)] hover:bg-black/[0.035] hover:text-[var(--text)]",
                          )}
                          title={note.title}
                        >
                          {label}
                        </button>
                        <div className="absolute right-1.5 z-20 hidden items-center gap-0.5 group-hover/note:flex">
                          <button
                            onClick={async () => {
                              const title = await uiPrompt("Rename note", note.title);
                              if (title) onRenameNote(note.id, title);
                            }}
                            className="rounded px-1 text-xs text-[var(--muted)] hover:text-[var(--text)]"
                            title="Rename note"
                          >
                            <PencilIcon />
                          </button>
                          <button
                            onClick={async () => {
                              if (await uiConfirm(`Delete note "${note.title}"?`)) onDeleteNote(note.id);
                            }}
                            className="rounded px-1 text-xs text-[var(--muted)] hover:text-red-500"
                            title="Delete note"
                          >
                            ✕
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </div>
      </LayoutGroup>

      {/* profile card — pinned to the bottom, opens settings */}
      <div className="border-t border-[var(--border-soft)] p-2">
        <button
          onClick={onOpenSettings}
          className="group/profile flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition hover:bg-black/[0.04]"
          title="Settings"
        >
          <Avatar profile={profile} size={40} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[15px] font-semibold leading-tight tracking-tight text-[var(--text)]">
              {profile.name || "Set up profile"}
            </div>
            <div className="truncate text-xs leading-snug text-[var(--faint)]">
              {profile.email || "add your email"}
            </div>
          </div>
          <GearIcon className="shrink-0 text-[var(--faint)] transition group-hover/profile:text-[var(--text)]" />
        </button>
      </div>
    </aside>
  );
}
