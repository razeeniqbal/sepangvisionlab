import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { projectCircuit } from "../src/domain/circuitGeometry.ts";
import {
  buildTrackProfile, solveSpeedProfile, sampleAtTime, sampleAtDistance, findCorners, DEFAULT_SETUP,
} from "../src/domain/lapPhysics.ts";

const data = JSON.parse(readFileSync(new URL("../src/data/circuits/sepang.json", import.meta.url), "utf8"));
const outline = projectCircuit(data.features[0].geometry.coordinates, 1);
const track = buildTrackProfile(outline, 4, 5543);
const base = solveSpeedProfile(track, DEFAULT_SETUP);

test("track profile is closed and scaled to the official length", () => {
  assert.ok(Math.abs(track.length - 5543) < 30, `length ${track.length}`);
  assert.equal(track.distance.length, track.count + 1);
});

test("baseline lap is in a realistic range", () => {
  assert.ok(base.lapSeconds > 85 && base.lapSeconds < 100, `lap ${base.lapSeconds}`);
  assert.ok(base.topSpeed * 3.6 > 290 && base.topSpeed * 3.6 < 360);
  assert.ok(base.minSpeed * 3.6 > 50 && base.minSpeed * 3.6 < 110);
});

test("setup changes move lap time in the expected direction", () => {
  const lap = (s: Partial<typeof DEFAULT_SETUP>) => solveSpeedProfile(track, { ...DEFAULT_SETUP, ...s }).lapSeconds;
  assert.ok(lap({ powerKw: 850 }) < base.lapSeconds);
  assert.ok(lap({ fuelKg: 110 }) > base.lapSeconds);
  assert.ok(lap({ compound: "HARD" }) > base.lapSeconds);
  assert.ok(lap({ wet: true }) > base.lapSeconds + 10);
  assert.ok(lap({ wingLevel: 1 }) > lap({ wingLevel: 6 }), "low wing should lose time overall");
});

test("constant radius circle hits the analytic grip limit", () => {
  const R = 100, pts = Array.from({ length: 400 }, (_, i) => ({ x: R * Math.cos((i / 400) * 2 * Math.PI), y: R * Math.sin((i / 400) * 2 * Math.PI) }));
  const circle = buildTrackProfile(pts, 2);
  const p = solveSpeedProfile(circle, { ...DEFAULT_SETUP, wingLevel: 1 });
  const mu = 1.82, m = 838, c = (mu * 0.5 * 1.16 * (2.4 + 2.9 * (1 - Math.exp(-1 / 3.2)))) / m;
  const expected = Math.sqrt((mu * 9.81) / (1 / R - c));
  assert.ok(Math.abs(p.speed[10] - expected) / expected < 0.03, `${p.speed[10]} vs ${expected}`);
});

test("sampleAtTime is deterministic and wraps laps", () => {
  const a = sampleAtTime(track, base, 123.4), b = sampleAtTime(track, base, 123.4);
  assert.deepEqual(a, b);
  const c = sampleAtTime(track, base, base.lapSeconds * 2 + 1);
  assert.equal(c.completedLaps, 2);
  let prev = -1;
  for (let t = 0; t < base.lapSeconds; t += 0.5) {
    const s = sampleAtTime(track, base, t);
    assert.ok(s.distance >= prev); prev = s.distance;
  }
  assert.throws(() => sampleAtTime(track, base, -1), RangeError);
});

test("distance and time lookups agree", () => {
  const d = sampleAtTime(track, base, 40).distance;
  const s = sampleAtDistance(track, base, d);
  assert.ok(Math.abs(s.x - sampleAtTime(track, base, 40).x) < 1e-6);
});

test("finds roughly fifteen corners at Sepang", () => {
  const corners = findCorners(track, 200, 12);
  assert.ok(corners.length >= 12 && corners.length <= 26, `${corners.length}`);
});
