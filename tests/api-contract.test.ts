import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  parseReplay,
  sampleRace,
  sampleTelemetry,
} from "../src/services/raceState.ts";
import { fieldAtTime } from "../src/domain/replay.ts";
const raw: unknown = JSON.parse(
  execFileSync(
    "python",
    [
      "-c",
      "from backend.provider import replay; print(replay().model_dump_json())",
    ],
    { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 },
  ),
);
const data = parseReplay(raw);
test("Python normalized replay matches frontend reference at fractional seeks and lap boundaries", () => {
  for (const time of [0, 0.5, 118.2636, 120, 239.999, 300.25, 600]) {
    const expected = fieldAtTime(data.entries, time),
      actual = sampleRace(data, time);
    actual.forEach((car, i) => {
      assert.equal(car.id, expected[i].id);
      assert.equal(car.position, expected[i].position);
      assert.equal(car.completedLaps, expected[i].completedLaps);
      assert.equal(car.tyreAge, expected[i].tyreAge);
      assert.ok(Math.abs(car.progress - expected[i].progress) < 1e-10);
      assert.ok(Math.abs(car.speedKph - expected[i].speedKph) < 1e-10);
    });
  }
});
test("contract rejects unsupported versions, missing frames, duplicate identities and invalid progress", () => {
  assert.throws(() => parseReplay({ ...data, schemaVersion: 2 }));
  assert.throws(() => parseReplay({ ...data, frames: data.frames.slice(1) }));
  const duplicate = structuredClone(data);
  duplicate.entries[1].id = duplicate.entries[0].id;
  assert.throws(() => parseReplay(duplicate));
  const invalid = structuredClone(data);
  invalid.frames[0].cars[0].progress = 1;
  assert.throws(() => parseReplay(invalid));
});
test("telemetry comes from provider channels and respects backward seeks", () => {
  const changed = structuredClone(data);
  changed.frames.forEach((frame) => {
    frame.cars[0].throttle = 72;
    frame.cars[0].brake = 3;
  });
  const samples = sampleTelemetry(changed, "car-07", 20.5);
  assert.equal(samples.at(-1)!.throttle, 72);
  assert.equal(samples.at(-1)!.brake, 3);
  assert.ok(samples.every((sample) => sample.time <= 20.5));
  assert.equal(sampleTelemetry(data, "car-07", 0).length, 1);
});
