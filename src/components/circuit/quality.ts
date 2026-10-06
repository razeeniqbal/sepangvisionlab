// Driver-view quality presets. Pure; storage is injected (same pattern as the theme).
export const QUALITY_LEVELS = ["low", "balanced", "high"] as const;
export type Quality = (typeof QUALITY_LEVELS)[number];
export const QUALITY_KEY = "svl-quality";
export const QUALITY_LABELS: Record<Quality, string> = {
  low: "Low",
  balanced: "Balanced",
  high: "High detail",
};
export interface QualitySettings {
  dpr: [number, number];
  shadows: boolean;
  shadowMap: number;
  palms: number; // plantation instances (subset of the seeded rows)
  trees: boolean; // broadleaf clumps
  sunDisc: boolean;
  /** Every nearby car casts a sun shadow (otherwise only the followed car; all get a contact shadow). */
  allCarShadows: boolean;
  /** Distant hills ring and grass detail texture. */
  terrain: boolean;
}
export const QUALITY: Record<Quality, QualitySettings> = {
  low: { dpr: [1, 1], shadows: false, shadowMap: 1024, palms: 700, trees: false, sunDisc: false, allCarShadows: false, terrain: false },
  balanced: { dpr: [1, 1.25], shadows: true, shadowMap: 1024, palms: 2000, trees: true, sunDisc: true, allCarShadows: false, terrain: true },
  high: { dpr: [1, 1.5], shadows: true, shadowMap: 2048, palms: 4500, trees: true, sunDisc: true, allCarShadows: true, terrain: true },
};
// Balanced by default: the 60 fps target matters more than the last bit of detail.
export const DEFAULT_QUALITY: Quality = "balanced";

const isQuality = (v: unknown): v is Quality => QUALITY_LEVELS.some((q) => q === v);

export function readQuality(storage: Pick<Storage, "getItem"> | null | undefined): Quality {
  try {
    const v = storage?.getItem(QUALITY_KEY);
    return isQuality(v) ? v : DEFAULT_QUALITY;
  } catch {
    return DEFAULT_QUALITY;
  }
}
export function writeQuality(storage: Pick<Storage, "setItem"> | null | undefined, quality: Quality) {
  try {
    if (!storage) return false;
    storage.setItem(QUALITY_KEY, quality);
    return true;
  } catch {
    return false;
  }
}
