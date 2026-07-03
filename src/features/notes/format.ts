// Inline formatting shared by every editable surface (message/study notes,
// intro, verse lines). Uses execCommand so it works on a selection AND at a
// collapsed caret (typing-mode), and toggles cleanly.

const HL = "#fde047"; // yellow marker

function isYellow(bg: string): boolean {
  // rgb(253, 224, 71) in any rgb()/rgba() form
  return /253,\s*224,\s*71/.test(bg);
}

// Is the current selection/caret already highlighted?
export function isHighlighted(): boolean {
  const sel = window.getSelection();
  let n: Node | null = sel?.anchorNode ?? null;
  while (n && n !== document.body) {
    if (n.nodeType === 1) {
      const el = n as HTMLElement;
      if (el.tagName === "MARK") return true;
      if (isYellow(getComputedStyle(el).backgroundColor)) return true;
    }
    n = n.parentNode;
  }
  return false;
}

export function applyFormat(cmd: "bold" | "underline" | "highlight"): void {
  if (cmd === "highlight") {
    // toggle: if already highlighted, clear it (also turns off typing-mode)
    document.execCommand("hiliteColor", false, isHighlighted() ? "transparent" : HL);
  } else {
    document.execCommand(cmd);
  }
}

// Handle ⌘/Ctrl + B / U / H inside any editable surface. Returns true if it
// handled the key (caller should then emit its change).
export function handleFormatKey(e: React.KeyboardEvent): boolean {
  const mod = e.metaKey || e.ctrlKey;
  if (!mod) return false;
  const k = e.key.toLowerCase();
  if (k === "b") {
    e.preventDefault();
    applyFormat("bold");
    return true;
  }
  if (k === "u") {
    e.preventDefault();
    applyFormat("underline");
    return true;
  }
  if (k === "h") {
    e.preventDefault();
    applyFormat("highlight");
    return true;
  }
  return false;
}
