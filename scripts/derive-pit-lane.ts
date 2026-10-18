// DERIVES the pit lane from where cars actually drove during the 2026 race pit stops.
// For every pit stop, the aligned positions from leaving the track to rejoining it form one
// pass; the centre line is refined from all passes (pitPathFromRuns), so it follows the real
// road, including the entry that leaves the track at the final hairpin. The across-track offset
// per track sample is then measured from that centre line.
// Writes src/data/circuits/sepangPitLane.json. Run:
//   node --experimental-strip-types scripts/derive-pit-lane.ts
import { readFileSync, writeFileSync } from "node:fs";
import { nearestOnTrack } from "../src/domain/alignment.ts";
import { projectCircuit } from "../src/domain/circuitGeometry.ts";
import { CIRCUIT_LENGTH_METERS } from "../src/domain/field.ts";
import { buildTrackProfile } from "../src/domain/lapPhysics.ts";
import { STALE_AFTER_MS, prepareDriver, type DriverFile } from "../src/domain/recordedSession.ts";
import { pitPathFromRuns, resample, type PitPath } from "../src/domain/pitLane.ts";

/** A car this far (m) from the centre line has left the racing surface (it is 16 m wide). */
const LEFT_TRACK = 6.5;

const read = (p: string) => JSON.parse(readFileSync(new URL(p, import.meta.url), "utf8"));
const track = buildTrackProfile(
  projectCircuit(read("../src/data/circuits/sepang.json").features[0].geometry.coordinates, 1),
  4,
  CIRCUIT_LENGTH_METERS,
);
const n = track.count;
const transform = read("../public/sessions/1308/alignment.json").transform;
const race = read("../public/sessions/1308/race/session.json");
const cache = new Map<number, ReturnType<typeof prepareDriver>>();
const runs: PitPath[] = [];
for (const stop of race.pit) {
  if (!cache.has(stop.d))
    cache.set(stop.d, prepareDriver(read(`../public/sessions/1308/race/drivers/${stop.d}.json`) as DriverFile, transform, track));
  const d = cache.get(stop.d)!;
  // The stop time sits near the pit exit: look back over the lane time plus the entry road.
  const start = stop.t - (stop.lane ?? 30) * 1000 - 30000, end = stop.t + 20000;
  let best: number[] = [], run: number[] = [];
  for (let i = 0; i < d.t.length; i++) {
    if (d.t[i] < start || d.t[i] > end) continue;
    const off = Math.abs(d.lateral[i]) > LEFT_TRACK;
    if (off && (!run.length || d.t[i] - d.t[run[run.length - 1]] <= STALE_AFTER_MS)) run.push(i);
    else run = off ? [i] : [];
    if (run.length > best.length) best = [...run];
  }
  if (best.length <= 20) continue;
  // Include the last sample on the track before and the first after, so the road meets the
  // track where cars turn off and rejoin (positions are ~4 Hz, with gaps right at the turn-off).
  const pass = [best[0] - 1, ...best, best[best.length - 1] + 1].filter((i) => i >= 0 && i < d.t.length);
  runs.push({ x: pass.map((i) => d.wx[i]), y: pass.map((i) => d.wy[i]) });
}
const refined = pitPathFromRuns(runs);
if (!refined) throw new Error("No pit lane found in the race data");
// Positions are sparse right where cars turn off at the hairpin: if an end of the road stops
// short of the track, join it to the track edge at the nearest sample.
const toEdge = (x: number, y: number) => {
  const q = nearestOnTrack(track, { x, y });
  if (q.distance <= 10) return null;
  const f = (q.distance - 6) / q.distance;
  return { x: x + (q.x - x) * f, y: y + (q.y - y) * f };
};
const head = toEdge(refined.x[0], refined.y[0]), tail = toEdge(refined.x.at(-1)!, refined.y.at(-1)!);
const path = resample(
  {
    x: [...(head ? [head.x] : []), ...refined.x, ...(tail ? [tail.x] : [])],
    y: [...(head ? [head.y] : []), ...refined.y, ...(tail ? [tail.y] : [])],
  },
  4,
);

// Across-track offset per profile sample, from the centre line. Near the hairpin the road
// leaves sideways, so its first points project slightly backwards along the track: offsets
// start after the last such step, and the first samples are filled from the first projection.
const projected = path.x.map((x, v) => {
  const p = { x, y: path.y[v] };
  const q = nearestOnTrack(track, p);
  const j = (q.index + 1) % n;
  const ex = track.x[j] - track.x[q.index], ey = track.y[j] - track.y[q.index];
  return { k: q.index + q.fraction, lateral: Math.sign(ex * (p.y - q.y) - ey * (p.x - q.x)) * q.distance };
});
let unwrap = 0;
for (let v = 1; v < projected.length; v++) {
  const step = projected[v].k + unwrap - projected[v - 1].k;
  if (step < -n / 2) unwrap += n;
  projected[v].k += unwrap;
}
const side = Math.sign(projected.reduce((s, p) => s + p.lateral, 0)) as -1 | 1;
let first = 0;
for (let v = 1; v < projected.length; v++) if (projected[v].k < projected[v - 1].k - 0.5) first = v;
const from = Math.ceil(projected[first].k), to = Math.floor(projected[projected.length - 1].k);
const offsets: number[] = [];
for (let k = from, v = first; k <= to; k++) {
  while (v + 1 < projected.length - 1 && projected[v + 1].k < k) v++;
  const a = projected[v], b = projected[v + 1];
  const f = Math.max(0, Math.min(1, (k - a.k) / Math.max(1e-9, b.k - a.k)));
  offsets.push(a.lateral + (b.lateral - a.lateral) * f);
}
const round = (v: number) => Math.round(v * 100) / 100;
writeFileSync(
  new URL("../src/data/circuits/sepangPitLane.json", import.meta.url),
  JSON.stringify(
    {
      schemaVersion: 2,
      accuracyClass: "DERIVED",
      description:
        "Pit lane centre line from aligned OpenF1 positions during the 2026 race pit stops: every pass from leaving the track to rejoining it, refined to the median across-road position every 4 m (path, world metres), and as a signed across-track offset per track profile sample (offsets, metres, + left of travel). Width and wall are illustrative.",
      source: "OpenF1 location, session 11731, aligned with public/sessions/1308/alignment.json",
      stops: race.pit.length,
      passes: runs.length,
      from: ((from % n) + n) % n,
      to: ((from % n) + n) % n + (to - from),
      side,
      offsets: offsets.map(round),
      path: { x: path.x.map(round), y: path.y.map(round) },
    },
    null,
    1,
  ) + "\n",
);
console.log(
  `pit lane: ${runs.length} passes, path ${path.x.length} points (${(path.x.length * 4).toFixed(0)} m), samples ${from}..${to}, side ${side}, offsets ${Math.min(...offsets).toFixed(1)}..${Math.max(...offsets).toFixed(1)} m`,
);
