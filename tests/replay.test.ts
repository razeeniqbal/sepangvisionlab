import { test } from "node:test";
import assert from "node:assert/strict";
import { PLAYBACK_SPEEDS, advanceReplay, clampTime } from "../src/domain/replay.ts";
import { formatLap } from "../src/domain/inspection.ts";

test("replay clock stays within the session and only accepts known speeds", () => {
  assert.equal(clampTime(-5, 100), 0);
  assert.equal(clampTime(150, 100), 100);
  assert.equal(advanceReplay(10, 2, 5, 100), 20);
  assert.equal(advanceReplay(99, 2, 10, 100), 100);
  assert.throws(() => advanceReplay(0, 1, 3, 100), RangeError);
  assert.throws(() => clampTime(Number.NaN), RangeError);
  assert.deepEqual([...PLAYBACK_SPEEDS], [0.5, 1, 2, 5, 10]);
});

test("lap times format as m:ss.mmm with a dash for none", () => {
  assert.equal(formatLap(95.13), "1:35.130");
  assert.equal(formatLap(59.9999), "1:00.000");
  assert.equal(formatLap(null), "—");
});
