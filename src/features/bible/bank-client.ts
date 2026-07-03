import { refToKey } from "./lookup";

// Client-side mirror of the verse bank (data/verse-bank.json). Loaded once at
// app start and kept in sync as the user types, so any code that expands a
// new verse ref can fill its text instantly without a round trip.
export type VerseBank = Record<string, string>; // canonical key -> verse HTML

let bank: VerseBank = {};

export const bankClient = {
  setAll(entries: VerseBank) {
    bank = { ...entries };
  },
  getByKey(key: string): string {
    return bank[key] ?? "";
  },
  // Look up by a note-style ref string ("Rev. 12:5").
  get(ref: string): string {
    const key = refToKey(ref);
    return key ? (bank[key] ?? "") : "";
  },
  setByKey(key: string, text: string) {
    if (text && text.trim()) bank[key] = text;
    else delete bank[key];
  },
  set(ref: string, text: string) {
    const key = refToKey(ref);
    if (key) this.setByKey(key, text);
  },
  all(): VerseBank {
    return bank;
  },
};
