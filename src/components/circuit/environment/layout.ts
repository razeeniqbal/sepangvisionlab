// Placement of generated (ILLUSTRATIVE) environment objects on the metric track profile.
// Pure maths so placement rules are tested in node. Frame: x east, y north, z up, metres.
import {
  findCorners,
  poseAtDistance,
  type TrackProfile,
} from "../../../domain/lapPhysics.ts";
import { clampInside } from "./ribbon.ts";

// Official minimum width (16 m, register "width-min") used as a constant visual width.
export const TRACK_HALF_WIDTH = 8;
export const LINE_WIDTH = 0.3;
export const KERB_WIDTH = 1.6;
export const RUNOFF_OUTER = 24;
export const BARRIER_OFFSET = 27;
export const PALM_CLEARANCE = 45;
// Layer heights keep surfaces apart on low-precision mobile depth buffers.
export const LAYER = Object.freeze({
  ground: -0.05,
  runoff: 0.04,
  asphalt: 0.1,
  paint: 0.16,
});

const wrap = (i: number, n: number) => ((i % n) + n) % n;

export interface KerbRun {
  from: number;
  to: number;
  side: -1 | 1; // +1 left of travel
}
/** Inside kerb through every apex, plus an exit kerb on the outside. */
export function kerbRuns(
  track: TrackProfile,
  corners = findCorners(track, 200, 12),
): KerbRun[] {
  return corners.flatMap((apex) => {
    const k = track.curvature[apex],
      radius = 1 / Math.abs(k),
      side: -1 | 1 = k > 0 ? 1 : -1;
    // Tighter corners get shorter kerbs; lengths are in 4 m samples.
    const half = Math.round(Math.min(16, Math.max(6, radius / 8)));
    return [
      { from: apex - half, to: apex + half, side },
      {
        from: apex + Math.round(half / 2),
        to: apex + half * 2 + 4,
        side: -side as -1 | 1,
      },
    ];
  });
}

export interface Placement {
  x: number;
  y: number;
  heading: number; // radians, 0 = east
}

/** Nearest sample index and distance to a point (brute force over the profile). */
export function nearestSample(track: TrackProfile, x: number, y: number) {
  let best = Infinity,
    index = 0;
  for (let i = 0; i < track.count; i++) {
    const d = (track.x[i] - x) ** 2 + (track.y[i] - y) ** 2;
    if (d < best) {
      best = d;
      index = i;
    }
  }
  return { index, distance: Math.sqrt(best) };
}

/** Corner of a building footprint for clearance checks. */
function footprint(p: Placement, length: number, depth: number) {
  const c = Math.cos(p.heading),
    s = Math.sin(p.heading);
  const out: [number, number][] = [];
  for (const [u, v] of [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
    [0, -1],
    [0, 1],
    [-1, 0],
    [1, 0],
  ])
    out.push([
      p.x + (u * length * c) / 2 - (v * depth * s) / 2,
      p.y + (u * length * s) / 2 + (v * depth * c) / 2,
    ]);
  return out;
}

export interface Building extends Placement {
  length: number;
  depth: number;
}
/**
 * Building centred on a sourced anchor. The anchor is never moved: the illustrative
 * envelope shrinks until every footprint point keeps `clearance` metres from the centreline.
 */
export function fitBuilding(
  track: TrackProfile,
  anchor: Placement,
  length: number,
  depth: number,
  clearance = TRACK_HALF_WIDTH + 14,
): Building {
  let l = length,
    d = depth;
  for (let attempt = 0; attempt < 60; attempt++) {
    const clear = footprint(anchor, l, d).every(
      ([x, y]) => nearestSample(track, x, y).distance >= clearance,
    );
    if (clear) return { ...anchor, length: l, depth: d };
    l = Math.max(30, l * 0.92);
    d = Math.max(12, d * 0.95);
  }
  return { ...anchor, length: l, depth: d };
}

/** Bearing of the nearest track segment, so buildings can face the circuit. */
export function trackBearing(track: TrackProfile, x: number, y: number) {
  const { index } = nearestSample(track, x, y);
  return poseAtDistance(track, track.distance[index]).heading;
}

/** Start gantry spans the track at the sample nearest a reference point. */
export function gantryAt(track: TrackProfile, x: number, y: number): Placement {
  const { index } = nearestSample(track, x, y);
  const pose = poseAtDistance(track, track.distance[index]);
  return { x: pose.x, y: pose.y, heading: pose.heading };
}

/** Chevron boards on the outside of each apex. */
export function cornerBoards(
  track: TrackProfile,
  normals: { nx: Float64Array; ny: Float64Array },
  corners = findCorners(track, 200, 12),
): Placement[] {
  return corners.map((apex) => {
    const side = track.curvature[apex] > 0 ? -1 : 1,
      o = side * (RUNOFF_OUTER - 2);
    const pose = poseAtDistance(track, track.distance[apex]);
    return {
      x: track.x[apex] + normals.nx[apex] * o,
      y: track.y[apex] + normals.ny[apex] * o,
      heading: pose.heading,
    };
  });
}

/** Signed barrier offset at a sample, pulled in on the inside of tight bends. */
export function barrierOffset(
  track: TrackProfile,
  index: number,
  side: -1 | 1,
) {
  return clampInside(track, wrap(index, track.count), side * BARRIER_OFFSET);
}

export interface Palm {
  x: number;
  y: number;
  scale: number;
  rotation: number;
}
// Small deterministic LCG: the same field of palms on every load and in tests.
function random(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
export function scatterPalms(
  track: TrackProfile,
  options: {
    count?: number;
    margin?: number;
    seed?: number;
    avoid?: readonly Building[];
  } = {},
): Palm[] {
  const { count = 900, margin = 260, seed = 18, avoid = [] } = options;
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity;
  for (let i = 0; i < track.count; i++) {
    minX = Math.min(minX, track.x[i]);
    maxX = Math.max(maxX, track.x[i]);
    minY = Math.min(minY, track.y[i]);
    maxY = Math.max(maxY, track.y[i]);
  }
  const next = random(seed),
    palms: Palm[] = [];
  // Coarse grid of track samples keeps the clearance test cheap.
  const cell = 60,
    grid = new Map<string, number[]>();
  for (let i = 0; i < track.count; i++) {
    const key =
      Math.floor(track.x[i] / cell) + ":" + Math.floor(track.y[i] / cell);
    (grid.get(key) ?? grid.set(key, []).get(key)!).push(i);
  }
  const nearTrack = (x: number, y: number) => {
    const gx = Math.floor(x / cell),
      gy = Math.floor(y / cell);
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++)
        for (const i of grid.get(gx + dx + ":" + (gy + dy)) ?? [])
          if (
            (track.x[i] - x) ** 2 + (track.y[i] - y) ** 2 <
            PALM_CLEARANCE ** 2
          )
            return true;
    return false;
  };
  const inBuilding = (x: number, y: number) =>
    avoid.some((b) => {
      const c = Math.cos(-b.heading),
        s = Math.sin(-b.heading),
        dx = x - b.x,
        dy = y - b.y;
      return (
        Math.abs(dx * c - dy * s) < b.length / 2 + 15 &&
        Math.abs(dx * s + dy * c) < b.depth / 2 + 15
      );
    });
  for (
    let attempt = 0;
    palms.length < count && attempt < count * 20;
    attempt++
  ) {
    const x = minX - margin + next() * (maxX - minX + 2 * margin),
      y = minY - margin + next() * (maxY - minY + 2 * margin);
    if (nearTrack(x, y) || inBuilding(x, y)) continue;
    palms.push({
      x,
      y,
      scale: 0.8 + next() * 0.5,
      rotation: next() * Math.PI * 2,
    });
  }
  return palms;
}

export interface TurnBoard extends Placement {
  turn: number; // official turn number, 1..15
  apex: number; // profile sample index of the board's peak
}
// Official Sepang turn directions in order (5 lefts: T2, T5, T9, T12, T15).
const OFFICIAL_DIRECTIONS = "RLRRLRRRLRRLRRL";
// Approved grouping of the 22 detected curvature peaks into the 15 official turns
// (docs/MILESTONE_19.md, Step 1). Multi-peak corners take the tightest peak.
const TURN_GROUPS = [
  [0],
  [1],
  [2, 3, 4, 5],
  [6],
  [7, 8, 9],
  [10, 11],
  [12],
  [13],
  [14],
  [15],
  [16],
  [17],
  [18, 19],
  [20],
  [21],
];

/**
 * Numbered turn boards, DERIVED from curvature peaks. Returns [] (unnumbered fallback)
 * unless the detector finds the expected 22 peaks with the official direction sequence.
 */
export function officialTurnBoards(
  track: TrackProfile,
  normals: { nx: Float64Array; ny: Float64Array },
  corners = findCorners(track, 200, 12),
): TurnBoard[] {
  if (corners.length !== 22) return [];
  const turns = TURN_GROUPS.map((group) =>
    group
      .map((g) => corners[g])
      .reduce((a, b) =>
        Math.abs(track.curvature[b]) > Math.abs(track.curvature[a]) ? b : a,
      ),
  );
  const directions = turns
    .map((i) => (track.curvature[i] > 0 ? "L" : "R"))
    .join("");
  if (directions !== OFFICIAL_DIRECTIONS) return [];
  const boards = cornerBoards(track, normals, turns);
  return boards.map((b, n) => ({ ...b, turn: n + 1, apex: turns[n] }));
}
