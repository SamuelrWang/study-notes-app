// App-level settings, persisted as data/settings.json (local-only, like notes).

export type Profile = {
  name: string;
  email: string;
  avatar: string; // data URL; "" = no photo (initials fallback)
};

// One auto-expansion rule for the shortcuts feature. Triggers are matched
// case-sensitively against whole words only (see settings/expansion.ts).
export type ShortcutRule = {
  id: string;
  trigger: string; // e.g. "NJ" — no spaces
  replacement: string; // e.g. "New Jerusalem"
};

export type Settings = {
  profile: Profile;
  shortcuts: ShortcutRule[];
  // Anthropic API key for the outline-import feature. Local-only, read by the
  // server route; the ANTHROPIC_API_KEY env var takes precedence when set.
  aiKey?: string;
};

export const DEFAULT_SETTINGS: Settings = {
  profile: { name: "", email: "", avatar: "" },
  shortcuts: [],
};
