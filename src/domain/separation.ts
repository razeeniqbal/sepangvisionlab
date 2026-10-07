// Keeping cars from passing through each other. Pure.
//
// Aligned OpenF1 positions carry a few metres of error, so two cars side by side, or nose to tail,
// can overlap in the replay although they never touched. The scene nudges them apart sideways,
// just enough to keep a gap, fading the nudge in and out so nothing jumps. Cars that race control
// says collided are left alone around the time of that incident.

import type { RaceControlRow } from "./recordedSession.ts";

/** Centre-to-centre distance (m) two cars keep side by side: ~2 m wide plus a margin. */
export const MIN_SIDE_GAP = 2.4;
/** Cars this close along the track (m) or closer count as overlapping in length (5.6 m long). */
export const OVERLAP_LENGTH = 5.8;
/** The nudge eases in from this far apart (m), so closing cars part gradually, not suddenly. */
export const EASE_IN_LENGTH = 9.5;
/** Never nudge a car more than this (m); larger overlaps are left (likely data, not racing). */
export const MAX_SHIFT = 2.0;
/** Lateral limit (m from the centre line) a nudge may push a car to: inside the 8 m half width. */
export const LATERAL_LIMIT = 7.2;
/** Malaysia time is UTC+8; race-control incident times are local. */
const LOCAL_OFFSET_MS = 8 * 3600_000;

export interface Contact {
  a: number;
  b: number;
  /** Incident time, ms since t0. */
  time: number;
}

/**
 * Collisions and contacts race control reports between two cars, at the incident time quoted in
 * the message, e.g. "INCIDENT INVOLVING CARS 16 (LEC) AND 27 (HUL) NOTED - CAUSING A COLLISION
 * (16:40:50)". Repeated messages about one incident collapse to one entry.
 */
export function contactsFrom(rows: readonly RaceControlRow[], t0: string): Contact[] {
  const day = new Date(Date.parse(t0) + LOCAL_OFFSET_MS).toISOString().slice(0, 10);
  const start = Date.parse(t0);
  const out: Contact[] = [];
  for (const r of rows) {
    const m = (r.message ?? "").toUpperCase();
    if (!/COLLISION|CONTACT/.test(m)) continue;
    const cars = /CARS (\d+) \([A-Z]+\) AND (\d+) \([A-Z]+\)/.exec(m);
    const at = /\((\d{2}):(\d{2}):(\d{2})\)/.exec(m);
    if (!cars || !at) continue;
    const time = Date.parse(`${day}T${at[1]}:${at[2]}:${at[3]}Z`) - LOCAL_OFFSET_MS - start;
    const a = Number(cars[1]),
      b = Number(cars[2]);
    if (!out.some((c) => c.time === time && ((c.a === a && c.b === b) || (c.a === b && c.b === a))))
      out.push({ a, b, time });
  }
  return out;
}

/** Whether two cars may touch at a time: within 10 s either side of a reported contact. */
export function contactAllowed(contacts: readonly Contact[], a: number, b: number, time: number) {
  return contacts.some(
    (c) => ((c.a === a && c.b === b) || (c.a === b && c.b === a)) && Math.abs(time - c.time) <= 10_000,
  );
}

export interface SeparationCar {
  number: number;
  /** Distance along the lap (m), 0..length. */
  distance: number;
  /** Signed offset from the centre line (m, + left). */
  lateral: number;
  /** Only cars on the race track take part (not the pit lane, garage or stale). */
  active: boolean;
  /** Speed (m/s): a fast car closing on a slow one moves aside earlier. */
  speed?: number;
}
/** The nudge takes at least this long (s) to build up at the closing speed. */
export const EASE_IN_SECONDS = 0.7;

const smoothstep = (edge0: number, edge1: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

/**
 * Sideways nudge (m, + left) per car so no two active cars overlap. For each overlapping pair the
 * missing side gap is shared between them, scaled by how much they overlap in length (fading to
 * zero at OVERLAP_LENGTH, so the nudge is continuous). Two passes settle three-wide moments.
 */
export function separationShifts(
  cars: readonly SeparationCar[],
  length: number,
  allowed: (a: number, b: number) => boolean = () => false,
) {
  const shift = new Map<number, number>(cars.map((c) => [c.number, 0]));
  const active = cars.filter((c) => c.active);
  for (let pass = 0; pass < 2; pass++)
    for (let i = 0; i < active.length; i++)
      for (let j = i + 1; j < active.length; j++) {
        const p = active[i],
          q = active[j];
        let ds = Math.abs(p.distance - q.distance);
        ds = Math.min(ds, length - ds);
        // Ease in over at least EASE_IN_SECONDS of closing: further out the faster they close.
        const ease = Math.max(EASE_IN_LENGTH, OVERLAP_LENGTH + Math.abs((p.speed ?? 0) - (q.speed ?? 0)) * EASE_IN_SECONDS);
        if (ds >= ease) continue;
        if (allowed(p.number, q.number)) continue;
        const lp = p.lateral + shift.get(p.number)!,
          lq = q.lateral + shift.get(q.number)!;
        const gap = Math.abs(lp - lq);
        if (gap >= MIN_SIDE_GAP) continue;
        // Ease in over distance, and fade out a car heading off the race track (towards the pit
        // lane or run-off) instead of dropping it, so its neighbour never snaps back.
        const weight =
          smoothstep(ease, OVERLAP_LENGTH - 0.8, ds) *
          smoothstep(9.5, 7.5, Math.abs(p.lateral)) *
          smoothstep(9.5, 7.5, Math.abs(q.lateral));
        const need = (MIN_SIDE_GAP - gap) * weight;
        // Push direction from the cars' own lines (+1: p goes left), with a fixed per-pair lean (the
        // lower number leans left) so two cars on the same line still part. It passes smoothly
        // through zero only when one car genuinely crosses the other's line, never flipping.
        const lean = p.number < q.number ? 0.8 : -0.8;
        const dir = Math.max(-1, Math.min(1, (p.lateral - q.lateral + lean) / 0.8));
        const half = (need / 2) * dir;
        const sp = Math.max(-MAX_SHIFT, Math.min(MAX_SHIFT, shift.get(p.number)! + half));
        const sq = Math.max(-MAX_SHIFT, Math.min(MAX_SHIFT, shift.get(q.number)! - half));
        shift.set(p.number, Math.max(-LATERAL_LIMIT - p.lateral, Math.min(LATERAL_LIMIT - p.lateral, sp)));
        shift.set(q.number, Math.max(-LATERAL_LIMIT - q.lateral, Math.min(LATERAL_LIMIT - q.lateral, sq)));
      }
  return shift;
}
