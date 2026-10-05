import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { projectCircuit } from "../src/domain/circuitGeometry.ts";
import { buildTrackProfile } from "../src/domain/lapPhysics.ts";
import {
  alignToTrack,
  apply,
  fitSimilarity,
  icp,
  invert,
  nearestOnTrack,
  residuals,
  summarize,
  type Point,
  type Similarity,
} from "../src/domain/alignment.ts";

const read = (p: string) =>
  JSON.parse(readFileSync(new URL(p, import.meta.url), "utf8"));
const coords = read("../src/data/circuits/sepang.json").features[0].geometry
  .coordinates;
const track = buildTrackProfile(projectCircuit(coords, 1), 4, 5543);
const known: Similarity = {
  scale: 0.1003,
  rotation: 0.7,
  tx: -120,
  ty: 45,
  mirror: false,
};

test("apply and invert round trip, with and without a mirrored axis", () => {
  for (const mirror of [false, true]) {
    const t = { ...known, mirror };
    for (const p of [
      { x: 0, y: 0 },
      { x: 5000, y: -3000 },
      { x: -1234.5, y: 987.25 },
    ]) {
      const back = invert(t, apply(t, p));
      assert.ok(Math.hypot(back.x - p.x, back.y - p.y) < 1e-9);
    }
  }
});

test("closed-form fit recovers an exact similarity", () => {
  const src: Point[] = Array.from({ length: 40 }, (_, i) => ({
    x: Math.cos(i) * 3000 + i * 17,
    y: Math.sin(i * 1.3) * 2000,
  }));
  for (const mirror of [false, true]) {
    const t = { ...known, mirror };
    const got = fitSimilarity(
      src,
      src.map((p) => apply(t, p)),
      mirror,
    );
    assert.ok(
      Math.abs(got.scale - t.scale) < 1e-12 &&
        Math.abs(got.rotation - t.rotation) < 1e-12,
    );
    assert.ok(Math.abs(got.tx - t.tx) < 1e-8 && Math.abs(got.ty - t.ty) < 1e-8);
  }
  assert.throws(
    () => fitSimilarity(src.slice(0, 2), src.slice(0, 2)),
    RangeError,
  );
});

test("ICP recovers a disguised copy of the centre line from a wrong start", () => {
  // Express the centre line in a fake frame (decimetre-like units, rotated, shifted), with noise.
  let seed = 3;
  const noise = () =>
    ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5) * 20;
  const fake: Point[] = [];
  for (let i = 0; i < track.count; i += 5)
    fake.push(invert(known, { x: track.x[i], y: track.y[i] }));
  const noisy = fake.map((p) => ({ x: p.x + noise(), y: p.y + noise() }));
  const start = {
    ...known,
    rotation: known.rotation + 0.25,
    tx: known.tx + 60,
    ty: known.ty - 40,
  };
  const got = icp(track, noisy, start, 60);
  assert.ok(Math.abs(got.rotation - known.rotation) < 0.01, `${got.rotation}`);
  assert.ok(Math.abs(got.scale / known.scale - 1) < 0.01);
  assert.ok(summarize(residuals(track, got, noisy)).rms < 2);
});

test("nearest point is on the road and exact for centre-line samples", () => {
  const q = nearestOnTrack(track, { x: track.x[200], y: track.y[200] });
  assert.ok(q.distance < 1e-9);
  const off = nearestOnTrack(track, { x: track.x[200] + 30, y: track.y[200] });
  assert.ok(off.distance > 0 && off.distance <= 30 + 1e-9);
});

test("stored transform keeps a real OpenF1 lap within the residual target", () => {
  const stored = read("../public/sessions/1308/alignment.json");
  const lap: Point[] = read("./fixtures/openf1-lap.json").points.map(
    ([x, y]: number[]) => ({ x, y }),
  );
  const stats = summarize(residuals(track, stored.transform, lap));
  assert.ok(stats.rms < 8, `RMS ${stats.rms}`);
  assert.ok(stats.p95 < 10, `p95 ${stats.p95}`);
  assert.equal(stored.accuracyClass, "DERIVED");
  // OpenF1 positions are decimetres: about ten units per metre.
  assert.ok(stored.unitsPerMetre > 9.5 && stored.unitsPerMetre < 10.5);
});

test("global alignment is deterministic and lands near the stored fit", () => {
  const stored = read("../public/sessions/1308/alignment.json");
  const lap: Point[] = read("./fixtures/openf1-lap.json").points.map(
    ([x, y]: number[]) => ({ x, y }),
  );
  let length = 0;
  for (let i = 1; i < lap.length; i++)
    length += Math.hypot(lap[i].x - lap[i - 1].x, lap[i].y - lap[i - 1].y);
  const a = alignToTrack(track, lap, length),
    b = alignToTrack(track, lap, length);
  assert.deepEqual(a, b);
  assert.equal(a.mirror, stored.transform.mirror);
  assert.ok(Math.abs(a.rotation - stored.transform.rotation) < 0.01);
  assert.ok(Math.abs(a.scale / stored.transform.scale - 1) < 0.01);
});
