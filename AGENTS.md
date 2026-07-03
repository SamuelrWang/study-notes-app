# AGENTS.md — Processing outlines into the app

This guide is for a future agent given a **message outline** (a `.md` file, or a
folder of them) to import into the Study Notes app. It documents the source
format, the exact processing rules (especially **verses**), and how to run the
importer without creating duplicates or losing data.

The importer is [`scripts/import-md.mjs`](scripts/import-md.mjs). Read it
alongside this guide — this explains the *why*; the script is the *how*.

---

## 1. What one outline file becomes

**One `.md` file → one note.** For a folder of message files, each file is a
separate note inside a single folder.

| Note field        | Source                                                            |
| ----------------- | ----------------------------------------------------------------- |
| `number`, `title` | Filename `N - Name.md` → number `N`, title `Name`                 |
| `scriptureParts`  | The `Scripture Reading` line → verse pills                        |
| `outline`         | The `#/##/###` headings → a nested tree of points                 |
| `speaker`         | Blank (user picks from a dropdown later)                          |
| `introduction`    | Blank (user types the opening word later)                         |

The sidebar shows just the **number** (e.g. `3: The Wheat of Life…`); the full
name lives at the top of the outline panel.

---

## 2. Source markdown format

A message file looks like this:

```markdown
H
Brother
**Scripture Reading**: Matt. 3:12; 13:38; 5:13-16; 4:16-20

# Intro

# I. The believers are ... gathered into the Lord's barn—Matt. 3:11-12; 13:24-30, 38-42:
## A. The believers as the wheat have the divine life within them—Psa. 36:7-9; John 1:4.
### 1. Being a Christian means ... —Matt. 7:13-14; Phil. 3:8-14.

...more headings...

## Message Three — References

[Matt. 3:11](https://.../40_Matthew_3.htm#Mat3-11) I baptize you in water...
[Matt. 3:12](https://.../40_Matthew_3.htm#Mat3-12) Whose winnowing fan...
...one line per cited verse...
```

Key structural facts:

- **Filename**: `N - Title.md` (e.g. `3 - The Wheat of Life….md`). The leading
  number drives the note number and sort order. Files without a leading number
  (e.g. `Key Statements.md`) are **skipped** by the importer.
- **Metadata lines** (`H`, `Brother`, the `Scripture Reading` line) sit before
  the first heading. Only `Scripture Reading` is captured.
- **Outline headings** use markdown heading levels for depth:
  `#` = level 1 → depth 0 (renders `I, II, III`), `##` = depth 1 (`A, B`),
  `###` = depth 2 (`1, 2`), `####` = depth 3 (`a, b`). The app **re-derives** the
  label from depth, so the enumerator in the source (`I.`, `A.`, `1.`) is
  stripped after it's used to confirm the line is a real point.
- **Only enumerated headings become points.** A `# Intro` with no `I./A./1.`
  enumerator is skipped, so numbering stays aligned with the source.
- **References section** — a heading matching `## Message <Word> — References`
  ends the outline. Everything after it is the verse table and is **not** parsed
  as outline points. Each line is `[Label](url) verse text`.

---

## 3. Verses — the important part

Verse references appear inside heading text in two places: a **trailing cluster
after an em-dash** (`…barn—Matt. 3:11-12; 13:24-30`) and **parentheticals**
(`(Rom. 4:14; 8:17; Gal. 3:29)`). They render as **pills**; hovering a pill
shows the verse text.

### 3a. Build the verse map + primary book

Parse the References section into:
- a **verse map**: canonical `"Book Ch:V"` → verse text (e.g. `"Matt. 3:11"` → `"I baptize…"`).
- the **book set** (all books that appear), and from it the **primary book** =
  the most frequently referenced book. This is the implied book for references
  that omit it (a Matthew message → primary book `Matt.`).

### 3b. Fill in what the outline leaves out

**Governing principle: the outline never repeats itself.** When a reference
omits the book and/or chapter, it is inheriting whatever was **last stated
above it**. So to resolve a bare reference you scan **upward** to the most
recent reference that named that piece — that book/chapter carries down until a
new one replaces it. A reference is only ever as short as it can be while still
being unambiguous _given everything before it_.

Concretely:

- **Missing book _and_ chapter** (`vv. 21, 27`, `v. 12a`, or a bare `21`): both
  the book and the chapter come from the last reference above that stated them.
- **Missing book only** (`13:38` after `Matt. 3:12`): the book carries from
  above; the chapter is explicit here.
- **Nothing missing** (`John 14:10`): stands on its own and _becomes_ the new
  "last stated" book/chapter for anything bare that follows.

The parser implements this as:

- **Book _and_ chapter carry _within_ a run.** A "run" is one citation cluster
  (`;`/`,`-separated). Both the book and the chapter carry forward from the last
  one that was written, until a new one replaces it:
  - `Num. 24:9; Eph. 1:3; Psa. 71:14; 103:1-5; 142:7` → the bare `103:1-5` and
    `142:7` inherit **`Psa.`** from the `Psa. 71:14` just before them —
    `Psa. 103:1-5`, `Psa. 142:7`. **They do _not_ jump to the message's main
    book.** This is the essence of "extrapolate from the last mention above."
  - `Matt. 3:11-12; 13:24-30, 38-42` → book carries (`Matt.`), chapter updates
    at each explicit `chapter:`, and `38-42` (no chapter) reuses `13`.
- **Run-start bare refs use the central book.** When a run _begins_ with no book
  (`—1:1, 17; 2:1-2`), there is nothing to its left in the run to carry from, so
  it inherits the message's **central book**: `Matt. 1:1`, `Matt. 1:17`,
  `Matt. 2:1-2`.
- **Chapter carries _across points_** (document order). A running "current
  chapter for the central book" is threaded through the points, so a child's
  bare verse-only ref resolves against its parent. Under `II. …—16:16`,
  `vv. 21, 27` → `Matt. 16:21`, `Matt. 16:27`; under `IV. …—3:11`, `v. 12a` →
  `Matt. 3:12a`. (Refs in other books don't advance this running chapter.)
- **Letter suffixes** (`11a`, `45b`, `12a`) are kept in the pill **label** but
  stripped when looking the verse up in the map.

> **Multi-book outlines are common** — message 11 cites ~20 different books
> (Rev., Num., Micah, Dan., Acts, Eph., Psa., Matt., Jude, Ezek., …). The
> within-run carry above handles the cross-book jumps correctly. The one
> approximation: a **run-start** bare ref uses the **primary book** (the
> most-referenced book, computed from the References section) as a stand-in for
> "last book stated above." That's correct for these materials because every
> message has one central book and bare run-starts always mean that book. If you
> ever hit a run-start bare ref that should mean some _other_ book, replace the
> primary-book fallback with a true document-order "last explicit book."
>
> **Known limitation:** a cross-chapter range written with an internal em-dash
> (`1:20—2:1`, meaning Rev 1:20 through 2:1) is not parsed as one span — the
> trailing-em-dash detection treats the last `—` as the prose/citation boundary.
> Rare; fix by hand if it matters.

Only treat a substring as a citation if it actually looks scriptural (contains a
`chapter:verse` colon or a `vv.`/`v.` marker) — this avoids turning prose numbers
into pills.

### 3c. Expand ranges into individual verse lines

Every reference expands to **one line per verse in its range** (e.g.
`Matt. 4:16-20` → lines 16,17,18,19,20). Each line's text comes from the verse
map, or `""` if that verse wasn't in the References section. Blank lines are
intentional — the user fills them in the bottom **verse tab**, and starring is
per line/ref.

### 3d. Data shape (source of truth)

On each outline point:
- `refs: VerseRef[]` — the pills; **this is canonical**. Each `VerseRef` is
  `{ label, verses: {ref, text}[], starred? }`.
- `textParts: (string | {r})[]` — the point text with pill markers. A pill is
  `{ r: <index into refs> }`, **not** an embedded copy — so a pill and the
  bottom-tab editor share one object and stay in sync. See
  [`src/features/notes/refs.ts`](src/features/notes/refs.ts) for the client-side
  version used when a user edits a point (verses shown as `[Label]`).

### 3e. Verse bank

Typed verse text is also stored in a shared **verse bank** (`data/verse-bank.json`,
keyed by canonical ref). New refs auto-fill from it, so a verse typed once shows
up everywhere. Server merge logic: `src/lib/verse-bank.ts`; client store:
`src/features/bible/bank-client.ts`. The importer does not need to touch the
bank — it leaves verse lines blank and lets the bank hydrate them on read.

---

## 4. Running the importer

```bash
# import a folder of "N - Name.md" files
node scripts/import-md.mjs "/path/to/Markdown Outlines"
```

**It is idempotent and non-duplicating** — safe to re-run:

- It finds the existing folder that already holds these notes (by matching
  message numbers, regardless of the folder's name — the user may have renamed
  it, e.g. `Summer '26 Semi`), **updates it in place** (same folder id, same note
  ids by number), and **deletes any stray duplicate** folder. It never creates a
  second copy.
- It **preserves user-typed content** across re-imports, matched by number +
  point text + ref label: message notes, study notes, per-verse text, stars,
  speaker, and introduction. Re-parsing the source only refreshes the outline
  structure and verse scaffolding.

### Data location (important)

`scripts/import-md.mjs` writes to **`./data`** in the repo (dev's data dir).
The **desktop app** reads from `~/Library/Application Support/Study Notes/data`
(`STUDY_NOTES_DATA_DIR`). So:

- For the dev server (`npm run dev`), `./data` is correct.
- To import into the **installed desktop app**, run the importer against that
  folder — e.g. copy the result in, or run with
  `STUDY_NOTES_DATA_DIR` set and adjust the script's `DATA` constant to honor it
  (currently it hardcodes `process.cwd()/data`).
- A timestamped backup (`data.backup.<epoch>`) is cheap insurance before any
  re-import: `cp -R data "data.backup.$(date +%s)"`.

---

## 5. Checklist for a new outline

1. Confirm the file(s) are named `N - Name.md` and contain a
   `## Message <Word> — References` section. No references section ⇒ no verse
   text (pills will be blank/dulled, still fillable by hand).
2. Back up `data/` if notes already exist.
3. Run `node scripts/import-md.mjs "<path>"`.
4. Verify: `node -e` a sample note and check `textParts` are `{r}` markers,
   ranges expanded, and a bare-ref point (like message 8's `I.A`) resolved to the
   primary book with carried chapters.
5. `npm run build` and load the app; spot-check pills + hover popups on the new
   note.

If a reference resolves to the wrong book/chapter, the culprit is almost always
the **running-chapter inference** (3b) — check the point's document-order
neighbors, since bare `vv.`/`v.` refs inherit the nearest preceding chapter.
