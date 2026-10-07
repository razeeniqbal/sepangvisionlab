// Comparing two drivers on the same lap. Pure; built only from recorded laps, motion and telemetry.
import type { TrackProfile } from "./lapPhysics.ts";
import { motionAt, telemetryAt, type DriverTrack, type LapRow } from "./recordedSession.ts";

export interface LapWindow {
  n: number;
  t: number; // ms since t0
  dur: number; // seconds
}

/** A driver's timed lap n, or null when it has no start time or duration. */
export function lapWindow(laps: readonly LapRow[], driver: number, n: number): LapWindow | null {
  const lap = laps.find((l) => l.d === driver && l.n === n);
  return lap && lap.t !== null && lap.dur ? { n, t: lap.t, dur: lap.dur } : null;
}

/** The lap a driver is on at a time, or null between laps or before the first. */
export function currentLap(laps: readonly LapRow[], driver: number, time: number): LapWindow | null {
  for (const l of laps)
    if (l.d === driver && l.t !== null && l.dur && time >= l.t && time < l.t + l.dur * 1000)
      return { n: l.n, t: l.t, dur: l.dur };
  return null;
}

/**
 * Ghost time: where the rival was at the same moment of the same lap. If the followed driver is
 * `elapsed` seconds into lap n, the ghost is the rival `elapsed` seconds into their own lap n
 * (held at its end if the rival's lap was shorter). Null when either lap is missing.
 */
export function ghostTime(laps: readonly LapRow[], me: number, rival: number, time: number) {
  const mine = currentLap(laps, me, time);
  if (!mine) return null;
  const theirs = lapWindow(laps, rival, mine.n);
  if (!theirs) return null;
  return theirs.t + Math.min(time - mine.t, theirs.dur * 1000);
}

export interface TracePoint {
  s: number; // metres from the start of the lap
  v: number; // km/h
}

/** Speed against distance through a lap, sampled every `step` ms of the lap. */
export function speedTrace(d: DriverTrack, track: TrackProfile, lap: LapWindow, step = 200): TracePoint[] {
  const start = motionAt(d, track, lap.t).distance;
  const out: TracePoint[] = [];
  for (let t = lap.t; t <= lap.t + lap.dur * 1000; t += step) {
    const m = motionAt(d, track, t);
    if (!m.present) continue;
    out.push({ s: m.distance - start, v: telemetryAt(d, t).speed });
  }
  return out;
}

/**
 * Time gap through the lap at matching distances: positive when the rival is behind (slower to
 * reach that point). Both traces must be sampled at the same step (ms).
 */
export function deltaAt(mine: readonly TracePoint[], theirs: readonly TracePoint[], s: number, step = 200) {
  const timeTo = (trace: readonly TracePoint[]) => {
    const i = trace.findIndex((p) => p.s >= s);
    if (i <= 0) return i === 0 ? 0 : null;
    const a = trace[i - 1],
      b = trace[i];
    const f = b.s > a.s ? (s - a.s) / (b.s - a.s) : 0;
    return ((i - 1 + f) * step) / 1000;
  };
  const a = timeTo(mine),
    b = timeTo(theirs);
  return a === null || b === null ? null : b - a;
}
