// Physics check on rendered motion: sample every car at 50 Hz across the race and count frames
// where the motion would need more than ~6 g (longitudinal or lateral), the limit of a real car.
// Run: node --experimental-strip-types scripts/physics-check.ts
import { readFileSync } from "node:fs";
import { projectCircuit } from "../src/domain/circuitGeometry.ts";
import { CIRCUIT_LENGTH_METERS } from "../src/domain/field.ts";
import { buildTrackProfile } from "../src/domain/lapPhysics.ts";
import { motionAt, prepareDriver, type DriverFile } from "../src/domain/recordedSession.ts";

const read = (p: string) => JSON.parse(readFileSync(new URL(p, import.meta.url), "utf8"));
const coords = read("../src/data/circuits/sepang.json").features[0].geometry.coordinates;
const track = buildTrackProfile(projectCircuit(coords, 1), 4, CIRCUIT_LENGTH_METERS);
const transform = read("../public/sessions/1308/alignment.json").transform;
const slug = process.argv[2] ?? "race";
const pit = read("../src/data/circuits/sepangPitLane.json");
let pitFrames = 0;
const session = read(`../public/sessions/1308/${slug}/session.json`);
const G = 9.81, LIMIT = 6 * G, H = 0.02;
const cause: Record<string, number> = { "sample gap > 600 ms": 0, "near pit / off-track edge": 0, other: 0 };
const longs: number[] = [], lats: number[] = [];
let frames = 0, longBad = 0, latBad = 0, worstLong = 0, worstLat = 0;
for (const dr of session.drivers.slice(0, Number(process.argv[3] ?? 22))) {
  const d = prepareDriver(read(`../public/sessions/1308/${slug}/drivers/${dr.driver_number}.json`) as DriverFile, transform, track, pit);
  const end = d.t[d.t.length - 1];
  for (let t = d.t[0] + 1000; t < end - 1000; t += H * 1000 * 5) {
    const p = [-1, 0, 1].map((k) => motionAt(d, track, t + k * H * 1000));
    if (p.some((m) => !m.onTrack || m.stale || !m.present)) continue;
    const v1 = [(p[1].x - p[0].x) / H, (p[1].y - p[0].y) / H], v2 = [(p[2].x - p[1].x) / H, (p[2].y - p[1].y) / H];
    const speed = Math.hypot(v1[0] + v2[0], v1[1] + v2[1]) / 2;
    if (speed < 15) continue;
    const a = [(v2[0] - v1[0]) / H, (v2[1] - v1[1]) / H];
    const ux = (v1[0] + v2[0]) / 2 / speed, uy = (v1[1] + v2[1]) / 2 / speed;
    const along = a[0] * ux + a[1] * uy, across = -a[0] * uy + a[1] * ux;
    frames++;
    if (p[1].pitLane) pitFrames++;
    longs.push(Math.abs(along));
    lats.push(Math.abs(across));
    if (Math.abs(along) > LIMIT || Math.abs(across) > LIMIT) {
      const i = d.t.findIndex((x) => x > t) - 1;
      const gap = Math.max(d.t[i + 1] - d.t[i], d.t[i] - d.t[i - 1], d.t[i + 2] - d.t[i + 1]);
      let edge = false;
      for (let k = Math.max(0, i - 8); k < Math.min(d.t.length, i + 9); k++) if (Math.abs(d.lateral[k]) > 12) edge = true;
      cause[gap > 600 ? "sample gap > 600 ms" : edge ? "near pit / off-track edge" : "other"]++;
    }
    if (Math.abs(along) > LIMIT) longBad++;
    if (Math.abs(across) > LIMIT) latBad++;
    worstLong = Math.max(worstLong, Math.abs(along));
    worstLat = Math.max(worstLat, Math.abs(across));
  }
}
const pct = (n: number) => ((100 * n) / frames).toFixed(2) + "%";
console.log(`${slug}: ${frames} moving frames; over 6 g longitudinal ${pct(longBad)} (worst ${(worstLong / G).toFixed(1)} g), lateral ${pct(latBad)} (worst ${(worstLat / G).toFixed(1)} g)`);
console.log("causes", cause);
const q = (a: number[], p: number) => (a.sort((x, y) => x - y)[Math.floor(p * a.length)] / G).toFixed(2);
console.log(`longitudinal g p50 ${q(longs, 0.5)} p95 ${q(longs, 0.95)} p99 ${q(longs, 0.99)} | lateral g p50 ${q(lats, 0.5)} p95 ${q(lats, 0.95)} p99 ${q(lats, 0.99)}`);
console.log("frames in the pit lane:", pitFrames);

// The g-forces the app shows (gForcesAt), over the same race.
{
  const { gForcesAt } = await import("../src/domain/recordedSession.ts");
  const longs: number[] = [], lats: number[] = [];
  for (const dr of session.drivers.slice(0, 6)) {
    const d = prepareDriver(read(`../public/sessions/1308/${slug}/drivers/${dr.driver_number}.json`) as DriverFile, transform, track, pit);
    for (let t = d.t[0] + 1000; t < d.t[d.t.length - 1] - 1000; t += 250) {
      const g = gForcesAt(d, track, t);
      if (g.long === 0 && g.lat === 0) continue;
      longs.push(g.long);
      lats.push(Math.abs(g.lat));
    }
  }
  const q = (a: number[], p: number) => a.slice().sort((x, y) => x - y)[Math.floor(p * a.length)].toFixed(2);
  console.log(`shown g (6 cars): braking p1 ${q(longs, 0.01)}, acceleration p99 ${q(longs, 0.99)}, cornering p50 ${q(lats, 0.5)} p99 ${q(lats, 0.99)}`);
}
