"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import clsx from "clsx";
import type { Settings } from "../types";
import { VerseBankPage } from "./verse-bank-page";
import { ShortcutsPage } from "./shortcuts-page";
import { ProfilePage } from "./profile-page";

type Page = "verse-bank" | "shortcuts" | "profile";

const PAGES: { id: Page; label: string }[] = [
  { id: "verse-bank", label: "Verse Bank" },
  { id: "shortcuts", label: "Shortcuts" },
  { id: "profile", label: "Profile" },
];

type Props = {
  open: boolean;
  onClose: () => void;
  settings: Settings;
  onSettingsChange: (settings: Settings) => void;
  // A verse changed on the Verse Bank page — lets the app live-update the
  // open note.
  onBankEdit: (key: string, text: string) => void;
};

const EXIT_MS = 240; // keep in sync with the .modal-* transitions in globals.css

export function SettingsModal({ open, onClose, settings, onSettingsChange, onBankEdit }: Props) {
  const [page, setPage] = useState<Page>("verse-bank");

  // CSS-transition presence: mount closed, then flip to shown so the enter
  // transition runs; on close, play the exit then unmount.
  const [mounted, setMounted] = useState(false);
  const [shown, setShown] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (open) {
      setMounted(true);
      return;
    }
    setShown(false);
    const t = setTimeout(() => setMounted(false), EXIT_MS);
    return () => clearTimeout(t);
  }, [open]);
  useLayoutEffect(() => {
    if (open && mounted && !shown) {
      // force a reflow so the closed styles are computed first — the class
      // change then transitions instead of snapping (and doesn't rely on
      // requestAnimationFrame, which never fires in hidden pages)
      overlayRef.current?.getBoundingClientRect();
      setShown(true);
    }
  }, [open, mounted, shown]);

  // close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!mounted) return null;

  return (
    <div
      ref={overlayRef}
      onClick={onClose}
      className={clsx(
        "modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6",
        shown && "shown",
      )}
    >
      {/* wide rectangular panel */}
      <div
        onClick={(e) => e.stopPropagation()}
        className={clsx(
          "modal-panel relative flex h-[560px] max-h-[88vh] w-[880px] max-w-[94vw] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-2xl",
          shown && "shown",
        )}
      >
        {/* left nav */}
        <nav className="flex w-48 shrink-0 flex-col border-r border-[var(--border-soft)] bg-[var(--sidebar)] p-3">
          <div className="px-2.5 pb-2 pt-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--faint)]">
            Settings
          </div>
          {PAGES.map((p) => (
            <button
              key={p.id}
              onClick={() => setPage(p.id)}
              className={clsx(
                "mb-0.5 rounded-lg px-2.5 py-1.5 text-left text-[13px] transition-colors",
                page === p.id
                  ? "concave-sel font-medium text-[var(--text)]"
                  : "text-[var(--muted)] hover:bg-black/[0.035] hover:text-[var(--text)]",
              )}
            >
              {p.label}
            </button>
          ))}
          <button
            onClick={onClose}
            className="btn-light mt-auto rounded-md px-2.5 py-1.5 text-xs font-medium text-[var(--text)]"
          >
            Close
          </button>
        </nav>

        {/* page content */}
        <div className="min-w-0 flex-1 overflow-y-auto">
          {page === "verse-bank" && <VerseBankPage onBankEdit={onBankEdit} />}
          {page === "shortcuts" && (
            <ShortcutsPage
              rules={settings.shortcuts}
              onChange={(shortcuts) => onSettingsChange({ ...settings, shortcuts })}
            />
          )}
          {page === "profile" && (
            <ProfilePage
              profile={settings.profile}
              onChange={(profile) => onSettingsChange({ ...settings, profile })}
            />
          )}
        </div>
      </div>
    </div>
  );
}
