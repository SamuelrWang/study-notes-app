"use client";

import type { TextPart, VerseRef } from "../types";
import { VersePill, type PillTint } from "./verse-pill";

// Render parsed text parts: plain strings interleaved with inline verse
// pills resolved via the refs index. Shared by outline points and study
// questions (which tint their pills to match the question color).
export function Parts({
  parts,
  refs,
  onDark,
  tint,
}: {
  parts: TextPart[];
  refs: VerseRef[];
  onDark?: boolean;
  tint?: PillTint;
}) {
  return (
    <>
      {parts.map((p, i) => {
        if (typeof p === "string") return <span key={i}>{p}</span>;
        const ref = refs[p.r];
        return ref ? <VersePill key={i} verse={ref} inline onDark={onDark} tint={tint} /> : null;
      })}
    </>
  );
}
