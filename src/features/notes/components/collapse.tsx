"use client";

import clsx from "clsx";

// Smoothly animates its content's height open/closed using the grid-rows
// 1fr↔0fr trick (no JS measuring, no layout jank).
export function Collapse({
  open,
  children,
  className,
}: {
  open: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={clsx("grid transition-[grid-template-rows] duration-300 ease-out", className)}
      style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
    >
      <div className="flex min-h-0 flex-col overflow-hidden">{children}</div>
    </div>
  );
}
