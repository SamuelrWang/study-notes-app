import { promises as fs } from "node:fs";
import path from "node:path";
import { DEFAULT_SETTINGS, type Settings } from "@/features/settings/types";
import { DATA_DIR } from "./data-dir";

// Settings live next to the notes data, one JSON file. Missing file or fields
// fall back to defaults so older data dirs keep working untouched.

const SETTINGS_PATH = path.join(DATA_DIR, "settings.json");

export async function readSettings(): Promise<Settings> {
  try {
    const raw = JSON.parse(await fs.readFile(SETTINGS_PATH, "utf8")) as Partial<Settings>;
    return {
      profile: { ...DEFAULT_SETTINGS.profile, ...raw.profile },
      shortcuts: raw.shortcuts ?? [],
    };
  } catch {
    return structuredClone(DEFAULT_SETTINGS);
  }
}

export async function writeSettings(settings: Settings): Promise<void> {
  await fs.mkdir(path.dirname(SETTINGS_PATH), { recursive: true });
  await fs.writeFile(SETTINGS_PATH, JSON.stringify(settings, null, 2), "utf8");
}
