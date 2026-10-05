// Present mode: the viewport and its overlays fill the window; all other chrome hides.
// The key rule is pure so it can be tested without a DOM.
export interface KeyLike {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  target?: { tagName?: string; isContentEditable?: boolean } | null;
}

const TYPING = new Set(["INPUT", "TEXTAREA", "SELECT"]);

/** "toggle" on P, "exit" on Escape, otherwise null. Never while typing or with modifiers. */
export function presentKeyAction(event: KeyLike, presenting: boolean): "toggle" | "exit" | null {
  if (event.ctrlKey || event.metaKey || event.altKey) return null;
  const target = event.target;
  if (target && (target.isContentEditable || TYPING.has((target.tagName ?? "").toUpperCase()))) return null;
  if (event.key === "p" || event.key === "P") return "toggle";
  if (event.key === "Escape" && presenting) return "exit";
  return null;
}
