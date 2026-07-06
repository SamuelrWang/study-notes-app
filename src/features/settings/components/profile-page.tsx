"use client";

import { useEffect, useRef, useState } from "react";
import type { Profile } from "../types";
import { Avatar } from "./avatar";
import { getSupabase } from "@/lib/supabase-client";
import { backupApi, type BackupStatus } from "../api";
import { uiConfirm, uiPrompt } from "@/features/ui/dialogs";

// Local profile shown at the bottom of the sidebar. No accounts — everything
// stays in data/settings.json.

type Props = {
  profile: Profile;
  onChange: (profile: Profile) => void;
};

const AVATAR_SIZE = 128; // stored downscaled so settings.json stays small

export function ProfilePage({ profile, onChange }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [accountEmail, setAccountEmail] = useState<string | null>(null);

  useEffect(() => {
    getSupabase()
      .auth.getSession()
      .then(({ data }) => setAccountEmail(data.session?.user.email ?? null));
  }, []);

  const onPickFile = (file: File) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = AVATAR_SIZE;
      canvas.height = AVATAR_SIZE;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        // cover-crop to a square
        const side = Math.min(img.width, img.height);
        ctx.drawImage(
          img,
          (img.width - side) / 2,
          (img.height - side) / 2,
          side,
          side,
          0,
          0,
          AVATAR_SIZE,
          AVATAR_SIZE,
        );
        onChange({ ...profile, avatar: canvas.toDataURL("image/jpeg", 0.85) });
      }
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  return (
    <div className="px-6 py-5">
      <h2 className="text-sm font-semibold text-[var(--text)]">Profile</h2>
      <p className="mt-1 text-xs text-[var(--muted)]">
        Shown at the bottom of the sidebar. Stored locally on this machine.
      </p>

      <div className="mt-5 flex items-center gap-4">
        <Avatar profile={profile} size={64} />
        <div className="flex flex-col gap-1.5">
          <button
            onClick={() => fileRef.current?.click()}
            className="btn-light rounded-md px-2.5 py-1 text-xs font-medium text-[var(--text)]"
          >
            Upload photo
          </button>
          {profile.avatar && (
            <button
              onClick={() => onChange({ ...profile, avatar: "" })}
              className="text-xs text-[var(--muted)] hover:text-red-500"
            >
              Remove photo
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onPickFile(f);
              e.target.value = "";
            }}
          />
        </div>
      </div>

      <div className="mt-6 flex max-w-sm flex-col gap-3">
        <Field
          label="Name"
          value={profile.name}
          placeholder="Your name"
          onChange={(name) => onChange({ ...profile, name })}
        />
        <Field
          label="Email"
          value={profile.email}
          placeholder="you@example.com"
          onChange={(email) => onChange({ ...profile, email })}
        />
      </div>

      {/* account — separate from the display profile above */}
      <div className="mt-8 border-t border-[var(--border-soft)] pt-4">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--faint)]">
          Account
        </div>
        <div className="mt-2 flex items-center gap-3">
          <span className="text-sm text-[var(--text)]">
            {accountEmail ? `Signed in as ${accountEmail}` : "Not signed in"}
          </span>
          {accountEmail && (
            <button
              onClick={() => getSupabase().auth.signOut()}
              className="btn-light rounded-md px-2.5 py-1 text-xs font-medium text-[var(--text)]"
            >
              Sign out
            </button>
          )}
        </div>
        <p className="mt-1.5 text-xs text-[var(--muted)]">
          Your notes stay on this computer; the account is for backup and sync.
        </p>
      </div>

      <BackupSection />

    </div>
  );
}

// Relative "3 days ago" phrasing for the last-backup line.
function relativeDate(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const min = Math.round(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} minute${min === 1 ? "" : "s"} ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} hour${hr === 1 ? "" : "s"} ago`;
  const day = Math.round(hr / 24);
  if (day < 30) return `${day} day${day === 1 ? "" : "s"} ago`;
  const mo = Math.round(day / 30);
  return `${mo} month${mo === 1 ? "" : "s"} ago`;
}

function snapshotLabel(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// Local-backup controls. Loads its own status; nothing here touches the cloud.
function BackupSection() {
  const [status, setStatus] = useState<BackupStatus | null>(null);
  const [busy, setBusy] = useState<string | null>(null); // "run" | "restore:<name>"
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    backupApi.status().then(setStatus).catch(() => setStatus(null));
  }, []);

  const onBackupNow = async () => {
    setBusy("run");
    setError(null);
    try {
      setStatus(await backupApi.run());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const onEditFolder = async () => {
    const next = await uiPrompt("Backup folder", status?.folder ?? "", "Save");
    if (next === null || !next.trim()) return;
    setError(null);
    try {
      setStatus(await backupApi.setFolder(next.trim()));
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const onRestore = async (name: string) => {
    const ok = await uiConfirm("Restore this backup?", {
      message:
        "Replace all current notes with this backup? Current data is saved to a pre-restore copy first.",
      confirmText: "Restore",
      danger: true,
    });
    if (!ok) return;
    setBusy(`restore:${name}`);
    setError(null);
    try {
      await backupApi.restore(name);
      window.location.reload();
    } catch (e) {
      setError((e as Error).message);
      setBusy(null);
    }
  };

  return (
    <div className="mt-8 border-t border-[var(--border-soft)] pt-4">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--faint)]">
        Backup
      </div>
      <p className="mt-1.5 max-w-md text-xs text-[var(--muted)]">
        Nothing is stored in the cloud — your notes live on this computer. Back up to a synced
        folder like iCloud Drive so a lost or broken computer doesn&apos;t take your notes with it.
      </p>

      <div className="mt-3 flex flex-col gap-1">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--faint)]">
          Folder
        </span>
        <button
          onClick={onEditFolder}
          className="concave-field max-w-md truncate rounded-lg px-2.5 py-1.5 text-left text-sm text-[var(--text)] outline-none hover:text-[var(--text)]"
          title="Click to change the backup folder"
        >
          {status?.folder ?? "…"}
        </button>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <button
          onClick={onBackupNow}
          disabled={busy === "run"}
          className="btn-light rounded-md px-2.5 py-1 text-xs font-medium text-[var(--text)] disabled:opacity-60"
        >
          {busy === "run" ? "Backing up…" : "Back up now"}
        </button>
        <span className="text-xs text-[var(--muted)]">
          {status?.lastBackupAt
            ? `Last backup: ${relativeDate(status.lastBackupAt)}`
            : "Never backed up"}
        </span>
      </div>

      {error && <p className="mt-2 text-xs text-red-500">{error}</p>}

      {status && status.snapshots.length > 0 && (
        <div className="mt-4 flex flex-col gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--faint)]">
            Snapshots
          </span>
          {status.snapshots.map((s) => (
            <div
              key={s.name}
              className="flex max-w-md items-center justify-between gap-3 text-sm text-[var(--text)]"
            >
              <span className="text-[var(--muted)]">{snapshotLabel(s.date)}</span>
              <button
                onClick={() => onRestore(s.name)}
                disabled={!!busy}
                className="btn-light rounded-md px-2 py-0.5 text-xs font-medium text-[var(--text)] disabled:opacity-60"
              >
                {busy === `restore:${s.name}` ? "Restoring…" : "Restore"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--faint)]">
        {label}
      </span>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="concave-field rounded-lg px-2.5 py-1.5 text-sm text-[var(--text)] outline-none"
      />
    </label>
  );
}
