import { useSyncExternalStore } from "react";
import { Color } from "three";
import { ACCENTS, readTheme, writeTheme, type Theme } from "./theme";

const listeners = new Set<() => void>();
const accentColours = new Set<Color>();
const storage = () => {
  try {
    return window.localStorage;
  } catch {
    return null; // blocked storage (privacy mode, sandbox): theme still works for the visit
  }
};
let current: Theme = readTheme(storage());

/** Set the theme on <html> (CSS tokens follow) and recolour registered 3D accents. */
export function applyTheme(theme: Theme, persist = false) {
  current = theme;
  document.documentElement.dataset.theme = theme;
  for (const colour of accentColours) colour.set(ACCENTS[theme]);
  if (persist) writeTheme(storage(), theme);
  listeners.forEach((listener) => listener());
}

/** A three.js colour that follows the theme accent (selection rings, ghost car). */
export function themedAccent(colour = new Color()) {
  colour.set(ACCENTS[current]);
  accentColours.add(colour);
  return colour;
}

export function useTheme(): Theme {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => current,
  );
}

export const initialTheme = () => current;
