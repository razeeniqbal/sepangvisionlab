import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { projectCircuit } from "../src/domain/circuitGeometry.ts";
import {
  CIRCUIT_LENGTH_METERS,
  SIMULATION_RATE,
  type CarDefinition,
  type TyreCompound,
} from "../src/domain/field.ts";
import { buildTrackProfile } from "../src/domain/lapPhysics.ts";
import {
  createPaceModel,
  physicsFieldAtTime,
  physicsTelemetryAtTime,
  withPhysicsSetups,
  ghostCarAtTime,
  ghostGap,
} from "../src/domain/physicsField.ts";
import { fieldAtTime, lapMarkers } from "../src/domain/replay.ts";
import { lastFullLapSeconds } from "../src/domain/inspection.ts";

const data = JSON.parse(
  readFileSync(
    new URL("../src/data/circuits/sepang.json", import.meta.url),
    "utf8",
  ),
);
const model = createPaceModel(
  buildTrackProfile(
    projectCircuit(data.features[0].geometry.coordinates, 1),
    4,
    CIRCUIT_LENGTH_METERS,
  ),
);
const compounds: TyreCompound[] = ["MEDIUM", "SOFT", "HARD"];
const entries: CarDefinition[] = Array.from({ length: 20 }, (_, i) => ({
  id: "car-" + i,
  number: String(i).padStart(2, "0"),
  color: "#00a19c",
  initialProgress: i / 20,
  lapSeconds: 24,
  compound: compounds[i % 3],
  initialTyreAge: i % 5,
}));
const cars = withPhysicsSetups(entries, model);

test("setups derive lapSeconds from physics and keep the entry compound", () => {
  const laps = cars.map((c) => c.lapSeconds * SIMULATION_RATE);
  assert.ok(
    laps.every((l) => l > 85 && l < 100),
    laps.join(),
  );
  assert.ok(Math.max(...laps) - Math.min(...laps) > 0.5, "field should spread");
  cars.forEach((c, i) => assert.equal(c.setup!.compound, entries[i].compound));
  assert.deepEqual(withPhysicsSetups(cars, model), cars);
});

test("field is deterministic for any seek order", () => {
  const forward = [0, 37.25, 211.5, 600].map((t) =>
    physicsFieldAtTime(cars, model, t),
  );
  const backward = [600, 211.5, 37.25, 0]
    .map((t) => physicsFieldAtTime(cars, model, t))
    .reverse();
  assert.deepEqual(forward, backward);
});

test("pace varies through the lap with real pedal inputs", () => {
  const speeds = [],
    brakes = [];
  for (let t = 0; t < 95; t += 0.5) {
    const car = physicsFieldAtTime([cars[0]], model, t)[0];
    speeds.push(car.speedKph);
    brakes.push(car.brake);
    assert.ok(car.throttle >= 0 && car.throttle <= 100);
    assert.ok(car.brake >= 0 && car.brake <= 100);
  }
  assert.ok(Math.max(...speeds) > 290 && Math.min(...speeds) < 120);
  assert.ok(Math.max(...brakes) > 50);
});

test("lap boundaries agree with lapMarkers and inspector maths", () => {
  for (const car of cars.slice(0, 4)) {
    for (const marker of lapMarkers(car).slice(1)) {
      const before = physicsFieldAtTime([car], model, marker.time - 0.05)[0];
      const after = physicsFieldAtTime(
        [car],
        model,
        Math.min(600, marker.time + 0.05),
      )[0];
      assert.equal(before.completedLaps, marker.lap - 2);
      assert.equal(after.completedLaps, marker.lap - 1);
      assert.equal(after.tyreAge, car.initialTyreAge + marker.lap - 1);
    }
  }
  const done = physicsFieldAtTime([cars[0]], model, 200)[0];
  const full = lastFullLapSeconds(done, cars[0]);
  assert.ok(
    full !== null &&
      Math.abs(full - model.profile(cars[0].setup!).lapSeconds) < 1e-9,
  );
});

test("telemetry is a bounded past window with modeled channels", () => {
  const samples = physicsTelemetryAtTime(cars[1], model, 180.2);
  assert.equal(samples.at(-1)!.time, 180.2);
  assert.ok(samples[0].time >= 120.2 - 1e-9);
  assert.ok(new Set(samples.map((s) => Math.round(s.speed))).size > 10);
  assert.equal(physicsTelemetryAtTime(cars[1], model, 0).length, 1);
});

test("entries without a setup keep the constant-pace backend contract", () => {
  assert.throws(() => physicsFieldAtTime(entries, model, 10), RangeError);
  assert.equal(fieldAtTime(entries, 120)[0].completedLaps, 1);
});

test("ghost with the same setup runs level; a faster ghost pulls away", () => {
  const car = cars[3];
  for (const t of [0, 45.5, 300]) {
    assert.ok(Math.abs(ghostGap(car, car.setup!, model, t)) < 1e-6);
    const g = ghostCarAtTime(car, car.setup!, model, t),
      live = physicsFieldAtTime([car], model, t)[0];
    assert.ok(
      Math.abs(
        g.completedLaps + g.progress - live.completedLaps - live.progress,
      ) < 1e-6,
    );
  }
  const faster = { ...car.setup!, powerKw: car.setup!.powerKw + 120 };
  const gaps = [60, 200, 400].map((t) => ghostGap(car, faster, model, t));
  assert.ok(gaps[0] > 0 && gaps[1] > gaps[0] && gaps[2] > gaps[1], gaps.join());
  // About the lap-time difference per lap completed.
  const perLap =
    model.profile(car.setup!).lapSeconds - model.profile(faster).lapSeconds;
  const laps = 400 / model.profile(car.setup!).lapSeconds;
  assert.ok(
    Math.abs(gaps[2] - perLap * laps) < perLap * 0.6,
    `${gaps[2]} vs ${perLap * laps}`,
  );
});
