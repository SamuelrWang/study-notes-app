"use client";

import type { Profile } from "../types";

// Rounded-square avatar: the uploaded photo, or initials on the soft pink
// fallback that matches the sidebar profile design.

export function Avatar({ profile, size }: { profile: Profile; size: number }) {
  const initials =
    profile.name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join("") || "?";

  const style = { width: size, height: size, borderRadius: size * 0.25 };

  if (profile.avatar) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={profile.avatar} alt={profile.name || "Profile"} style={style} className="shrink-0 object-cover" />;
  }
  return (
    <div
      style={{ ...style, fontSize: size * 0.34 }}
      className="flex shrink-0 select-none items-center justify-center bg-[#f6d7dd] font-semibold text-[#a2596b]"
    >
      {initials}
    </div>
  );
}
