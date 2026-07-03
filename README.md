# Study Notes

Local-only outline + notes tool. No database, no internet. All data lives in `data/` as JSON on this machine.

## Run it
**Easy:** double-click `Study Notes.command` (Finder). It boots the server and opens http://localhost:3000.

**Terminal:**
```bash
npm run dev      # development, hot reload
# or
npm run build && npm run start   # production
```
Then open http://localhost:3000.

## Layout
- **Left:** folders → notes. Double-click to rename, hover for + / ✕.
- **Middle:** note title + Roman-numeral outline (I / A / 1 / a by depth). Hover a point for move/indent/sub-point/delete. Click a point to select it.
- **Right:** Message Notes + Study Notes attached to the selected point.

Autosaves ~0.5s after you stop typing.

## Data
`data/index.json` = folder/note tree. `data/notes/<id>.json` = each note's full content.
Back this folder up to keep your notes. `data/` is gitignored.
