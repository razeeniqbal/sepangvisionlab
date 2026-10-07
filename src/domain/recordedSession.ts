// Recorded session playback (OpenF1 data, meeting 1308). Pure and deterministic: the same
// time always gives the same field, so seeks in either direction land on identical states.
// Positions are aligned to the metric profile with the DERIVED Step 3 transform.
import type { CarState, TyreCompound } from "./field.ts";
import { poseAtDistance, type TrackProfile } from "./lapPhysics.ts";
import { apply, nearestOnTrack, type Similarity } from "./alignment.ts";
import { curvatureAt } from "./carMotion.ts";
import { pitOffsetAt, type PitLane } from "./pitLane.ts";

export const STALE_AFTER_MS = 2000;
/** |lateral| beyond this is off the racing surface (pit lane, garage): drawn raw, not snapped. */
export const ON_TRACK_METRES = 10; // the DERIVED pit lane runs ~12 m off the centre line, so it must fall outside

// ---- file formats (written by scripts/build_recorded_session.py) ----
export interface DriverIdentity {
  driver_number: number;
  name_acronym: string;
  full_name: string;
  first_name?: string;
  last_name?: string;
  broadcast_name?: string;
  team_name: string;
  team_colour: string | null;
}
export interface LapRow { d: number; n: number; t: number | null; dur: number | null; s1?: number | null; s2?: number | null; s3?: number | null; pitOut: boolean }
export interface StintRow { d: number; n: number; lapStart: number | null; lapEnd: number | null; compound: string | null; ageStart: number | null }
export interface PitRow { d: number; t: number; lap: number | null; lane: number | null; stop: number | null }
export interface PositionRow { d: number; t: number; p: number }
export interface IntervalRow { d: number; t: number; gap: number | string | null; int: number | string | null }
export interface RaceControlRow { t: number; lap: number | null; category: string | null; flag: string | null; scope: string | null; sector: number | null; d: number | null; message: string | null }
export interface WeatherRow { t: number; air: number | null; track: number | null; rain: number | null; humidity: number | null; wind: number | null }
/** One row of the official classification (OpenF1 session_result). */
export interface ResultRow {
  position: number | null;
  driver_number: number;
  dnf?: boolean;
  dns?: boolean;
  dsq?: boolean;
}

export interface SessionFile {
  schemaVersion: 1;
  label: string;
  attribution: string;
  meetingKey: number;
  sessionKey: number;
  sessionName: string;
  slug: string;
  t0: string;
  durationMs: number;
  drivers: DriverIdentity[];
  laps: LapRow[];
  stints: StintRow[];
  pit: PitRow[];
  position: PositionRow[];
  intervals: IntervalRow[];
  raceControl: RaceControlRow[];
  weather: WeatherRow[];
  /** Official classification (OpenF1 session_result). */
  result?: ResultRow[];
}
export interface DriverFile {
  number: number;
  location: { t: number[]; x: number[]; y: number[]; z: number[] };
  telemetry: { t: number[]; speed: number[]; rpm: number[]; gear: number[]; throttle: number[]; brake: number[]; drs: number[] };
}

export function undelta(values: readonly number[]): Float64Array {
  const out = new Float64Array(values.length);
  let total = 0;
  for (let i = 0; i < values.length; i++) out[i] = total += values[i];
  return out;
}

// ---- per-driver motion, prepared once ----
export interface DriverTrack {
  number: number;
  t: Float64Array; // ms since t0
  s: Float64Array; // unwrapped distance along the profile, metres
  lateral: Float64Array; // signed offset from the centre line, metres (+ left)
  wx: Float64Array; // aligned world position, metres
  wy: Float64Array;
  /** Per sample: 1 on the race track, 2 in the DERIVED pit lane, 0 elsewhere (garage, grass). */
  road: Uint8Array;
  tel: { t: Float64Array; speed: Float64Array; rpm: Float64Array; gear: Float64Array; throttle: Float64Array; brake: Float64Array; drs: Float64Array };
}

/** Align every sample, project it on the centre line and unwrap lap crossings. */
export function prepareDriver(file: DriverFile, transform: Similarity, track: TrackProfile, pit?: PitLane): DriverTrack {
  const t = undelta(file.location.t), x = undelta(file.location.x), y = undelta(file.location.y);
  const n = t.length, L = track.length;
  const s = new Float64Array(n), lateral = new Float64Array(n), wx = new Float64Array(n), wy = new Float64Array(n);
  let offset = 0, previous = NaN;
  for (let i = 0; i < n; i++) {
    const w = apply(transform, { x: x[i], y: y[i] });
    wx[i] = w.x; wy[i] = w.y;
    const q = nearestOnTrack(track, w);
    const j = (q.index + 1) % track.count;
    const along = track.distance[q.index] + (track.distance[q.index + 1] - track.distance[q.index]) * q.fraction;
    // Signed lateral: + when the car is left of the direction of travel.
    const ex = track.x[j] - track.x[q.index], ey = track.y[j] - track.y[q.index];
    lateral[i] = Math.sign(ex * (w.y - q.y) - ey * (w.x - q.x)) * q.distance;
    if (!Number.isNaN(previous)) {
      const step = along - previous;
      if (step < -L / 2) offset += L;
      else if (step > L / 2) offset -= L;
    }
    previous = along;
    s[i] = along + offset;
  }
  // Classify on the raw offsets, then smooth along both roads: the pit lane gets the same
  // jitter-free, curve-following motion as the race track.
  const road = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const k = Math.floor((((s[i] % L) + L) % L / L) * track.count) % track.count;
    const lane = pit ? pitOffsetAt(pit, k, track.count) : null;
    road[i] = Math.abs(lateral[i]) <= ON_TRACK_METRES ? 1 : lane !== null && Math.abs(lateral[i] - lane) <= 4.5 ? 2 : 0;
  }
  const onRoad = (k: number) => road[k] > 0;
  smoothDistance(t, s, lateral, onRoad);
  smoothLateral(t, lateral, onRoad);
  const c = file.telemetry;
  return {
    number: file.number, t, s, lateral, wx, wy, road,
    tel: {
      t: undelta(c.t), speed: Float64Array.from(c.speed), rpm: Float64Array.from(c.rpm), gear: Float64Array.from(c.gear),
      throttle: Float64Array.from(c.throttle), brake: Float64Array.from(c.brake), drs: Float64Array.from(c.drs),
    },
  };
}

/**
 * Gaussian-weighted local linear fit of `v` against time at every sample, using only on-track
 * samples within 3σ and without a data gap. A straight-line fit (not an average) keeps constant
 * speed and steady drifts exact and ignores timing jitter; the Gaussian keeps it smooth enough
 * that the rendered motion stays within what a car can do (see scripts/physics-check.ts).
 */
function localLinear(t: ArrayLike<number>, v: ArrayLike<number>, on: (k: number) => boolean, sigma: number) {
  const out = Float64Array.from(v);
  const reach = 3 * sigma;
  for (let i = 0; i < out.length; i++) {
    if (!on(i)) continue;
    let w0 = 0, wt = 0, wv = 0;
    let lo = i, hi = i;
    while (lo > 0 && t[i] - t[lo - 1] <= reach && on(lo - 1) && t[lo] - t[lo - 1] <= STALE_AFTER_MS) lo--;
    while (hi < out.length - 1 && t[hi + 1] - t[i] <= reach && on(hi + 1) && t[hi + 1] - t[hi] <= STALE_AFTER_MS) hi++;
    if (hi - lo < 2) continue;
    for (let j = lo; j <= hi; j++) {
      const w = Math.exp(-0.5 * ((t[j] - t[i]) / sigma) ** 2);
      w0 += w;
      wt += w * t[j];
      wv += w * v[j];
    }
    const mt = wt / w0, mv = wv / w0;
    let num = 0, den = 0;
    for (let j = lo; j <= hi; j++) {
      const w = Math.exp(-0.5 * ((t[j] - t[i]) / sigma) ** 2);
      num += w * (t[j] - mt) * (v[j] - mv);
      den += w * (t[j] - mt) ** 2;
    }
    out[i] = den > 0 ? mv + (num / den) * (t[i] - mt) : mv;
  }
  return out;
}

/**
 * OpenF1 position timestamps jitter: a car at 200 km/h can "move" 0.5 m in 160 ms and then
 * jump ahead, and a few samples even step backwards. Passed through faithfully, the car stalls
 * and lurches. On-track distance is refitted (σ 350 ms) and kept non-decreasing. Pit-lane and
 * garage samples are left raw.
 */
export function smoothDistance(
  t: ArrayLike<number>,
  s: Float64Array,
  lateral: ArrayLike<number>,
  on: (k: number) => boolean = (k) => Math.abs(lateral[k]) <= ON_TRACK_METRES,
) {
  s.set(localLinear(t, s, on, 500));
  for (let i = 1; i < s.length; i++)
    if (on(i) && on(i - 1) && t[i] - t[i - 1] <= STALE_AFTER_MS && s[i] < s[i - 1]) s[i] = s[i - 1];
}

/**
 * Positioning noise makes the across-track offset wobble by up to a metre between samples,
 * which reads as a twitching car. A Gaussian local linear fit (σ 450 ms) keeps the racing line
 * and lane changes. Only on-track runs without data gaps are smoothed; pit-lane and garage
 * samples keep their raw value.
 */
export function smoothLateral(t: ArrayLike<number>, lateral: Float64Array, on?: (k: number) => boolean) {
  const raw = Float64Array.from(lateral);
  lateral.set(localLinear(t, raw, on ?? ((k) => Math.abs(raw[k]) <= ON_TRACK_METRES), 600));
}

/** Last index with arr[i] <= value, or -1. */
export function lastAtOrBefore(arr: ArrayLike<number>, value: number): number {
  let lo = 0, hi = arr.length - 1, out = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid] <= value) { out = mid; lo = mid + 1; } else hi = mid - 1;
  }
  return out;
}

export interface MotionSample {
  present: boolean; // false before the first sample
  stale: boolean; // no fresh sample for more than STALE_AFTER_MS: held, not invented
  onTrack: boolean; // snapped to the profile (race track or DERIVED pit lane); false = raw aligned position
  pitLane: boolean; // in the DERIVED pit lane
  distance: number; // unwrapped metres
  lateral: number;
  x: number;
  y: number;
  heading: number;
}

/**
 * Monotone cubic Hermite (Fritsch-Carlson) between samples i and j, with tangents from the
 * neighbouring samples. It passes through every sample, never overshoots between two of them,
 * and keeps speed continuous, so cars no longer jerk at each ~4 Hz sample. Returns the value
 * and its rate per millisecond. Neighbours across a data gap are ignored.
 */
function smoothBetween(t: ArrayLike<number>, v: ArrayLike<number>, i: number, j: number, f: number) {
  const gap = t[j] - t[i];
  if (j === i || !(gap > 0)) return { value: v[i], rate: 0 };
  const chord = (v[j] - v[i]) / gap;
  const slope = (a: number, b: number) => {
    const dt = t[b] - t[a];
    return dt > 0 && dt <= STALE_AFTER_MS + gap ? (v[b] - v[a]) / dt : chord;
  };
  const limit = (m: number) => (chord === 0 || Math.sign(m) !== Math.sign(chord) ? 0 : Math.sign(chord) * Math.min(Math.abs(m), 3 * Math.abs(chord)));
  const mi = limit(i > 0 && t[i] - t[i - 1] <= STALE_AFTER_MS ? slope(i - 1, j) : chord);
  const mj = limit(j + 1 < t.length && t[j + 1] - t[j] <= STALE_AFTER_MS ? slope(i, j + 1) : chord);
  const f2 = f * f, f3 = f2 * f;
  const value = (2 * f3 - 3 * f2 + 1) * v[i] + (f3 - 2 * f2 + f) * gap * mi + (3 * f2 - 2 * f3) * v[j] + (f3 - f2) * gap * mj;
  const rate = ((6 * f2 - 6 * f) * (v[i] - v[j])) / gap + (3 * f2 - 4 * f + 1) * mi + (3 * f2 - 2 * f) * mj;
  return { value, rate };
}

/** Largest yaw (rad) off the centre-line direction: cars cross the track at up to ~20 deg on a racing line. */
const MAX_LANE_YAW = 0.4;

/** Motion at a time: smooth between samples, held (and marked stale) across gaps. */
export function motionAt(d: DriverTrack, track: TrackProfile, time: number): MotionSample {
  const i = lastAtOrBefore(d.t, time);
  if (i < 0) return { present: false, stale: true, onTrack: false, pitLane: false, distance: d.s[0] ?? 0, lateral: 0, x: d.wx[0] ?? 0, y: d.wy[0] ?? 0, heading: 0 };
  const j = i + 1 < d.t.length ? i + 1 : i;
  const gap = d.t[j] - d.t[i];
  const hold = j === i || gap > STALE_AFTER_MS;
  const stale = hold && time - d.t[i] > STALE_AFTER_MS;
  const f = hold || gap <= 0 ? 0 : (time - d.t[i]) / gap;
  const onTrack = d.road[i] > 0 && d.road[j] > 0;
  const pitLane = d.road[i] === 2 || d.road[j] === 2;
  const along = smoothBetween(d.t, d.s, i, hold ? i : j, f);
  const across = smoothBetween(d.t, d.lateral, i, hold ? i : j, f);
  const distance = along.value;
  const lateral = across.value;
  if (onTrack) {
    const pose = poseAtDistance(track, distance);
    const nx = -Math.sin(pose.heading), ny = Math.cos(pose.heading);
    // Point the car along its true path: on a racing line it crosses the track diagonally, and
    // off the centre line the ground covered per metre of centre line is scaled by (1 - k·lateral).
    // Faded in from 8 m/s: at walking pace the lateral noise would swing the nose around.
    const fade = Math.max(0, Math.min(1, (along.rate - 0.008) / 0.012));
    const forward = along.rate * Math.max(0.2, 1 - curvatureAt(track, distance) * lateral);
    const yaw = fade * Math.max(-MAX_LANE_YAW, Math.min(MAX_LANE_YAW, Math.atan2(across.rate, forward)));
    return { present: true, stale, onTrack, pitLane, distance, lateral, x: pose.x + nx * lateral, y: pose.y + ny * lateral, heading: pose.heading + yaw };
  }
  // Off the profile (pit lane centre line is UNAVAILABLE): raw aligned position, no snapping.
  const x = d.wx[i] + (d.wx[j] - d.wx[i]) * f, y = d.wy[i] + (d.wy[j] - d.wy[i]) * f;
  let k = j;
  while (k < d.t.length - 1 && Math.hypot(d.wx[k] - d.wx[i], d.wy[k] - d.wy[i]) < 1) k++;
  const heading = k > i ? Math.atan2(d.wy[k] - d.wy[i], d.wx[k] - d.wx[i]) : 0;
  return { present: true, stale, onTrack, pitLane, distance, lateral, x, y, heading };
}

export interface TelemetrySample { speed: number; rpm: number; gear: number; throttle: number; brake: number; drs: number; fresh: boolean }
export function telemetryAt(d: DriverTrack, time: number): TelemetrySample {
  const c = d.tel, i = lastAtOrBefore(c.t, time);
  if (i < 0) return { speed: 0, rpm: 0, gear: 0, throttle: 0, brake: 0, drs: -1, fresh: false };
  const j = i + 1 < c.t.length ? i + 1 : i;
  const gap = c.t[j] - c.t[i];
  const f = j === i || gap <= 0 || gap > STALE_AFTER_MS ? 0 : (time - c.t[i]) / gap;
  return {
    speed: c.speed[i] + (c.speed[j] - c.speed[i]) * f,
    rpm: c.rpm[i] + (c.rpm[j] - c.rpm[i]) * f,
    gear: c.gear[i], throttle: c.throttle[i], brake: c.brake[i], drs: c.drs[i],
    fresh: time - c.t[i] <= STALE_AFTER_MS,
  };
}

/**
 * Forces on the car (in g) from its recorded motion, as a passenger would feel them.
 * Longitudinal: the change of smoothed speed along the track over ±150 ms (positive under
 * acceleration). Lateral: speed × yaw rate of the car's real path over the same window
 * (positive turning left). Clamped to ±6.5 g, the envelope of a real car; zero when stopped,
 * off the track model or stale.
 */
export function gForcesAt(d: DriverTrack, track: TrackProfile, time: number, h = 150) {
  const a = motionAt(d, track, time - h),
    b = motionAt(d, track, time),
    c = motionAt(d, track, time + h);
  if (!a.onTrack || !b.onTrack || !c.onTrack || b.stale || !b.present) return { long: 0, lat: 0 };
  const dt = h / 1000;
  const v1 = Math.hypot(b.x - a.x, b.y - a.y) / dt,
    v2 = Math.hypot(c.x - b.x, c.y - b.y) / dt;
  const v = (v1 + v2) / 2;
  if (v < 3) return { long: 0, lat: 0 };
  const h1 = Math.atan2(b.y - a.y, b.x - a.x),
    h2 = Math.atan2(c.y - b.y, c.x - b.x);
  const yawRate = Math.atan2(Math.sin(h2 - h1), Math.cos(h2 - h1)) / dt;
  const clamp = (g: number) => Math.max(-6.5, Math.min(6.5, g));
  return { long: clamp((v2 - v1) / dt / 9.81), lat: clamp((v * yawRate) / 9.81) };
}

// ---- timing, tyres and session state ----
export function latestFor<T extends { d: number; t: number }>(rows: readonly T[], time: number): Map<number, T> {
  const out = new Map<number, T>();
  for (const r of rows) if (r.t <= time) { const prev = out.get(r.d); if (!prev || prev.t <= r.t) out.set(r.d, r); }
  return out;
}

export function lapsCompleted(laps: readonly LapRow[], driver: number, time: number) {
  let current = 0, best: number | null = null, last: number | null = null, bestLapNumber: number | null = null;
  for (const l of laps) {
    if (l.d !== driver || l.t === null || l.t > time) continue;
    current = Math.max(current, l.n);
    if (l.dur && l.t + l.dur * 1000 <= time) {
      last = l.dur;
      if (best === null || l.dur < best) { best = l.dur; bestLapNumber = l.n; }
    }
  }
  return { lap: current, best, last, bestLapNumber };
}

/**
 * OpenF1 stints can be split, out of order or mislabelled: in the 2026 race most cars "change" to
 * slicks on lap 2 or 3 with no stop. A new set can only start on a pit-out lap, so sets are rebuilt
 * from the laps' pit-out flags. A set whose OpenF1 labels disagree is left UNKNOWN, never guessed.
 * Sessions whose stints already match the pit-out laps come out unchanged.
 */
export function reconcileStints(stints: readonly StintRow[], laps: readonly LapRow[]): StintRow[] {
  const out: StintRow[] = [];
  for (const d of new Set(stints.map((s) => s.d))) {
    const own = stints.filter((s) => s.d === d && s.lapStart !== null && (s.lapEnd ?? s.lapStart) >= s.lapStart);
    if (!own.length) continue;
    const driverLaps = laps.filter((l) => l.d === d);
    const last = Math.max(...own.map((s) => s.lapEnd ?? s.lapStart!), ...driverLaps.map((l) => l.n));
    const starts = [...new Set([1, ...driverLaps.filter((l) => l.pitOut).map((l) => l.n)])].sort((a, b) => a - b);
    starts.forEach((start, i) => {
      const end = i + 1 < starts.length ? starts[i + 1] - 1 : last;
      const labels = new Set(
        own
          .filter((s) => s.lapStart! <= end && (s.lapEnd ?? s.lapStart!) >= start && s.compound)
          .map((s) => s.compound),
      );
      const exact = own.find((s) => s.lapStart === start);
      out.push({
        d,
        n: i + 1,
        lapStart: start,
        lapEnd: end,
        compound: labels.size === 1 ? [...labels][0] : null,
        ageStart: exact?.ageStart ?? 0,
      });
    });
  }
  return out;
}
const reconciled = new WeakMap<readonly StintRow[], StintRow[]>();

const COMPOUNDS: readonly TyreCompound[] = ["SOFT", "MEDIUM", "HARD", "INTERMEDIATE", "WET"];
export function tyreAt(stints: readonly StintRow[], driver: number, lap: number): { compound: TyreCompound; age: number } {
  let chosen: StintRow | null = null;
  for (const s of stints) {
    if (s.d !== driver || s.lapStart === null) continue;
    if (s.lapStart <= Math.max(lap, 1) && (!chosen || s.lapStart >= chosen.lapStart!)) chosen = s;
  }
  if (!chosen) return { compound: "UNKNOWN", age: 0 };
  const compound = COMPOUNDS.find((c) => c === chosen!.compound) ?? "UNKNOWN";
  return { compound, age: (chosen.ageStart ?? 0) + Math.max(0, lap - chosen.lapStart!) };
}

export function inPitLane(pit: readonly PitRow[], driver: number, time: number) {
  return pit.some((p) => p.d === driver && time >= p.t && time <= p.t + (p.lane ?? 25) * 1000);
}

export type TrackStatus = "GREEN" | "YELLOW" | "SC" | "VSC" | "RED" | "CHEQUERED" | "NONE";
/** Track status from race control up to a time; sector yellows are tracked per sector. */
export function trackStatusAt(rows: readonly RaceControlRow[], time: number) {
  let status: TrackStatus = "NONE";
  const yellow = new Set<number>();
  let latest: RaceControlRow | null = null;
  for (const r of rows) {
    if (r.t > time) break;
    latest = r;
    const msg = (r.message ?? "").toUpperCase(), flag = (r.flag ?? "").toUpperCase();
    if (r.category === "SafetyCar") {
      if (msg.includes("VSC DEPLOYED") || msg.includes("VIRTUAL SAFETY CAR DEPLOYED")) status = "VSC";
      else if (msg.includes("SAFETY CAR DEPLOYED")) status = "SC";
    } else if (r.category === "Flag") {
      if (r.scope === "Sector" && r.sector !== null) {
        if (flag === "YELLOW" || flag === "DOUBLE YELLOW") yellow.add(r.sector);
        else if (flag === "CLEAR" || flag === "GREEN") yellow.delete(r.sector);
      } else if (r.scope === "Track" || r.scope === null) {
        if (flag === "RED") status = "RED";
        else if (flag === "CHEQUERED") status = "CHEQUERED";
        else if (flag === "GREEN" || flag === "CLEAR") { status = "GREEN"; yellow.clear(); }
        else if (flag === "YELLOW" || flag === "DOUBLE YELLOW") status = "YELLOW";
      }
    }
  }
  const effective: TrackStatus = status === "GREEN" && yellow.size ? "YELLOW" : status;
  return { status: effective, yellowSectors: [...yellow].sort((a, b) => a - b), latest };
}

export type MarkerKind = "yellow" | "sc" | "vsc" | "red" | "chequered" | "trackLimits" | "start";
export interface Marker { t: number; kind: MarkerKind; label: string }
/** Timeline markers; sector yellows within 20 s of each other merge into one. */
export function extractMarkers(rows: readonly RaceControlRow[]): Marker[] {
  const out: Marker[] = [];
  for (const r of rows) {
    const msg = (r.message ?? "").toUpperCase(), flag = (r.flag ?? "").toUpperCase();
    let kind: MarkerKind | null = null;
    if (r.category === "SafetyCar") kind = msg.includes("VSC DEPLOYED") || msg.includes("VIRTUAL SAFETY CAR DEPLOYED") ? "vsc" : msg.includes("SAFETY CAR DEPLOYED") ? "sc" : null;
    else if (r.category === "Flag" && flag === "RED") kind = "red";
    else if (r.category === "Flag" && flag === "CHEQUERED") kind = "chequered";
    else if (r.category === "Flag" && (flag === "YELLOW" || flag === "DOUBLE YELLOW")) kind = "yellow";
    else if (msg.includes("TRACK LIMITS")) kind = "trackLimits";
    else if (r.category === "SessionStatus" && msg.includes("STARTED")) kind = "start";
    if (!kind) continue;
    const prev = out[out.length - 1];
    if (kind === "yellow" && prev?.kind === "yellow" && r.t - prev.t <= 20000) continue;
    out.push({ t: r.t, kind, label: r.message ?? kind });
  }
  return out;
}

export function weatherAt(rows: readonly WeatherRow[], time: number): WeatherRow | null {
  let out: WeatherRow | null = null;
  for (const r of rows) { if (r.t > time) break; out = r; }
  return out ?? rows[0] ?? null;
}

/** Where to open the replay: the session start signal, else the scheduled start (t0 + 5 min). */
export function defaultStart(session: SessionFile): number {
  const start = session.raceControl.find((r) => r.category === "SessionStatus" && (r.message ?? "").toUpperCase().includes("STARTED") && r.t >= 0);
  return start ? start.t : Math.min(300000, session.durationMs);
}

// ---- the field, in the same shape the simulated session provides ----
export interface RecordedCarState extends CarState {
  pose: { x: number; y: number; heading: number };
  present: boolean;
  stale: boolean;
  inPit: boolean;
  onTrack: boolean;
  throttle: number;
  brake: number;
  gear: number;
  rpm: number;
  drs: number;
  telemetryFresh: boolean;
  lap: number;
  bestLap: number | null;
  lastLap: number | null;
  gapText: string | null;
  intervalText: string | null;
  /** Longitudinal and lateral g from the recorded motion (see gForcesAt). */
  gLong: number;
  gLat: number;
}

export interface RecordedSession {
  file: SessionFile;
  track: TrackProfile;
  drivers: DriverTrack[];
}

const fmtGap = (v: number | string | null | undefined) =>
  v === null || v === undefined ? null : typeof v === "number" ? "+" + v.toFixed(3) : String(v);

export function recordedFieldAt(session: RecordedSession, time: number): RecordedCarState[] {
  const { file, track } = session;
  const t = Math.max(0, Math.min(file.durationMs, time));
  const positions = latestFor(file.position, t);
  const intervals = latestFor(file.intervals, t);
  const cars = session.drivers.map((d) => {
    const m = motionAt(d, track, t), tel = telemetryAt(d, t), g = gForcesAt(d, track, t);
    const laps = lapsCompleted(file.laps, d.number, t);
    let stints = reconciled.get(file.stints);
    if (!stints) reconciled.set(file.stints, (stints = reconcileStints(file.stints, file.laps)));
    const tyre = tyreAt(stints, d.number, laps.lap);
    const L = track.length;
    const iv = intervals.get(d.number);
    return {
      id: "d" + d.number,
      number: String(d.number),
      position: positions.get(d.number)?.p ?? 99,
      progress: Math.min(1 - 1e-12, (((m.distance % L) + L) % L) / L),
      completedLaps: Math.max(0, laps.lap - 1),
      speedKph: tel.speed,
      compound: tyre.compound,
      tyreAge: tyre.age,
      pose: { x: m.x, y: m.y, heading: m.heading },
      present: m.present,
      stale: m.stale,
      inPit: inPitLane(file.pit, d.number, t) || (m.present && (m.pitLane || !m.onTrack)),
      onTrack: m.onTrack,
      throttle: tel.throttle,
      brake: tel.brake,
      gear: tel.gear,
      rpm: tel.rpm,
      drs: tel.drs,
      telemetryFresh: tel.fresh,
      lap: laps.lap,
      bestLap: laps.best,
      lastLap: laps.last,
      gapText: fmtGap(iv?.gap),
      intervalText: fmtGap(iv?.int),
      gLong: g.long,
      gLat: g.lat,
    } satisfies RecordedCarState;
  });
  // Cars without a position yet are ordered after classified ones by distance covered.
  const ordered = [...cars].sort((a, b) => a.position - b.position || b.completedLaps + b.progress - (a.completedLaps + a.progress));
  ordered.forEach((car, i) => { if (car.position === 99) car.position = i + 1; });
  return cars;
}
