import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PIT_LANE_HALF_WIDTH, pitOffsetAt, pitPathFromRuns, projectOnPath, resample, type PitLane } from "../src/domain/pitLane.ts";
import { ON_TRACK_METRES } from "../src/domain/recordedSession.ts";

const lane = JSON.parse(
  readFileSync(new URL("../src/data/circuits/sepangPitLane.json", import.meta.url), "utf8"),
) as PitLane & { accuracyClass: string; passes: number };

test("resampling keeps the ends and spaces points evenly", () => {
  const r = resample({ x: [0, 10, 10], y: [0, 0, 10] }, 4);
  assert.deepEqual([r.x[0], r.y[0]], [0, 0]);
  assert.deepEqual([r.x.at(-1), r.y.at(-1)], [10, 10]);
  for (let i = 1; i < r.x.length - 1; i++) assert.ok(Math.abs(Math.hypot(r.x[i] - r.x[i - 1], r.y[i] - r.y[i - 1]) - 4) < 1.2);
});

test("the centre line of noisy passes follows the road, including a sideways loop", () => {
  // A road that runs out 60 m and back, like the Sepang entry road; passes scattered ±1.5 m.
  const road = (u: number) => ({ x: u, y: 60 * Math.sin((Math.PI * u) / 300) });
  let seed = 7;
  const noise = () => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5) * 3;
  const runs = Array.from({ length: 12 }, () => {
    const x: number[] = [], y: number[] = [];
    for (let u = 0; u <= 300; u += 5) {
      const p = road(u);
      x.push(p.x + noise());
      y.push(p.y + noise());
    }
    return { x, y };
  });
  const path = pitPathFromRuns(runs)!;
  for (let u = 20; u <= 280; u += 20) {
    const p = road(u);
    assert.ok(projectOnPath(path, p.x, p.y).distance < 1, `on the road at u=${u}`);
  }
  assert.equal(pitPathFromRuns([]), null, "no lane without pit data");
});

test("offsets along the track are read per sample, wrapping past the line", () => {
  const n = 40;
  const l: PitLane = { from: 36, to: 44, side: -1, offsets: Array(9).fill(-12), path: { x: [], y: [] } };
  assert.equal(pitOffsetAt(l, 2, n), -12);
  assert.equal(pitOffsetAt(l, 20, n), null);
});

test("the DERIVED Sepang pit lane leaves at the final hairpin and runs beside the main straight", () => {
  assert.equal(lane.accuracyClass, "DERIVED");
  assert.ok(lane.passes > 60, "built from the race pit stops");
  assert.equal(lane.offsets.length, lane.to - lane.from + 1);
  assert.ok(lane.offsets.every((o) => Math.sign(o) === lane.side), "one side only");
  // The entry road loops well away from the track before the straight.
  assert.ok(Math.max(...lane.offsets.map(Math.abs)) > 40, "entry road included");
  const beside = lane.offsets.filter((o) => Math.abs(o) > ON_TRACK_METRES + 1 && Math.abs(o) < 16).length;
  assert.ok(beside * 4 > 300, "a long stretch beside the straight");
  // About 870 m of road from leaving the track to rejoining it, every ~4 m.
  const length = lane.path.x.slice(1).reduce((s, x, i) => s + Math.hypot(x - lane.path.x[i], lane.path.y[i + 1] - lane.path.y[i]), 0);
  assert.ok(length > 700 && length < 1000, `length ${length.toFixed(0)} m`);
  assert.ok(PIT_LANE_HALF_WIDTH * 2 < 8);
});
