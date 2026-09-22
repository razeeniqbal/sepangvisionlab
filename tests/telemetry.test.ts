import { test } from "node:test";
import assert from "node:assert/strict";
import { recordTelemetry, MAX_SAMPLES } from "../src/domain/telemetry.ts";
import type { CarState } from "../src/domain/field.ts";
const car: CarState = {
  id: "a",
  number: "07",
  position: 1,
  speedKph: 166.3,
  compound: "SOFT",
  tyreAge: 0,
  progress: 0,
  completedLaps: 0,
};
test("telemetry preserves independent car speed and immutable history", () => {
  const first = recordTelemetry(
    {},
    [car, { ...car, id: "b", speedKph: 170 }],
    0,
  );
  const next = recordTelemetry(
    first,
    [car, { ...car, id: "b", speedKph: 175 }],
    0.5,
  );
  assert.equal(first.a.length, 1);
  assert.equal(next.a[1].speed, car.speedKph);
  assert.equal(next.b[1].speed, 175);
  assert.equal(next.a[1].throttle, 50);
  assert.equal(next.a[1].brake, 0);
});
test("paused timestamps do not accumulate and reset discards old session", () => {
  const first = recordTelemetry({}, [car], 5);
  assert.deepEqual(recordTelemetry(first, [car], 5), first);
  const reset = recordTelemetry(first, [car], 0);
  assert.deepEqual(
    reset.a.map((s) => s.time),
    [0],
  );
});
test("history has bounded samples and a sixty-second window", () => {
  let history = recordTelemetry({}, [car], 0);
  for (let time = 0.1; time < 200; time += 0.1)
    history = recordTelemetry(history, [car], time);
  assert.equal(history.a.length, MAX_SAMPLES);
  history = recordTelemetry(history, [car], 300);
  assert.equal(history.a.length, 1);
  assert.throws(() => recordTelemetry({}, [car], NaN), RangeError);
});
