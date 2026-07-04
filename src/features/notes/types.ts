// Shared data model for the study-notes app.
// Persisted as JSON on disk; not meant to be human-read.

// One verse line. `text` may be "" (reference known, verse not yet filled in).
export type VerseLine = { ref: string; text: string };

// A scripture reference shown as a pill (e.g. "Matt. 13:24-30"), with the
// expanded verse(s) it covers and a per-point "starred" flag.
export type VerseRef = { label: string; verses: VerseLine[]; starred?: boolean };

// Point text broken into renderable parts: plain strings interleaved with
// pill markers. A pill marker `{ r }` indexes into the point's `refs` array,
// so a pill and the bottom-tab verse editor share one source of truth.
export type TextPart = string | { r: number };

export type OutlinePoint = {
  id: string;
  text: string;
  textParts: TextPart[];
  refs: VerseRef[];
  messageNotes: string;
  studyNotes: string;
  children: OutlinePoint[];
};

// A study question for the whole message. It renders as a movable bubble in
// the outline: `anchorId` is the outline point it sits after (null = above
// the first point). `color` indexes QUESTION_COLORS; the label ("Question N")
// comes from array order. The question covers `span` consecutive outline
// points starting directly below its bubble (always at least 1) — shown as a
// line off the bubble's left edge plus pills. `answer` is the user's answer.
// Question and answer support inline verse pills exactly like outline points:
// plain text with "[Label]" markers, parsed into parts + refs (see refs.ts).
export type StudyQuestion = {
  id: string;
  text: string; // plain text; "[Rev. 4:5]" marks a verse pill
  textParts?: TextPart[];
  refs?: VerseRef[];
  answer?: string; // plain text, may be multi-line; same pill syntax
  answerParts?: TextPart[];
  answerRefs?: VerseRef[];
  span?: number; // covered point count; absent = 1
  pointIds?: string[]; // legacy coverage — only read to derive span
  color: number;
  anchorId: string | null;
};

export type Note = {
  id: string;
  title: string; // the message name (no "Msg N" prefix)
  number?: string; // shown in the sidebar (e.g. "3"); blank for ad-hoc notes
  scriptureReading?: string; // raw text from the source
  scriptureParts?: VerseRef[]; // tokenized into verse pills
  speaker?: string; // manually chosen
  date?: string; // ISO "YYYY-MM-DD"; empty/absent when unset
  introduction?: string; // HTML; the brother's opening word
  outline: OutlinePoint[];
  questions?: StudyQuestion[]; // absent on older notes
};

// Lightweight tree used by the left switcher. Note content lives in its own file.
export type NoteRef = { id: string; title: string; number?: string };
export type Folder = { id: string; name: string; notes: NoteRef[] };
export type Index = { folders: Folder[] };
