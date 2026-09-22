import { test } from "node:test";
import assert from "node:assert/strict";
import {
  advanceReplay,
  fieldAtTime,
  lapMarkers,
  telemetryAtTime,
  clampTime,
} from "../src/domain/replay.ts";
import {
  createField,
  advanceField,
  type CarDefinition,
} from "../src/domain/field.ts";
const cars: CarDefinition[] = [
  {
    id: "a",
    number: "07",
    color: "#fff",
    initialProgress: 0,
    lapSeconds: 24,
    compound: "MEDIUM",
    initialTyreAge: 0,
  },
  {
    id: "b",
    number: "88",
    color: "#fff",
    initialProgress: 0.2,
    lapSeconds: 25,
    compound: "SOFT",
    initialTyreAge: 2,
  },
];
test("absolute replay matches simulation and seeks backward without accumulating state", () => {
  assert.deepEqual(
    fieldAtTime(cars, 180),
    advanceField(createField(cars), cars, 36),
  );
  fieldAtTime(cars, 590);
  assert.deepEqual(fieldAtTime(cars, 0), createField(cars));
  assert.equal(fieldAtTime(cars, 120)[0].completedLaps, 1);
});
test("speed affects clock only; replay clamps to session bounds", () => {
  assert.equal(advanceReplay(10, 2, 0.5), 11);
  assert.equal(advanceReplay(10, 2, 10), 30);
  assert.equal(advanceReplay(599, 5, 5), 600);
  assert.equal(clampTime(-10), 0);
  assert.throws(() => advanceReplay(0, -1, 1), RangeError);
  assert.throws(() => clampTime(NaN), RangeError);
  let time = 0;
  for (let i = 0; i < 300; i++) time = advanceReplay(time, 1 / 30, 5);
  assert.ok(Math.abs(time - 50) < 1e-9);
});
test("lap jumps account for initial partial laps", () => {
  assert.equal(lapMarkers(cars[0])[1].time, 120);
  assert.equal(lapMarkers(cars[1])[1].time, 100);
  for (const car of cars)
    for (const marker of lapMarkers(car))
      assert.equal(
        fieldAtTime([car], marker.time)[0].completedLaps + 1,
        marker.lap,
      );
});
test("telemetry reconstructs a bounded past window with no future samples after seeking", () => {
  const samples = telemetryAtTime(cars[0], 180.2);
  assert.equal(samples.length, 121);
  assert.equal(samples.at(-1)!.time, 180.2);
  assert.equal(samples[0].time, 120.19999999999999);
  assert.equal(samples.at(-1)!.speed, fieldAtTime(cars, 180.2)[0].speedKph);
  assert.equal(telemetryAtTime(cars[0], 0).length, 1);
  assert.ok(telemetryAtTime(cars[0], 4).every((sample) => sample.time <= 4));
});
