import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { elevationFromBins, gradeAt, heightAt } from "../src/domain/elevation.ts";

const derived = JSON.parse(
  readFileSync(new URL("../src/data/circuits/sepangElevation.json", import.meta.url), "utf8"),
);

test("elevation profile: median per sample, gaps filled, smoothed and based at zero", () => {
  const n = 40;
  const bins = Array.from({ length: n }, (_, i) => (i === 7 ? [] : [10 + Math.sin((i / n) * 2 * Math.PI) * 5, 99, -99, 10 + Math.sin((i / n) * 2 * Math.PI) * 5].slice(0, 3)));
  const p = elevationFromBins(bins, 4);
  assert.equal(p.heights.length, n);
  assert.equal(p.filled, 1);
  assert.equal(Math.min(...p.heights), 0);
  assert.ok(p.range > 6 && p.range < 11, `${p.range}`);
});

test("height and grade along the lap interpolate and wrap", () => {
  const h = [0, 10, 20, 10];
  assert.equal(heightAt(h, 400, 50), 5);
  assert.equal(heightAt(h, 400, 450), 5, "wraps past the line");
  assert.ok(Math.abs(gradeAt(h, 400, 50) - 0.1) < 1e-9);
});

test("the DERIVED Sepang profile is plausible", () => {
  assert.equal(derived.accuracyClass, "DERIVED");
  assert.ok(derived.range > 5 && derived.range < 40, `${derived.range} m`);
  const n = derived.heights.length;
  let steepest = 0;
  for (let i = 0; i < n; i++) steepest = Math.max(steepest, Math.abs(derived.heights[(i + 2) % n] - derived.heights[(i - 2 + n) % n]) / 16);
  assert.ok(steepest < 0.12, `steepest ${(steepest * 100).toFixed(1)}%`);
});
