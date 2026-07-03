"use client";

import { useEffect, useRef, useState } from "react";
import type { Profile } from "../types";
import { Avatar } from "./avatar";
import { getSupabase } from "@/lib/supabase-client";

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
