import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { projectCircuit } from "../src/domain/circuitGeometry.ts";
import { buildTrackProfile, findCorners } from "../src/domain/lapPhysics.ts";
import {
  MAX_PITCH,
  MAX_ROLL,
  MAX_STEER,
  attitudeTarget,
  curvatureAt,
  ease,
  spinDelta,
  steerAngle,
} from "../src/domain/carMotion.ts";
import {
  FRONT_AXLE_X,
  REAR_AXLE_X,
  WHEEL_HUBS,
  WHEEL_RADIUS,
} from "../src/components/cars/wheels/wheelLayout.ts";

const coords = JSON.parse(
  readFileSync(
    new URL("../src/data/circuits/sepang.json", import.meta.url),
    "utf8",
  ),
).features[0].geometry.coordinates;
const track = buildTrackProfile(projectCircuit(coords, 1), 4, 5543);
const scale = 5.6 / 1.05;
const wheelbase = (FRONT_AXLE_X - REAR_AXLE_X) * scale;

test("derived wheel layout matches a modern formula car", () => {
  assert.ok(wheelbase > 3.3 && wheelbase < 3.8, `${wheelbase}`);
  assert.ok(WHEEL_RADIUS * scale > 0.33 && WHEEL_RADIUS * scale < 0.4);
  assert.deepEqual(
    WHEEL_HUBS.map((h) => h.id),
    ["wheel_FL", "wheel_FR", "wheel_RL", "wheel_RR"],
  );
});

test("steer follows the bend direction and stays within the lock", () => {
  for (const apex of findCorners(track)) {
    const delta = steerAngle(track, track.distance[apex] - 3, wheelbase);
    assert.equal(Math.sign(delta), Math.sign(track.curvature[apex]));
    assert.ok(Math.abs(delta) <= MAX_STEER);
  }
  // On a straight the wheels are near centre.
  let straightest = 0;
  for (let i = 0; i < track.count; i++)
    if (Math.abs(track.curvature[i]) < Math.abs(track.curvature[straightest]))
      straightest = i;
  assert.ok(
    Math.abs(steerAngle(track, track.distance[straightest], wheelbase)) < 0.01,
  );
  assert.ok(
    Math.abs(steerAngle(track, track.length - 2, wheelbase)) <= MAX_STEER,
    "wraps past the line",
  );
});

test("attitude: nose dips under braking and the body rolls to the outside", () => {
  const braking = attitudeTarget(-40, 80, 0),
    accelerating = attitudeTarget(10, 30, 0);
  assert.ok(braking.pitch > 0 && accelerating.pitch < 0);
  assert.equal(braking.pitch, MAX_PITCH);
  const left = attitudeTarget(0, 50, 1 / 100),
    right = attitudeTarget(0, 50, -1 / 100);
  assert.ok(left.roll > 0 && right.roll < 0);
  assert.ok(Math.abs(attitudeTarget(0, 90, 1 / 20).roll) <= MAX_ROLL);
  assert.equal(attitudeTarget(0, 0, 1 / 20).roll, 0);
  assert.ok(
    Math.abs(curvatureAt(track, track.length + 100) - curvatureAt(track, 100)) <
      1e-12,
  );
});

test("easing is frame-rate independent", () => {
  let a = 0,
    b = 0;
  for (let i = 0; i < 30; i++) a = ease(a, 1, 1 / 30);
  for (let i = 0; i < 144; i++) b = ease(b, 1, 1 / 144);
  assert.ok(Math.abs(a - b) < 1e-9);
  assert.equal(ease(0.3, 1, 0), 0.3);
});

test("wheel spin follows distance, wraps the line and ignores seeks", () => {
  assert.ok(Math.abs(spinDelta(100, 110, 0.37, 5543) - 10 / 0.37) < 1e-12);
  assert.ok(Math.abs(spinDelta(5540, 3, 0.37, 5543) - 6 / 0.37) < 1e-9);
  assert.ok(spinDelta(110, 100, 0.37, 5543) < 0, "rewind spins backwards");
  assert.equal(spinDelta(100, 900, 0.37, 5543), 0);
});

test("suspension spring settles on the target with a small overshoot, at any frame rate", async () => {
  const { spring, rideDrop, roadShake } = await import("../src/domain/carMotion.ts");
  const run = (fps: number) => {
    let x = 0, v = 0, peak = 0;
    for (let i = 0; i < fps * 2; i++) {
      [x, v] = spring(x, v, 1, 1 / fps);
      peak = Math.max(peak, x);
    }
    return { x, peak };
  };
  const a = run(30), b = run(144);
  assert.ok(Math.abs(a.x - 1) < 0.01 && Math.abs(b.x - 1) < 0.01, "settles");
  assert.ok(a.peak > 1.005 && a.peak < 1.25, `overshoot ${a.peak}`);
  assert.ok(Math.abs(a.peak - b.peak) < 0.03, "frame-rate independent");
  assert.deepEqual(spring(0.3, 0, 1, 0), [0.3, 0], "paused replay holds still");
  assert.equal(rideDrop(0), 0);
  assert.ok(rideDrop(83) > 0.015 && rideDrop(120) === 0.025);
  assert.equal(Math.abs(roadShake(5, 0, 1).pitch), 0, "no shake when stopped");
  assert.ok(Math.abs(roadShake(5, 90, 1).pitch) <= 0.0012);
});

test("brakes heat under heavy braking, glow, and cool down again", async () => {
  const { brakeTemperature, brakeGlow, BRAKE_AMBIENT } = await import("../src/domain/carMotion.ts");
  let t = BRAKE_AMBIENT;
  // 1.6 s at -4 g from 83 m/s down to ~20 m/s.
  for (let i = 0; i < 16; i++) t = brakeTemperature(t, -4, 83 - i * 4, 0.1);
  assert.ok(t > 600 && t < 1000, `hot ${t}`);
  assert.ok(brakeGlow(t) > 0);
  for (let i = 0; i < 100; i++) t = brakeTemperature(t, 1, 70, 0.1);
  assert.ok(t < 300, `cooled ${t}`);
  assert.equal(brakeGlow(t), 0);
  assert.equal(brakeTemperature(500, -4, 80, 0), 500, "paused replay holds");
});
