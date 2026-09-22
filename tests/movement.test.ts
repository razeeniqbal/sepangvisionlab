import { test } from "node:test";
import assert from "node:assert/strict";
import { advanceMotion } from "../src/domain/movement.ts";
test("half lap maps to normalized halfway", () =>
  assert.deepEqual(advanceMotion({ progress: 0, completedLaps: 0 }, 12), {
    progress: 0.5,
    completedLaps: 0,
  }));
test("exact lap wraps to zero", () =>
  assert.deepEqual(advanceMotion({ progress: 0, completedLaps: 0 }, 24), {
    progress: 0,
    completedLaps: 1,
  }));
test("handles multiple laps in one time step", () =>
  assert.deepEqual(advanceMotion({ progress: 0.5, completedLaps: 3 }, 60), {
    progress: 0,
    completedLaps: 6,
  }));
test("movement is frame-rate independent", () => {
  const run = (fps: number) => {
    let s = { progress: 0, completedLaps: 0 };
    for (let i = 0; i < fps * 53; i++) s = advanceMotion(s, 1 / fps);
    return s;
  };
  const a = run(30),
    b = run(144);
  assert.equal(a.completedLaps, b.completedLaps);
  assert.ok(Math.abs(a.progress - b.progress) < 1e-10);
});
test("rejects invalid time", () => {
  assert.throws(() => advanceMotion({ progress: 0, completedLaps: 0 }, -1));
  assert.throws(() => advanceMotion({ progress: 0, completedLaps: 0 }, 1, 0));
});
