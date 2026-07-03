import type { StudyQuestion } from "./types";

// Rich pill/bubble palette for study questions: dark border, light fill,
// readable dark text. Colors are assigned round-robin as questions are added.
export const QUESTION_COLORS = [
  { border: "#1a7f4e", bg: "#e3f5ec", text: "#14603c" }, // rich green
  { border: "#1d5fd6", bg: "#e4edfd", text: "#17489f" }, // blue
  { border: "#7c3aed", bg: "#f0e9fd", text: "#5b21b6" }, // violet
  { border: "#b45309", bg: "#fdf0dd", text: "#8a3e06" }, // amber
  { border: "#be185d", bg: "#fce7f0", text: "#9d1350" }, // rose
  { border: "#0f766e", bg: "#dff4f2", text: "#0b5a54" }, // teal
  { border: "#4338ca", bg: "#e8e7fb", text: "#3730a3" }, // indigo
  { border: "#c2410c", bg: "#fdeade", text: "#9a3412" }, // orange
] as const;

export const questionColor = (q: StudyQuestion) =>
  QUESTION_COLORS[q.color % QUESTION_COLORS.length];

// New questions start at the top of the outline with the next palette color.
export function newQuestion(existing: StudyQuestion[]): StudyQuestion {
  return {
    id: crypto.randomUUID(),
    text: "",
    color: existing.length % QUESTION_COLORS.length,
    anchorId: null,
  };
}
