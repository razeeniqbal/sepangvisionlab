// Quasi steady state lap model: a point mass limited by power, tyre grip,
// downforce and drag. Pure TypeScript, no three.js, so it runs in node --test.
import type { TrackPoint } from "./circuitGeometry.ts";

export interface TrackProfile {
  x: Float64Array; // metres, closed loop (point i+1 of the last index is index 0)
  y: Float64Array;
  distance: Float64Array; // length count + 1, distance[count] = lap length
  curvature: Float64Array; // signed, 1/m
  count: number;
  length: number;
}

export type Compound = "SOFT" | "MEDIUM" | "HARD";

export interface CarSetup {
  powerKw: number; // 500 to 900
  wingLevel: number; // 1 to 10
  fuelKg: number; // 0 to 110
  compound: Compound;
  wet: boolean;
}

export const DEFAULT_SETUP: CarSetup = Object.freeze({
  powerKw: 750,
  wingLevel: 6,
  fuelKg: 40,
  compound: "SOFT",
  wet: false,
}) as CarSetup;

export interface SpeedProfile {
  speed: Float64Array; // m/s at each point, length count + 1
  time: Float64Array; // cumulative seconds, length count + 1
  acceleration: Float64Array; // m/s² along track
  throttle: Float64Array; // 0..1
  brake: Float64Array; // 0..1
  lateralG: Float64Array;
  lapSeconds: number;
  topSpeed: number;
  minSpeed: number;
}

const G = 9.81;
const RHO = 1.16; // warm humid air at Sepang
const VMAX = 100;

function smoothCircular(values: Float64Array, window: number): Float64Array<ArrayBuffer> {
  const n = values.length, half = Math.floor(window / 2), out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let sum = 0;
    for (let k = -half; k <= half; k++) sum += values[(i + k + n) % n];
    out[i] = sum / (2 * half + 1);
  }
  return out;
}

/** Resample a closed outline (metres) at a fixed step, smooth it and compute curvature. */
export function buildTrackProfile(
  points: readonly TrackPoint[],
  stepMeters = 4,
  targetLength?: number,
): TrackProfile {
  if (points.length < 4 || !(stepMeters > 0)) throw new RangeError("Invalid track outline");
  const cum = [0];
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    cum.push(cum[i] + Math.hypot(b.x - a.x, b.y - a.y));
  }
  const raw = cum[points.length];
  const scale = targetLength ? targetLength / raw : 1;
  const count = Math.max(16, Math.round((raw * scale) / stepMeters));
  let x = new Float64Array(count), y = new Float64Array(count);
  let seg = 0;
  for (let k = 0; k < count; k++) {
    const d = (k / count) * raw;
    while (cum[seg + 1] < d) seg++;
    const a = points[seg], b = points[(seg + 1) % points.length];
    const f = (d - cum[seg]) / Math.max(1e-9, cum[seg + 1] - cum[seg]);
    x[k] = (a.x + (b.x - a.x) * f) * scale;
    y[k] = (a.y + (b.y - a.y) * f) * scale;
  }
  for (let pass = 0; pass < 2; pass++) { x = smoothCircular(x, 5); y = smoothCircular(y, 5); }
  if (targetLength) {
    // Smoothing trims corners slightly, so rescale once more to hit the official length.
    let len = 0;
    for (let i = 0; i < count; i++) { const j = (i + 1) % count; len += Math.hypot(x[j] - x[i], y[j] - y[i]); }
    const r = targetLength / len;
    for (let i = 0; i < count; i++) { x[i] *= r; y[i] *= r; }
  }
  const distance = new Float64Array(count + 1);
  for (let i = 0; i < count; i++) {
    const j = (i + 1) % count;
    distance[i + 1] = distance[i] + Math.hypot(x[j] - x[i], y[j] - y[i]);
  }
  const k = new Float64Array(count);
  for (let i = 0; i < count; i++) {
    const a = (i - 1 + count) % count, b = (i + 1) % count;
    const dx = (x[b] - x[a]) / 2, dy = (y[b] - y[a]) / 2;
    const ddx = x[b] - 2 * x[i] + x[a], ddy = y[b] - 2 * y[i] + y[a];
    k[i] = (dx * ddy - dy * ddx) / Math.pow(dx * dx + dy * dy, 1.5);
  }
  return { x, y, distance, curvature: smoothCircular(k, 13), count, length: distance[count] };
}

export function aeroFor(setup: CarSetup) {
  const liftArea = 2.4 + 2.9 * (1 - Math.exp(-setup.wingLevel / 3.2));
  const dragArea = 1.0 + setup.wingLevel * 0.09;
  let mu = { SOFT: 1.82, MEDIUM: 1.74, HARD: 1.66 }[setup.compound];
  if (setup.wet) mu *= 0.64;
  return { liftArea, dragArea, mu, mass: 798 + setup.fuelKg, power: setup.powerKw * 1000 * (setup.wet ? 0.9 : 1) };
}

/** Fastest possible speed at every point, from a forward (traction) and backward (braking) pass. */
export function solveSpeedProfile(track: TrackProfile, setup: CarSetup = DEFAULT_SETUP): SpeedProfile {
  const { count: n, curvature: K, distance } = track;
  const { liftArea, dragArea, mu, mass: m, power } = aeroFor(setup);
  const ds = (i: number) => distance[i + 1] - distance[i];
  const c = (mu * 0.5 * RHO * liftArea) / m;
  const vCorner = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const kk = Math.min(Math.abs(K[i]), 1 / 12);
    vCorner[i] = kk <= c + 1e-6 ? VMAX : Math.min(VMAX, Math.sqrt((mu * G) / (kk - c)));
  }
  const grip = (v: number, i: number) => {
    const normal = m * G + 0.5 * RHO * liftArea * v * v;
    const ratio = Math.min(1, (v * v * Math.abs(K[i])) / (mu * normal));
    return mu * normal * Math.sqrt(1 - ratio * ratio);
  };
  const T = 3 * n, fwd = new Float64Array(T + 1);
  fwd[0] = 50;
  for (let i = 0; i < T; i++) {
    const v = fwd[i], ii = i % n;
    const drive = Math.min(power / Math.max(v, 8), grip(v, ii));
    const a = (drive - 0.5 * RHO * dragArea * v * v - 0.012 * m * G) / m;
    fwd[i + 1] = Math.min(Math.sqrt(Math.max(v * v + 2 * a * ds(ii), 1)), vCorner[(i + 1) % n]);
  }
  const back = new Float64Array(T + 1);
  back[T] = fwd[T];
  for (let i = T - 1; i >= 0; i--) {
    const v = back[i + 1], ii = i % n;
    const decel = (grip(v, ii) + 0.5 * RHO * dragArea * v * v) / m;
    back[i] = Math.min(fwd[i], Math.sqrt(v * v + 2 * decel * ds(ii)));
  }
  const speed = back.slice(n, 2 * n + 1);
  const time = new Float64Array(n + 1), acceleration = new Float64Array(n), throttle = new Float64Array(n), brake = new Float64Array(n), lateralG = new Float64Array(n);
  let topSpeed = 0, minSpeed = Infinity;
  for (let i = 0; i < n; i++) {
    const v = speed[i], v2 = speed[i + 1];
    time[i + 1] = time[i] + (2 * ds(i)) / (v + v2);
    const a = (v2 * v2 - v * v) / (2 * ds(i));
    const drag = (0.5 * RHO * dragArea * v * v) / m;
    acceleration[i] = a;
    if (a < -1.5) brake[i] = Math.min(1, (-a - drag) / (mu * (G + (0.5 * RHO * liftArea * v * v) / m)));
    else throttle[i] = Math.max(0.08, Math.min(1, (a + drag + 0.12) / (power / Math.max(v, 8) / m)));
    lateralG[i] = (v * v * Math.abs(K[i])) / G;
    topSpeed = Math.max(topSpeed, v); minSpeed = Math.min(minSpeed, v);
  }
  return { speed, time, acceleration, throttle, brake, lateralG, lapSeconds: time[n], topSpeed, minSpeed };
}

function search(arr: Float64Array, value: number, n: number): number {
  let lo = 0, hi = n;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (arr[mid] <= value) lo = mid; else hi = mid; }
  return lo;
}

export interface TrackSample {
  index: number; fraction: number; distance: number; progress: number; completedLaps: number;
  x: number; y: number; heading: number; speed: number;
  throttle: number; brake: number; lateralG: number; acceleration: number;
}

/**
 * Exact position for an elapsed race time. Deterministic: no integration drift,
 * so replay rewind and forward land on the same spot every time.
 */
export function sampleAtTime(track: TrackProfile, profile: SpeedProfile, elapsedSeconds: number): TrackSample {
  if (!Number.isFinite(elapsedSeconds) || elapsedSeconds < 0) throw new RangeError("Invalid simulation time");
  const lap = profile.lapSeconds, completedLaps = Math.floor(elapsedSeconds / lap + 1e-12);
  const t = Math.max(0, elapsedSeconds - completedLaps * lap);
  const i = search(profile.time, t, track.count);
  const f = (t - profile.time[i]) / Math.max(1e-9, profile.time[i + 1] - profile.time[i]);
  return sampleIndex(track, profile, i, f, completedLaps);
}

export function sampleAtDistance(track: TrackProfile, profile: SpeedProfile, distance: number): TrackSample {
  const d = ((distance % track.length) + track.length) % track.length;
  const i = search(track.distance, d, track.count);
  const f = (d - track.distance[i]) / Math.max(1e-9, track.distance[i + 1] - track.distance[i]);
  return sampleIndex(track, profile, i, f, 0);
}

function sampleIndex(track: TrackProfile, p: SpeedProfile, i: number, f: number, completedLaps: number): TrackSample {
  const n = track.count, j = (i + 1) % n, a = (i - 3 + n) % n, b = (i + 4) % n;
  const distance = track.distance[i] + (track.distance[i + 1] - track.distance[i]) * f;
  return {
    index: i, fraction: f, distance, progress: distance / track.length, completedLaps,
    x: track.x[i] + (track.x[j] - track.x[i]) * f,
    y: track.y[i] + (track.y[j] - track.y[i]) * f,
    heading: Math.atan2(track.y[b] - track.y[a], track.x[b] - track.x[a]),
    speed: p.speed[i] + (p.speed[i + 1] - p.speed[i]) * f,
    throttle: p.throttle[i], brake: p.brake[i], lateralG: p.lateralG[i], acceleration: p.acceleration[i],
  };
}

/** Indices of corner apexes (local curvature peaks tighter than maxRadius). */
export function findCorners(track: TrackProfile, maxRadius = 250, minGap = 12): number[] {
  const n = track.count, k = track.curvature, out: number[] = [];
  for (let i = 0; i < n; i++) {
    const v = Math.abs(k[i]);
    if (v < 1 / maxRadius) continue;
    let peak = true;
    for (let d = 1; d <= minGap; d++) if (Math.abs(k[(i + d) % n]) > v || Math.abs(k[(i - d + n) % n]) > v) { peak = false; break; }
    if (peak) out.push(i);
  }
  return out;
}

/** Elapsed time within a lap at which the car reaches a distance (inverse of sampleAtTime). */
export function timeAtDistance(track: TrackProfile, profile: SpeedProfile, distance: number): number {
  const d = ((distance % track.length) + track.length) % track.length;
  const i = search(track.distance, d, track.count);
  const f = (d - track.distance[i]) / Math.max(1e-9, track.distance[i + 1] - track.distance[i]);
  return profile.time[i] + (profile.time[i + 1] - profile.time[i]) * f;
}
