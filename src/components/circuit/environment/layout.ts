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

// ---- M19 Step 6: scenery placement ----

/** Distance from a point to the nearest profile sample (4 m apart), on a 60 m grid. */
export function distanceToTrack(track: TrackProfile) {
  const cell = 60, grid = new Map<string, number[]>();
  for (let i = 0; i < track.count; i++) {
    const key = Math.floor(track.x[i] / cell) + ":" + Math.floor(track.y[i] / cell);
    (grid.get(key) ?? grid.set(key, []).get(key)!).push(i);
  }
  return (x: number, y: number, reach = 400) => {
    const gx = Math.floor(x / cell), gy = Math.floor(y / cell), rings = Math.ceil(reach / cell);
    let best = Infinity;
    for (let dx = -rings; dx <= rings; dx++)
      for (let dy = -rings; dy <= rings; dy++)
        for (const i of grid.get(gx + dx + ":" + (gy + dy)) ?? [])
          best = Math.min(best, (track.x[i] - x) ** 2 + (track.y[i] - y) ** 2);
    return Math.sqrt(best);
  };
}

/** Gravel on the outside of each corner exit: ~100 m from the apex, beyond the kerb. */
export function gravelTraps(track: TrackProfile, apexes: readonly number[]): KerbRun[] {
  return apexes.map((apex) => ({
    from: apex,
    to: apex + 25,
    side: (track.curvature[apex] > 0 ? -1 : 1) as -1 | 1,
  }));
}

export interface Tree {
  x: number;
  y: number;
  scale: number;
  rotation: number;
  shade: number; // 0..1, picks a green
}
function inBuildings(x: number, y: number, buildings: readonly Building[], pad: number) {
  return buildings.some((b) => {
    const c = Math.cos(-b.heading), s = Math.sin(-b.heading), dx = x - b.x, dy = y - b.y;
    return Math.abs(dx * c - dy * s) < b.length / 2 + pad && Math.abs(dx * s + dy * c) < b.depth / 2 + pad;
  });
}

/**
 * Low-poly broadleaf clumps behind the barriers: a clump every ~100 m on alternating sides,
 * 46-62 m out. Trees keep 38 m from the centre line and 14 m from cameras and buildings.
 */
export function treeClumps(
  track: TrackProfile,
  normals: { nx: Float64Array; ny: Float64Array },
  options: { avoid?: readonly { x: number; y: number }[]; buildings?: readonly Building[]; seed?: number } = {},
): Tree[] {
  const { avoid = [], buildings = [], seed = 19 } = options;
  const next = random(seed), distance = distanceToTrack(track), out: Tree[] = [];
  const clear = (x: number, y: number) =>
    distance(x, y, 120) >= 38 &&
    avoid.every((a) => Math.hypot(a.x - x, a.y - y) >= 14) &&
    !inBuildings(x, y, buildings, 14);
  for (let i = 0, k = 0; i < track.count; i += 25, k++) {
    const side = k % 2 === 0 ? 1 : -1, offset = side * (46 + next() * 16);
    const cx = track.x[i] + normals.nx[i] * offset, cy = track.y[i] + normals.ny[i] * offset;
    const size = 3 + Math.floor(next() * 4);
    for (let t = 0; t < size; t++) {
      const x = cx + (next() - 0.5) * 18, y = cy + (next() - 0.5) * 18;
      if (clear(x, y)) out.push({ x, y, scale: 0.8 + next() * 0.6, rotation: next() * Math.PI * 2, shade: next() });
    }
  }
  return out;
}

/**
 * Oil-palm plantation in rows (12 m grid, alternate rows offset), 90-330 m from the track.
 * Returned in a seeded shuffle so a lower quality preset takes an even subset.
 */
export function palmRows(
  track: TrackProfile,
  options: { spacing?: number; near?: number; far?: number; buildings?: readonly Building[]; seed?: number } = {},
): Palm[] {
  const { spacing = 12, near = 90, far = 330, buildings = [], seed = 21 } = options;
  const next = random(seed), distance = distanceToTrack(track);
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < track.count; i++) {
    minX = Math.min(minX, track.x[i]); maxX = Math.max(maxX, track.x[i]);
    minY = Math.min(minY, track.y[i]); maxY = Math.max(maxY, track.y[i]);
  }
  const out: Palm[] = [];
  for (let row = 0, y = minY - far; y <= maxY + far; y += spacing, row++)
    for (let x = minX - far + (row % 2) * spacing * 0.5; x <= maxX + far; x += spacing) {
      const d = distance(x, y, far + 60);
      if (d < near || d > far || inBuildings(x, y, buildings, 15)) continue;
      out.push({ x: x + (next() - 0.5) * 1.5, y: y + (next() - 0.5) * 1.5, scale: 0.85 + next() * 0.35, rotation: next() * Math.PI * 2 });
    }
  // Seeded Fisher-Yates shuffle.
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * A building beside a turn: on the outside of the bend at the apex, long side parallel to the
 * track, its near face `offset` metres from the centre line. Shrunk by fitBuilding until it
 * keeps that clearance from every part of the circuit.
 */
export function besideTurn(
  track: TrackProfile,
  normals: { nx: Float64Array; ny: Float64Array },
  apex: number,
  offset: number,
  length: number,
  depth: number,
): Building {
  const i = wrap(apex, track.count);
  const side = track.curvature[i] > 0 ? -1 : 1; // the outside of a left bend is on the right
  const o = side * (offset + depth / 2);
  const anchor = {
    x: track.x[i] + normals.nx[i] * o,
    y: track.y[i] + normals.ny[i] * o,
    heading: poseAtDistance(track, track.distance[i]).heading,
  };
  return fitBuilding(track, anchor, length, depth, offset - 2);
}
