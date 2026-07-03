// Diagonal corner grip. Orientation faces away from its corner: a bottom-right
// grip's flat side faces up-left; a top-right grip's faces down-left.
export function ResizeGrip({
  corner = "br",
  className,
}: {
  corner?: "br" | "tr";
  className?: string;
}) {
  const d = corner === "tr" ? "M4 1 10 7M7.5 1 10 3.5" : "M4 10 10 4M7.5 10 10 7.5";
  return (
    <svg
      className={className}
      width="11"
      height="11"
      viewBox="0 0 11 11"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}
