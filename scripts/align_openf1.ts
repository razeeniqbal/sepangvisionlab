// Fit the OpenF1 circuit frame onto the metric Sepang profile (Step 3).
//   node --experimental-strip-types scripts/align_openf1.ts
// Writes public/sessions/1308/alignment.json and tests/fixtures/openf1-lap.json.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { projectCircuit } from "../src/domain/circuitGeometry.ts";
import { buildTrackProfile } from "../src/domain/lapPhysics.ts";
import {
  alignToTrack,
  icp,
  residuals,
  summarize,
  type Point,
} from "../src/domain/alignment.ts";

const MEETING = 1308;
const SESSIONS = ["qualifying", "race"];
const PER_SESSION = 4; // one lap per driver, fastest drivers first
const coords = JSON.parse(readFileSync("src/data/circuits/sepang.json", "utf8"))
  .features[0].geometry.coordinates;
const track = buildTrackProfile(projectCircuit(coords, 1), 4, 5543);

const undelta = (a: number[]) => {
  let s = 0;
  return a.map((v) => (s += v));
};
const json = (p: string) => JSON.parse(readFileSync(p, "utf8"));

interface Lap {
  session: string;
  driver: number;
  acronym: string;
  lap: number;
  seconds: number;
  points: Point[];
  length: number;
}
const laps: Lap[] = [];
for (const slug of SESSIONS) {
  const session = json(`public/sessions/${MEETING}/${slug}/session.json`);
  const timed = session.laps.filter(
    (l: { dur: number | null; t: number | null; pitOut: boolean }) =>
      l.dur && l.t !== null && !l.pitOut,
  );
  const best = Math.min(...timed.map((l: { dur: number }) => l.dur));
  const used = new Set<number>();
  for (const l of [...timed].sort((a, b) => a.dur - b.dur)) {
    if (l.dur > best * 1.03 || used.has(l.d) || used.size >= PER_SESSION)
      continue;
    const loc = json(
      `public/sessions/${MEETING}/${slug}/drivers/${l.d}.json`,
    ).location;
    const t = undelta(loc.t),
      x = undelta(loc.x),
      y = undelta(loc.y);
    const idx = t
      .map((v, i) => i)
      .filter((i) => t[i] >= l.t && t[i] <= l.t + l.dur * 1000);
    // Clean lap: no sampling gap longer than 1 s.
    if (
      idx.length < 200 ||
      idx.some((i, k) => k > 0 && t[i] - t[idx[k - 1]] > 1000)
    )
      continue;
    const points = idx.map((i) => ({ x: x[i], y: y[i] }));
    let length = 0;
    for (let k = 1; k < points.length; k++)
      length += Math.hypot(
        points[k].x - points[k - 1].x,
        points[k].y - points[k - 1].y,
      );
    const acronym =
      session.drivers.find(
        (d: { driver_number: number }) => d.driver_number === l.d,
      )?.name_acronym ?? String(l.d);
    laps.push({
      session: slug,
      driver: l.d,
      acronym,
      lap: l.n,
      seconds: l.dur,
      points,
      length,
    });
    used.add(l.d);
  }
}
if (laps.length < 4) throw new Error(`Only ${laps.length} clean laps found`);
const all = laps.flatMap((l) => l.points);
const pathLength = laps.reduce((s, l) => s + l.length, 0) / laps.length;
const t0 = Date.now();
// Global search on every third point, then refine on all points.
const coarse = alignToTrack(
  track,
  all.filter((_, i) => i % 3 === 0),
  pathLength,
);
const transform = icp(track, all, coarse, 60);
const overall = summarize(residuals(track, transform, all));
const perLap = laps.map((l) => ({
  session: l.session,
  driver: l.driver,
  acronym: l.acronym,
  lap: l.lap,
  seconds: l.seconds,
  samples: l.points.length,
  ...summarize(residuals(track, transform, l.points)),
}));
const round = (v: number, d = 3) => Number(v.toFixed(d));
const report = {
  schemaVersion: 1,
  accuracyClass: "DERIVED",
  description:
    "Similarity transform from the OpenF1 circuit frame to the metric Sepang profile (x east, y north, metres), fitted by ICP to the centre line.",
  transform: {
    ...transform,
    rotation: round(transform.rotation, 6),
    scale: round(transform.scale, 8),
    tx: round(transform.tx),
    ty: round(transform.ty),
  },
  unitsPerMetre: round(1 / transform.scale, 4),
  rotationDegrees: round((transform.rotation * 180) / Math.PI, 3),
  residualMetres: {
    rms: round(overall.rms),
    p95: round(overall.p95),
    max: round(overall.max),
    samples: overall.count,
  },
  target: { rmsBelowMetres: 8 },
  laps: perLap.map((l) => ({
    ...l,
    rms: round(l.rms),
    p95: round(l.p95),
    max: round(l.max),
    count: undefined,
  })),
  note: "Residuals are distances from car positions to the track centre line, so they include the racing line's real lateral offset (up to about 8 m on a 16 m road), not only fit error.",
  attribution:
    "Positions: data via OpenF1 (unofficial). Not associated with Formula 1. Centre line: Bacinger f1-circuits (MIT), rescaled to 5.543 km.",
};
writeFileSync(
  `public/sessions/${MEETING}/alignment.json`,
  JSON.stringify(report, null, 2) + "\n",
);
// Small fixture for tests: the first lap, every second sample.
mkdirSync("tests/fixtures", { recursive: true });
const f = laps[0];
writeFileSync(
  "tests/fixtures/openf1-lap.json",
  JSON.stringify({
    source:
      "OpenF1 (unofficial), meeting 1308, " +
      f.session +
      ", driver " +
      f.driver +
      ", lap " +
      f.lap +
      "; every second location sample",
    points: f.points.filter((_, i) => i % 2 === 0).map((p) => [p.x, p.y]),
  }) + "\n",
);
console.log(
  `laps: ${laps.map((l) => `${l.session} ${l.acronym} L${l.lap} ${l.seconds}s`).join(" | ")}`,
);
console.log(
  `fit in ${Date.now() - t0} ms; scale ${transform.scale.toFixed(6)} m/unit (${(1 / transform.scale).toFixed(3)} units/m), rotation ${report.rotationDegrees}°, mirror ${transform.mirror}`,
);
console.log(
  `residual RMS ${overall.rms.toFixed(2)} m, p95 ${overall.p95.toFixed(2)} m, max ${overall.max.toFixed(2)} m over ${overall.count} samples`,
);
for (const l of perLap)
  console.log(
    `  ${l.session.padEnd(10)} ${l.acronym} L${l.lap}: RMS ${l.rms.toFixed(2)} m, p95 ${l.p95.toFixed(2)} m`,
  );
