// Similarity alignment of OpenF1 positions (their circuit frame) onto the metric track
// profile. Pure maths, deterministic, no three.js: runs in node --test.
import type { TrackProfile } from "./lapPhysics.ts";

export interface Point {
  x: number;
  y: number;
}
/** p' = s · R(θ) · M · p + t, where M mirrors y when `mirror` is true. */
export interface Similarity {
  scale: number;
  rotation: number; // radians
  tx: number;
  ty: number;
  mirror: boolean;
}

export function apply(t: Similarity, p: Point): Point {
  const y = t.mirror ? -p.y : p.y;
  const c = Math.cos(t.rotation),
    s = Math.sin(t.rotation);
  return {
    x: t.scale * (c * p.x - s * y) + t.tx,
    y: t.scale * (s * p.x + c * y) + t.ty,
  };
}

export function invert(t: Similarity, p: Point): Point {
  const x = p.x - t.tx,
    y = p.y - t.ty;
  const c = Math.cos(t.rotation),
    s = Math.sin(t.rotation);
  const ux = (c * x + s * y) / t.scale,
    uy = (-s * x + c * y) / t.scale;
  return { x: ux, y: t.mirror ? -uy : uy };
}

/** Closed-form least-squares similarity (Umeyama, 2D) mapping src[i] onto dst[i]. */
export function fitSimilarity(
  src: readonly Point[],
  dst: readonly Point[],
  mirror = false,
): Similarity {
  const n = src.length;
  if (n < 3 || dst.length !== n)
    throw new RangeError("Need matching point sets");
  const a = src.map((p) => ({ x: p.x, y: mirror ? -p.y : p.y }));
  let mx = 0,
    my = 0,
    nx = 0,
    ny = 0;
  for (let i = 0; i < n; i++) {
    mx += a[i].x;
    my += a[i].y;
    nx += dst[i].x;
    ny += dst[i].y;
  }
  mx /= n;
  my /= n;
  nx /= n;
  ny /= n;
  let sxx = 0,
    sxy = 0,
    var0 = 0;
  for (let i = 0; i < n; i++) {
    const ax = a[i].x - mx,
      ay = a[i].y - my,
      bx = dst[i].x - nx,
      by = dst[i].y - ny;
    sxx += ax * bx + ay * by; // dot
    sxy += ax * by - ay * bx; // cross
    var0 += ax * ax + ay * ay;
  }
  const rotation = Math.atan2(sxy, sxx);
  const scale = Math.hypot(sxx, sxy) / var0;
  const c = Math.cos(rotation),
    s = Math.sin(rotation);
  return {
    scale,
    rotation,
    mirror,
    tx: nx - scale * (c * mx - s * my),
    ty: ny - scale * (s * mx + c * my),
  };
}

// Uniform grid of centreline segments, built once per profile, so nearest-point queries
// check a few dozen segments instead of the whole lap.
const CELL = 40;
const grids = new WeakMap<TrackProfile, Map<string, number[]>>();
function grid(track: TrackProfile) {
  let g = grids.get(track);
  if (g) return g;
  g = new Map();
  for (let i = 0; i < track.count; i++) {
    const j = (i + 1) % track.count;
    const x0 = Math.floor(Math.min(track.x[i], track.x[j]) / CELL),
      x1 = Math.floor(Math.max(track.x[i], track.x[j]) / CELL);
    const y0 = Math.floor(Math.min(track.y[i], track.y[j]) / CELL),
      y1 = Math.floor(Math.max(track.y[i], track.y[j]) / CELL);
    for (let gx = x0; gx <= x1; gx++)
      for (let gy = y0; gy <= y1; gy++) {
        const key = gx + ":" + gy;
        (g.get(key) ?? g.set(key, []).get(key)!).push(i);
      }
  }
  grids.set(track, g);
  return g;
}

function segment(track: TrackProfile, i: number, p: Point) {
  const j = (i + 1) % track.count;
  const ex = track.x[j] - track.x[i],
    ey = track.y[j] - track.y[i];
  const u = Math.max(
    0,
    Math.min(
      1,
      ((p.x - track.x[i]) * ex + (p.y - track.y[i]) * ey) /
        (ex * ex + ey * ey || 1),
    ),
  );
  const x = track.x[i] + ex * u,
    y = track.y[i] + ey * u;
  return { x, y, index: i, fraction: u, d2: (p.x - x) ** 2 + (p.y - y) ** 2 };
}

/** Nearest point on the closed centreline polyline, and the distance to it. */
export function nearestOnTrack(track: TrackProfile, p: Point) {
  const g = grid(track);
  const gx = Math.floor(p.x / CELL),
    gy = Math.floor(p.y / CELL);
  // Start from segment 0 (always valid) so the best hit is never null.
  let best = segment(track, 0, p);
  let found = false;
  // Grow the search ring until a hit is found and the ring is beyond the best distance.
  for (let r = 0; r < 200; r++) {
    for (let dx = -r; dx <= r; dx++)
      for (let dy = -r; dy <= r; dy++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        for (const i of g.get(gx + dx + ":" + (gy + dy)) ?? []) {
          const s = segment(track, i, p);
          if (!found || s.d2 < best.d2) {
            best = s;
            found = true;
          }
        }
      }
    if (found && Math.sqrt(best.d2) <= r * CELL) break;
  }
  if (!found) throw new RangeError("Point is far from the track");
  return {
    x: best.x,
    y: best.y,
    index: best.index,
    fraction: best.fraction,
    distance: Math.sqrt(best.d2),
  };
}

export function residuals(
  track: TrackProfile,
  t: Similarity,
  points: readonly Point[],
) {
  return points.map((p) => nearestOnTrack(track, apply(t, p)).distance);
}

export function summarize(values: readonly number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const rms = Math.sqrt(values.reduce((s, v) => s + v * v, 0) / values.length);
  const p95 =
    sorted[Math.min(sorted.length - 1, Math.floor(0.95 * sorted.length))];
  return { rms, p95, max: sorted[sorted.length - 1], count: values.length };
}

/** Iterative closest point with a similarity model, from one starting transform. */
export function icp(
  track: TrackProfile,
  points: readonly Point[],
  start: Similarity,
  iterations = 40,
): Similarity {
  let t = start;
  for (let k = 0; k < iterations; k++) {
    const targets = points.map((p) => nearestOnTrack(track, apply(t, p)));
    const next = fitSimilarity(points, targets, t.mirror);
    const moved =
      Math.abs(next.rotation - t.rotation) +
      Math.abs(next.scale / t.scale - 1) +
      Math.hypot(next.tx - t.tx, next.ty - t.ty) / 1000;
    t = next;
    if (moved < 1e-9) break;
  }
  return t;
}

/**
 * Global alignment: start from centroid and path-length scale at twelve headings, with
 * and without a mirrored y axis, run ICP from each and keep the lowest RMS. Deterministic.
 */
export function alignToTrack(
  track: TrackProfile,
  points: readonly Point[],
  pathLength: number,
) {
  let cx = 0,
    cy = 0,
    tx = 0,
    ty = 0;
  for (const p of points) {
    cx += p.x;
    cy += p.y;
  }
  cx /= points.length;
  cy /= points.length;
  for (let i = 0; i < track.count; i++) {
    tx += track.x[i];
    ty += track.y[i];
  }
  tx /= track.count;
  ty /= track.count;
  const scale = track.length / pathLength;
  let best: { transform: Similarity; rms: number } | null = null;
  for (const mirror of [false, true])
    for (let k = 0; k < 12; k++) {
      const rotation = (k * Math.PI) / 6;
      const c = Math.cos(rotation),
        s = Math.sin(rotation),
        my = mirror ? -cy : cy;
      const start: Similarity = {
        scale,
        rotation,
        mirror,
        tx: tx - scale * (c * cx - s * my),
        ty: ty - scale * (s * cx + c * my),
      };
      const transform = icp(track, points, start);
      const { rms } = summarize(residuals(track, transform, points));
      if (!best || rms < best.rms - 1e-9) best = { transform, rms };
    }
  return best!.transform;
}
