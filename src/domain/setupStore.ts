// Persist the simulated session's setup edits and ghost (localStorage). Pure: storage is
// injected, every read is validated, and any problem falls back to "nothing saved".
import type { CarSetup } from "./lapPhysics.ts";

export const SETUP_KEY = "svl-setups-v1";
export interface SavedSetups {
  overrides: Record<string, CarSetup>;
  ghost: { carId: string; setup: CarSetup } | null;
}
export const EMPTY: SavedSetups = Object.freeze({ overrides: {}, ghost: null }) as SavedSetups;

const inRange = (v: unknown, lo: number, hi: number) =>
  typeof v === "number" && Number.isFinite(v) && v >= lo && v <= hi;

/** A setup within the drawer's own ranges, or null. */
export function validSetup(value: unknown): CarSetup | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (
    !inRange(v.powerKw, 500, 900) ||
    !inRange(v.wingLevel, 1, 10) ||
    !inRange(v.fuelKg, 0, 110) ||
    !["SOFT", "MEDIUM", "HARD"].includes(v.compound as string) ||
    typeof v.wet !== "boolean"
  )
    return null;
  return {
    powerKw: v.powerKw as number,
    wingLevel: v.wingLevel as number,
    fuelKg: v.fuelKg as number,
    compound: v.compound as CarSetup["compound"],
    wet: v.wet,
  };
}

/** Parse saved JSON, keeping only valid setups for known car ids. */
export function parseSaved(text: string | null, knownIds: ReadonlySet<string>): SavedSetups {
  if (!text) return EMPTY;
  try {
    const raw = JSON.parse(text) as { overrides?: unknown; ghost?: unknown };
    const overrides: Record<string, CarSetup> = {};
    if (raw.overrides && typeof raw.overrides === "object")
      for (const [id, s] of Object.entries(raw.overrides as Record<string, unknown>)) {
        const setup = validSetup(s);
        if (setup && knownIds.has(id)) overrides[id] = setup;
      }
    let ghost: SavedSetups["ghost"] = null;
    const g = raw.ghost as { carId?: unknown; setup?: unknown } | null | undefined;
    if (g && typeof g.carId === "string" && knownIds.has(g.carId)) {
      const setup = validSetup(g.setup);
      if (setup) ghost = { carId: g.carId, setup };
    }
    return { overrides, ghost };
  } catch {
    return EMPTY;
  }
}

export function loadSetups(storage: Pick<Storage, "getItem"> | null | undefined, knownIds: ReadonlySet<string>): SavedSetups {
  try {
    return parseSaved(storage?.getItem(SETUP_KEY) ?? null, knownIds);
  } catch {
    return EMPTY;
  }
}

export function saveSetups(storage: Pick<Storage, "setItem" | "removeItem"> | null | undefined, saved: SavedSetups): boolean {
  try {
    if (!storage) return false;
    if (!Object.keys(saved.overrides).length && !saved.ghost) storage.removeItem(SETUP_KEY);
    else storage.setItem(SETUP_KEY, JSON.stringify(saved));
    return true;
  } catch {
    return false;
  }
}
