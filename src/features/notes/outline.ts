import type { OutlinePoint } from "./types";

// Outline numbering by depth: I/II → A/B → 1/2 → a/b, then repeat the cycle.
const ROMAN = [
  ["m", 1000], ["cm", 900], ["d", 500], ["cd", 400],
  ["c", 100], ["xc", 90], ["l", 50], ["xl", 40],
  ["x", 10], ["ix", 9], ["v", 5], ["iv", 4], ["i", 1],
] as const;

function toRoman(n: number): string {
  let out = "";
  let rem = n;
  for (const [sym, val] of ROMAN) {
    while (rem >= val) {
      out += sym;
      rem -= val;
    }
  }
  return out;
}

function toAlpha(n: number): string {
  // 1 -> a, 26 -> z, 27 -> aa
  let out = "";
  let x = n;
  while (x > 0) {
    const r = (x - 1) % 26;
    out = String.fromCharCode(97 + r) + out;
    x = Math.floor((x - 1) / 26);
  }
  return out;
}

// index is 0-based position among siblings; depth is 0-based.
export function labelFor(index: number, depth: number): string {
  const n = index + 1;
  switch (depth % 4) {
    case 0:
      return toRoman(n).toUpperCase(); // I, II, III
    case 1:
      return toAlpha(n).toUpperCase(); // A, B, C
    case 2:
      return String(n); // 1, 2, 3
    default:
      return toAlpha(n); // a, b, c
  }
}

// Full hierarchical label for a point, e.g. path [1,0,2] -> "II.A.3".
export function fullLabelFor(path: number[]): string {
  return path.map((idx, depth) => labelFor(idx, depth)).join(".");
}

export function newPoint(): OutlinePoint {
  return {
    id: crypto.randomUUID(),
    text: "",
    textParts: [],
    refs: [],
    messageNotes: "",
    studyNotes: "",
    children: [],
  };
}

// Flattened view for rendering the middle panel.
export type FlatPoint = {
  point: OutlinePoint;
  depth: number;
  label: string;
  // path of child-indexes from root to this point, for in-place mutation
  path: number[];
};

export function flatten(points: OutlinePoint[], depth = 0, prefix: number[] = []): FlatPoint[] {
  const out: FlatPoint[] = [];
  points.forEach((point, i) => {
    const path = [...prefix, i];
    out.push({ point, depth, label: labelFor(i, depth), path });
    if (point.children.length) out.push(...flatten(point.children, depth + 1, path));
  });
  return out;
}

// Return the sibling array that contains the node at `path`, plus the final index.
function locate(points: OutlinePoint[], path: number[]): { siblings: OutlinePoint[]; idx: number } {
  let siblings = points;
  for (let i = 0; i < path.length - 1; i++) siblings = siblings[path[i]].children;
  return { siblings, idx: path[path.length - 1] };
}

export function findByPath(points: OutlinePoint[], path: number[]): OutlinePoint | null {
  const { siblings, idx } = locate(points, path);
  return siblings[idx] ?? null;
}

// All mutators return a new root array (immutable-ish via structuredClone).
export function addSibling(points: OutlinePoint[], path: number[] | null): OutlinePoint[] {
  const root = structuredClone(points);
  const p = newPoint();
  if (!path) {
    root.push(p);
    return root;
  }
  const { siblings, idx } = locate(root, path);
  siblings.splice(idx + 1, 0, p);
  return root;
}

export function addChild(points: OutlinePoint[], path: number[]): OutlinePoint[] {
  const root = structuredClone(points);
  const node = findByPath(root, path);
  if (node) node.children.push(newPoint());
  return root;
}

// Insert a fresh top-level point at the end and report its id, so the caller
// can drop straight into edit mode on it.
export function addTopLevel(points: OutlinePoint[]): { outline: OutlinePoint[]; id: string } {
  const root = structuredClone(points);
  const p = newPoint();
  root.push(p);
  return { outline: root, id: p.id };
}

// Insert a fresh sibling directly after `path` and report its id. When `path`
// is null the new point is appended at the top level.
export function addSiblingAfter(
  points: OutlinePoint[],
  path: number[] | null,
): { outline: OutlinePoint[]; id: string } {
  const root = structuredClone(points);
  const p = newPoint();
  if (!path) {
    root.push(p);
    return { outline: root, id: p.id };
  }
  const { siblings, idx } = locate(root, path);
  siblings.splice(idx + 1, 0, p);
  return { outline: root, id: p.id };
}

// The id of the point rendered directly above `path` in the flattened view
// (the "previous" point), or null when `path` is the very first row. Used to
// pick the focus target after deleting a point.
export function prevPointId(points: OutlinePoint[], path: number[]): string | null {
  const rows = flatten(points);
  const idx = rows.findIndex((r) => samePathArr(r.path, path));
  if (idx <= 0) return null;
  return rows[idx - 1].point.id;
}

function samePathArr(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

export function updateField(
  points: OutlinePoint[],
  path: number[],
  field: "text" | "messageNotes" | "studyNotes",
  value: string,
): OutlinePoint[] {
  const root = structuredClone(points);
  const node = findByPath(root, path);
  if (node) node[field] = value;
  return root;
}

// Replace a point's parsed text + refs (after inline editing).
export function setPointParts(
  points: OutlinePoint[],
  path: number[],
  textParts: OutlinePoint["textParts"],
  refs: OutlinePoint["refs"],
): OutlinePoint[] {
  const root = structuredClone(points);
  const node = findByPath(root, path);
  if (node) {
    node.textParts = textParts;
    node.refs = refs;
    node.text = textParts.map((p) => (typeof p === "string" ? p : "")).join("");
  }
  return root;
}

// Set the text of one verse line under a point's ref.
export function setVerseText(
  points: OutlinePoint[],
  path: number[],
  refIndex: number,
  verseIndex: number,
  text: string,
): OutlinePoint[] {
  const root = structuredClone(points);
  const node = findByPath(root, path);
  const line = node?.refs?.[refIndex]?.verses?.[verseIndex];
  if (line) line.text = text;
  return root;
}

// Toggle the "starred" flag on one ref of one point (per-point, not global).
export function toggleStar(
  points: OutlinePoint[],
  path: number[],
  refIndex: number,
): OutlinePoint[] {
  const root = structuredClone(points);
  const node = findByPath(root, path);
  const ref = node?.refs?.[refIndex];
  if (ref) ref.starred = !ref.starred;
  return root;
}

export function removeAt(points: OutlinePoint[], path: number[]): OutlinePoint[] {
  const root = structuredClone(points);
  const { siblings, idx } = locate(root, path);
  siblings.splice(idx, 1);
  return root;
}

export function move(points: OutlinePoint[], path: number[], dir: -1 | 1): OutlinePoint[] {
  const root = structuredClone(points);
  const { siblings, idx } = locate(root, path);
  const next = idx + dir;
  if (next < 0 || next >= siblings.length) return points; // no-op
  [siblings[idx], siblings[next]] = [siblings[next], siblings[idx]];
  return root;
}

// Indent: make node a child of its previous sibling.
export function indent(points: OutlinePoint[], path: number[]): OutlinePoint[] {
  const root = structuredClone(points);
  const { siblings, idx } = locate(root, path);
  if (idx === 0) return points; // nothing to nest under
  const [node] = siblings.splice(idx, 1);
  siblings[idx - 1].children.push(node);
  return root;
}

// Outdent: move node up to be a sibling of its parent.
export function outdent(points: OutlinePoint[], path: number[]): OutlinePoint[] {
  if (path.length < 2) return points; // already at root
  const root = structuredClone(points);
  const { siblings, idx } = locate(root, path);
  const [node] = siblings.splice(idx, 1);
  const parentPath = path.slice(0, -1);
  const { siblings: parentSiblings, idx: parentIdx } = locate(root, parentPath);
  parentSiblings.splice(parentIdx + 1, 0, node);
  return root;
}
