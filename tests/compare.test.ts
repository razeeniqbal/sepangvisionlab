import { test } from "node:test";
import assert from "node:assert/strict";
import { currentLap, deltaAt, ghostTime, lapWindow } from "../src/domain/compare.ts";

const laps = [
  { d: 1, n: 1, t: 0, dur: 100, pitOut: false },
  { d: 1, n: 2, t: 100_000, dur: 95, pitOut: false },
  { d: 2, n: 1, t: 2_000, dur: 101, pitOut: false },
  { d: 2, n: 2, t: 103_000, dur: 94, pitOut: false },
  { d: 3, n: 1, t: null, dur: null, pitOut: false },
];

test("current lap and lap windows come from recorded laps", () => {
  assert.deepEqual(currentLap(laps, 1, 150_000), { n: 2, t: 100_000, dur: 95 });
  assert.equal(currentLap(laps, 1, 999_000), null);
  assert.deepEqual(lapWindow(laps, 2, 2), { n: 2, t: 103_000, dur: 94 });
  assert.equal(lapWindow(laps, 3, 1), null, "untimed lap");
});

test("the ghost is the rival at the same moment of the same lap", () => {
  // Driver 1 is 30 s into lap 2; driver 2 started lap 2 at 103 s.
  assert.equal(ghostTime(laps, 1, 2, 130_000), 133_000);
  // 99 s into a 95 s lap is impossible for driver 1; 94.5 s in: the rival lap (94 s) has ended, hold at its end.
  assert.equal(ghostTime(laps, 1, 2, 194_500), 197_000);
  assert.equal(ghostTime(laps, 1, 3, 50_000), null, "rival lap missing");
});

test("time delta at matching distances", () => {
  const mine = [0, 1, 2, 3].map((k) => ({ s: k * 20, v: 0 })); // 20 m per 200 ms
  const theirs = [0, 1, 2, 3].map((k) => ({ s: k * 10, v: 0 })); // half as fast
  assert.ok(Math.abs(deltaAt(mine, theirs, 30)! - 0.3) < 1e-9, "rival 0.3 s behind at 30 m");
  assert.equal(deltaAt(mine, theirs, 500), null, "beyond the trace");
});
