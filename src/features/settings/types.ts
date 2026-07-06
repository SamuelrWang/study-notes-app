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

// Local backup bookkeeping. All fields optional so older data dirs load clean.
export type BackupSettings = {
  folder?: string; // absolute path to the backup folder (~ already expanded)
  lastBackupAt?: string; // ISO timestamp of the last successful snapshot
  snoozeUntil?: string; // ISO timestamp; nudge stays quiet until then
};

export type Settings = {
  profile: Profile;
  shortcuts: ShortcutRule[];
  backup?: BackupSettings;
};

export const DEFAULT_SETTINGS: Settings = {
  profile: { name: "", email: "", avatar: "" },
  shortcuts: [],
};
