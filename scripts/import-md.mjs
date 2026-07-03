// Import "Markdown Outlines" .md files into the study-notes data store.
//
// Each file becomes one note:
//   - title:  "Msg 3: <name>"  (from the "N - name.md" filename)
//   - outline: built from #/##/### headings (heading level -> depth)
//   - per point: scripture refs parsed from the heading -> pills,
//                expanded verse text pulled from the file's References section.
//
// Usage: node scripts/import-md.mjs "/path/to/Markdown Outlines"
// Writes into ./data (index.json + notes/<id>.json). Non-destructive: appends a folder.

import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

const SRC = process.argv[2] || path.join(process.env.HOME, "Downloads", "Markdown Outlines");
const DATA = path.join(process.cwd(), "data");
const NOTES = path.join(DATA, "notes");

const ORDINAL = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6,
  seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
};

function esc(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Build verse map + book set from the "Message X — References" section.
function parseReferences(body) {
  const map = new Map(); // "Matt. 3:12" -> text
  const books = new Set();
  const lineRe = /^\[([^\]]+)\]\([^)]*\)\s*(.*)$/;
  for (const line of body.split("\n")) {
    const m = line.match(lineRe);
    if (!m) continue;
    const label = m[1].trim();
    const text = m[2].trim();
    map.set(label, text);
    const bm = label.match(/^(.*?)\s+\d+:\d+/);
    if (bm) books.add(bm[1].trim());
  }
  return { map, books };
}

// Grammar for a scripture citation cluster (whole string), allowing implied
// book/chapter (bare numbers). CV = optional "chapter:" + verse(+letter)(+range).
const CV = `(?:\\d+:)?\\d+[a-c]?(?:[-–]\\d+[a-c]?)?`;
const SEG = `(?:(?:cf\\.|see|vv?\\.)\\s*)?(?:(?:[1-3]\\s)?[A-Z][A-Za-z]*\\.?\\s+)?${CV}(?:,\\s*${CV})*`;
const CLUSTER_RE = new RegExp(`^${SEG}(?:;\\s*${SEG})*[.:]?$`);

function isCluster(s) {
  s = s.trim();
  if (!s) return false;
  // must look scriptural: contain a chapter:verse colon OR a vv./v. marker
  if (!/[:]/.test(s) && !/\bvv?\.\s/i.test(s)) return false;
  return CLUSTER_RE.test(s);
}

// The dominant book across the file's References — used as the implied book
// when a citation omits it (e.g. "1:1, 17" inside a Matthew message).
function inferPrimaryBook(verseMap) {
  const counts = {};
  for (const key of verseMap.keys()) {
    const b = key.match(/^(.*?)\s+\d+:/);
    if (b) counts[b[1]] = (counts[b[1]] || 0) + 1;
  }
  let best = "Matt.";
  let bestN = -1;
  for (const [b, n] of Object.entries(counts)) if (n > bestN) ((best = b), (bestN = n));
  return best;
}

// Parse a citation cluster into atomic verse-ref pills. `state.primaryChapter`
// is the running chapter for the primary book, threaded across points so bare
// refs ("vv. 21, 27", "17") resolve to the right chapter.
function parseCluster(s, state, verseMap, primaryBook) {
  const atoms = [];
  let book = primaryBook; // implied book defaults to the message's primary book
  let chapter = state.primaryChapter; // implied chapter = running primary chapter
  for (let seg of s.replace(/[.:]\s*$/, "").split(";")) {
    seg = seg.trim().replace(/^(?:cf\.|see|vv?\.)\s*/i, "");
    if (!seg) continue;
    const bm = seg.match(/^((?:[1-3]\s)?[A-Z][A-Za-z]*\.?)\s+(\d.*)$/);
    if (bm) {
      book = bm[1].trim();
      seg = bm[2].trim();
    }
    for (let part of seg.split(",")) {
      part = part.trim();
      if (!part) continue;
      let vRaw;
      const cv = part.match(/^(\d+):(\d+[a-c]?)(?:[-–](\d+[a-c]?))?$/);
      if (cv) {
        chapter = parseInt(cv[1], 10);
        vRaw = cv[2] + (cv[3] ? `-${cv[3]}` : "");
      } else {
        const v = part.match(/^(\d+[a-c]?)(?:[-–](\d+[a-c]?))?$/);
        if (!v || chapter == null) continue;
        vRaw = v[1] + (v[2] ? `-${v[2]}` : "");
      }
      const label = `${book} ${chapter}:${vRaw}`;
      const vStart = parseInt(vRaw, 10);
      const em = vRaw.match(/[-–](\d+)/);
      const vEnd = em ? parseInt(em[1], 10) : vStart;
      const verses = [];
      // include EVERY verse in the range (empty text if not in References) so
      // the bottom tab can show a fillable line for each.
      for (let vn = vStart; vn <= vEnd; vn++) {
        const key = `${book} ${chapter}:${vn}`;
        verses.push({ ref: key, text: verseMap.get(key) ?? "" });
      }
      atoms.push({ label, verses });
      if (book === primaryBook) state.primaryChapter = chapter; // advance running chapter
    }
  }
  return atoms;
}

// Split heading text into renderable parts (strings + verse pills). Citations
// live in parentheticals and in the trailing run after an em-dash.
function tokenizeHeading(text, state, verseMap, primaryBook) {
  const regions = [];
  const paren = /\(([^()]*)\)/g;
  let pm;
  while ((pm = paren.exec(text)) !== null) {
    if (isCluster(pm[1])) {
      const start = pm.index + 1;
      regions.push([start, start + pm[1].length]);
    }
  }
  const dash = text.lastIndexOf("—");
  if (dash >= 0 && isCluster(text.slice(dash + 1))) regions.push([dash + 1, text.length]);

  if (!regions.length) return { textParts: [text], refs: [] };
  regions.sort((a, b) => a[0] - b[0]);

  const parts = [];
  const refs = [];
  let last = 0;
  for (const [s, e] of regions) {
    if (s < last) continue;
    if (s > last) parts.push(text.slice(last, s));
    const atoms = parseCluster(text.slice(s, e), state, verseMap, primaryBook);
    for (const a of atoms) {
      refs.push(a);
      parts.push({ r: refs.length - 1 }); // pill marker -> index into refs
    }
    last = e;
  }
  if (last < text.length) parts.push(text.slice(last));
  const textParts = parts.filter((p) => typeof p !== "string" || !/^[\s;:,]+$/.test(p));
  return { textParts, refs };
}

function stripEnumerator(text) {
  return text.replace(/^\s*(?:[IVXLCDM]+|[A-Za-z]|\d+)\.\s+/, "").trim();
}

function buildOutline(outlineBody, verseMap) {
  const primaryBook = inferPrimaryBook(verseMap);
  const state = { primaryChapter: null }; // threaded across points in document order
  const root = [];
  const stack = []; // { depth, node }
  for (const line of outlineBody.split("\n")) {
    const hm = line.match(/^(#{1,6})\s+(.*)$/);
    if (!hm) continue;
    const level = hm[1].length;
    const raw = hm[2].trim();
    // only enumerated points (I./A./1./a.) — skips "Intro", etc.
    if (!/^\s*(?:[IVXLCDM]+|[A-Za-z]|\d+)\.\s+/.test(raw)) continue;
    const depth = level - 1;
    const text = stripEnumerator(raw);
    const { textParts, refs } = tokenizeHeading(text, state, verseMap, primaryBook);
    const node = {
      id: randomUUID(),
      text,
      textParts,
      refs,
      messageNotes: "",
      studyNotes: "",
      children: [],
    };
    while (stack.length && stack[stack.length - 1].depth >= depth) stack.pop();
    if (stack.length) stack[stack.length - 1].node.children.push(node);
    else root.push(node);
    stack.push({ depth, node });
  }
  return root;
}

function metaFor(filename) {
  const base = filename.replace(/\.md$/, "");
  const m = base.match(/^(\d+)\s*-\s*(.*)$/);
  if (m) return { number: m[1], title: m[2].trim() };
  return { number: "", title: base };
}

function fileOrder(filename) {
  const m = filename.match(/^(\d+)/);
  return m ? parseInt(m[1], 10) : 9999;
}

// Collect user-typed content (message/study notes, verse edits, stars) from an
// existing outline, keyed by point text so a re-import never loses it.
function collectNotes(nodes, into = new Map()) {
  for (const p of nodes) {
    const refState = {};
    for (const ref of p.refs || []) {
      const texts = {};
      for (const v of ref.verses || []) if (v.text) texts[v.ref] = v.text;
      if (ref.starred || Object.keys(texts).length)
        refState[ref.label] = { starred: !!ref.starred, texts };
    }
    if (p.messageNotes || p.studyNotes || Object.keys(refState).length) {
      into.set(p.text, {
        messageNotes: p.messageNotes || "",
        studyNotes: p.studyNotes || "",
        refState,
      });
    }
    collectNotes(p.children, into);
  }
  return into;
}

// Re-apply preserved content onto a freshly parsed outline, matched by text.
function applyNotes(nodes, saved) {
  for (const p of nodes) {
    const s = saved.get(p.text);
    if (s) {
      if (s.messageNotes) p.messageNotes = s.messageNotes;
      if (s.studyNotes) p.studyNotes = s.studyNotes;
      for (const ref of p.refs || []) {
        const rs = s.refState?.[ref.label];
        if (!rs) continue;
        if (rs.starred) ref.starred = true;
        for (const v of ref.verses) if (rs.texts[v.ref]) v.text = rs.texts[v.ref];
      }
    }
    applyNotes(p.children, saved);
  }
}

async function readNoteFile(id) {
  try {
    return JSON.parse(await fs.readFile(path.join(NOTES, `${id}.json`), "utf8"));
  } catch {
    return null;
  }
}

const numFromRef = (ref) => ref.number ?? (ref.title.match(/(\d+)/)?.[1] ?? "");

async function main() {
  await fs.mkdir(NOTES, { recursive: true });
  const entries = (await fs.readdir(SRC))
    .filter((f) => f.endsWith(".md") && /^\d+\s*-/.test(f))
    .sort((a, b) => fileOrder(a) - fileOrder(b));
  const sourceNumbers = new Set(entries.map((f) => metaFor(f).number));

  let index;
  try {
    index = JSON.parse(await fs.readFile(path.join(DATA, "index.json"), "utf8"));
  } catch {
    index = { folders: [] };
  }

  // Any folder holding source-number notes is a candidate. We update ONE in
  // place (never create a second) and delete the rest as dupes.
  const candidates = [];
  for (const folder of index.folders) {
    const preserved = new Map(); // number -> { notes, speaker, introduction }
    let match = 0;
    let edits = 0;
    for (const ref of folder.notes) {
      const num = numFromRef(ref);
      if (!sourceNumbers.has(num)) continue;
      match++;
      const old = await readNoteFile(ref.id);
      if (!old) continue;
      const notes = old.outline ? collectNotes(old.outline) : new Map();
      for (const v of notes.values()) {
        if (v.messageNotes) edits++;
        if (v.studyNotes) edits++;
        edits += Object.keys(v.refState || {}).length;
      }
      if (old.speaker) edits++;
      if (old.introduction) edits++;
      preserved.set(num, {
        notes,
        speaker: old.speaker ?? "",
        introduction: old.introduction ?? "",
      });
    }
    if (match > 0) candidates.push({ folder, edits, preserved });
  }

  // Target = the folder with the most user edits; tie-break away from the
  // auto-generated "Markdown Outlines" name so the user's renamed folder wins.
  candidates.sort(
    (a, b) =>
      b.edits - a.edits ||
      (a.folder.name === "Markdown Outlines" ? 1 : 0) - (b.folder.name === "Markdown Outlines" ? 1 : 0),
  );

  let target = candidates[0]?.folder;
  const preserved = candidates[0]?.preserved ?? new Map();
  for (const c of candidates.slice(1))
    for (const [num, val] of c.preserved) if (!preserved.has(num)) preserved.set(num, val);

  if (!target) {
    target = { id: randomUUID(), name: "Markdown Outlines", notes: [] };
    index.folders.push(target);
  }

  // Delete the other source-dupe folders + their note files.
  const dupes = candidates.map((c) => c.folder).filter((f) => f !== target);
  for (const f of dupes) for (const n of f.notes) await deleteNoteFileSafe(n.id);
  index.folders = index.folders.filter((f) => !dupes.includes(f));

  // Keep note ids stable within the target (by number).
  const idByNum = new Map();
  for (const ref of target.notes) {
    const num = numFromRef(ref);
    if (num) idByNum.set(num, ref.id);
  }
  target.notes = [];

  for (const file of entries) {
    const content = await fs.readFile(path.join(SRC, file), "utf8");
    const splitIdx = content.search(/^##\s+Message\s+\w+\s+[—-]\s+References/m);
    const outlineBody = splitIdx >= 0 ? content.slice(0, splitIdx) : content;
    const refsBody = splitIdx >= 0 ? content.slice(splitIdx) : "";
    const { map } = parseReferences(refsBody);
    const outline = buildOutline(outlineBody, map);
    const primaryBook = inferPrimaryBook(map);

    const { number, title } = metaFor(file);

    const srMatch = outlineBody.match(/Scripture Reading\**:?\s*\**\s*(.+)/i);
    const scriptureReading = srMatch ? srMatch[1].replace(/\*+/g, "").trim() : "";
    const scriptureParts =
      scriptureReading && isCluster(scriptureReading)
        ? parseCluster(scriptureReading, { primaryChapter: null }, map, primaryBook)
        : [];

    const carry = preserved.get(number);
    if (carry) applyNotes(outline, carry.notes);

    const id = idByNum.get(number) ?? randomUUID();
    const note = {
      id,
      title,
      number,
      scriptureReading,
      scriptureParts,
      speaker: carry?.speaker ?? "",
      introduction: carry?.introduction ?? "",
      outline,
    };
    await fs.writeFile(path.join(NOTES, `${id}.json`), JSON.stringify(note, null, 2));
    target.notes.push({ id, title, number });
    console.log(`${number}: ${title}  —  ${countPoints(outline)} points, ${countRefs(outline)} refs`);
  }

  await fs.writeFile(path.join(DATA, "index.json"), JSON.stringify(index, null, 2));
  console.log(
    `\nUpdated folder "${target.name}" (${target.notes.length} notes). Removed ${dupes.length} dupe folder(s).`,
  );
}

async function deleteNoteFileSafe(id) {
  try {
    await fs.unlink(path.join(NOTES, `${id}.json`));
  } catch {
    /* already gone */
  }
}

function countPoints(nodes) {
  return nodes.reduce((n, p) => n + 1 + countPoints(p.children), 0);
}
function countRefs(nodes) {
  return nodes.reduce((n, p) => n + p.refs.length + countRefs(p.children), 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
