// Visual-only dimensions at the existing 60 metres/world-unit projection.
// No surveyed width, elevation, kerb, runoff or barrier inventory is available.
export const FOUNDATION = Object.freeze({
  halfWidth: 0.15,
  roadDepth: 0.025,
  groundZ: -0.035,
  margin: 2.2,
});
export interface SurfaceZone {
  from: number;
  to: number;
  side: -1 | 1;
}
// Sparse illustrative zoning, NOT exact Sepang placement. Replace with sourced metadata later.
export const KERB_ZONES: readonly SurfaceZone[] = [
  { from: 0.08, to: 0.115, side: 1 },
  { from: 0.32, to: 0.36, side: -1 },
  { from: 0.66, to: 0.7, side: 1 },
];
export const GRAVEL_ZONES: readonly SurfaceZone[] = [
  { from: 0.085, to: 0.11, side: -1 },
  { from: 0.665, to: 0.69, side: -1 },
];
export const BARRIER_ZONES: readonly SurfaceZone[] = [
  { from: 0.012, to: 0.055, side: -1 },
  { from: 0.46, to: 0.5, side: 1 },
];
// No supported pit lane coordinates in the repository. Never infer from pit timing records.
export const PIT_LANE: readonly { x: number; y: number; z: number }[] | null =
  null;
