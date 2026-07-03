"use client";

import clsx from "clsx";
import { ResizeGrip } from "./resize-grip";

// Reusable corner resize handle. Consumers give an `onStart` that receives the
// pointerdown event and returns a move handler (called with each pointermove).
// This centralizes the listener/cursor boilerplate + the grip icon + corner
// positioning so every resizable surface looks and behaves the same.
export function ResizeHandle({
  corner,
  onStart,
}: {
  corner: "br" | "tr";
  onStart: (e: React.PointerEvent) => (ev: PointerEvent) => void;
}) {
  const down = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const move = onStart(e);
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    document.body.style.cursor = "ns-resize";
    document.body.style.userSelect = "none";
  };

  return (
    <button
      onPointerDown={down}
      title="Drag to resize"
      className={clsx(
        "absolute right-1.5 z-10 flex h-4 w-4 cursor-ns-resize items-center justify-center text-[var(--faint)] hover:text-[var(--muted)]",
        corner === "br" ? "bottom-1.5" : "top-1.5",
      )}
    >
      <ResizeGrip corner={corner} />
    </button>
  );
}
