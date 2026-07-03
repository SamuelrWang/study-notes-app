import path from "node:path";

// Where all user data lives (notes, verse bank, settings). The Electron shell
// points this at the per-user app-data folder via STUDY_NOTES_DATA_DIR; plain
// `next dev`/`next start` keep the original repo-local data/ directory.
export const DATA_DIR = process.env.STUDY_NOTES_DATA_DIR || path.join(process.cwd(), "data");
