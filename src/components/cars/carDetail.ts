export type CarDetail = "far" | "medium" | "near";
// CSS pixels, independent of device-pixel ratio and selection enlargement.
// Hysteresis prevents flicker around transitions during resize/zoom.
export function carDetail(pixels: number, previous: CarDetail): CarDetail {
  if (previous === "near" && pixels >= 24) return "near";
  if (pixels >= 28) return "near";
  if (previous !== "far" && pixels >= 16) return "medium";
  return pixels >= 18 ? "medium" : "far";
}
// Future hero LOD0 can replace the near slot without touching race state.
export const CAR_LOD_SLOT = {
  far: "LOD2",
  medium: "LOD2",
  near: "LOD1",
} as const;
