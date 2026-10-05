// Interface theme: SVL (teal, default) or Broadcast (near-black panels, red accent).
// Only CSS tokens change between themes; layout and components are the same.
// Pure: storage is injected so node tests can use fakes, including ones that throw.
export const THEMES = ["svl", "broadcast"] as const;
export type Theme = (typeof THEMES)[number];
export const THEME_KEY = "svl-theme";
export const THEME_LABELS: Record<Theme, string> = { svl: "SVL", broadcast: "Broadcast" };
// Accent for three.js materials, which cannot read CSS custom properties.
export const ACCENTS: Record<Theme, string> = { svl: "#00a19c", broadcast: "#e10600" };

export const isTheme = (value: unknown): value is Theme =>
  THEMES.some((theme) => theme === value);

/** Saved theme, or SVL when storage is missing, blocked, throws or holds something else. */
export function readTheme(storage: Pick<Storage, "getItem"> | undefined | null): Theme {
  try {
    const value = storage?.getItem(THEME_KEY);
    return isTheme(value) ? value : "svl";
  } catch {
    return "svl";
  }
}

/** Persist a choice; returns false (and the app keeps working) if storage refuses. */
export function writeTheme(storage: Pick<Storage, "setItem"> | undefined | null, theme: Theme): boolean {
  try {
    if (!storage) return false;
    storage.setItem(THEME_KEY, theme);
    return true;
  } catch {
    return false;
  }
}

export const nextTheme = (theme: Theme): Theme =>
  THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length];
