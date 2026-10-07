import { test } from "node:test";
import assert from "node:assert/strict";
import { DRYING_MINUTES, rainingAt, wetnessAt } from "../src/domain/wetness.ts";

const min = 60_000;
const weather = [0, 10, 20, 30].map((m) => ({ t: m * min, air: 30, track: 40, rain: m < 20 ? 1 : 0, humidity: 80, wind: 1 }));

test("wet while raining, then drying over the set minutes", () => {
  assert.equal(wetnessAt(weather, 5 * min), 1);
  assert.equal(rainingAt(weather, 5 * min), true);
  assert.equal(rainingAt(weather, 25 * min), false);
  // Last rain reading at 10 min; 47.5 min later is halfway through drying.
  assert.ok(Math.abs(wetnessAt(weather, (10 + DRYING_MINUTES / 2) * min) - 0.5) < 1e-9);
  assert.equal(wetnessAt(weather, (10 + DRYING_MINUTES + 5) * min), 0);
  assert.equal(wetnessAt([], 5 * min), 0, "no readings, dry");
});
