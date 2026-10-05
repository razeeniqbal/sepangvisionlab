import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { projectCircuit } from "../src/domain/circuitGeometry.ts";
import { buildTrackProfile, findCorners } from "../src/domain/lapPhysics.ts";
import { leftNormals } from "../src/components/circuit/environment/ribbon.ts";
import {
  CAMERA_MODES,
  YAW_STEP,
  applyRigAction,
  cameraPose,
  createRig,
  nearestPoint,
  nextMode,
  setMode,
  smoothHeading,
  stepRig,
  tvFov,
  tvPoints,
} from "../src/components/circuit/cameraRig.ts";

const coords = JSON.parse(
  readFileSync(
    new URL("../src/data/circuits/sepang.json", import.meta.url),
    "utf8",
  ),
).features[0].geometry.coordinates;
const track = buildTrackProfile(projectCircuit(coords, 1), 4, 5543);
const tv = tvPoints(track, leftNormals(track));

test("cycling visits every mode and wraps", () => {
  let mode = CAMERA_MODES[0];
  const seen = [mode];
  for (let i = 1; i < CAMERA_MODES.length; i++)
    seen.push((mode = nextMode(mode)));
  assert.deepEqual(seen, [...CAMERA_MODES]);
  assert.equal(nextMode(mode), "engineering");
});

test("actions change targets only, per mode", () => {
  const rig = createRig("chase");
  assert.equal(applyRigAction(rig, "rotateLeft"), true);
  assert.equal(rig.targetYaw, YAW_STEP);
  assert.equal(rig.yaw, 0, "the frame loop eases, not the action");
  applyRigAction(rig, "zoomIn");
  assert.ok(rig.targetDist < rig.dist);
  for (let i = 0; i < 20; i++) applyRigAction(rig, "zoomIn");
  assert.equal(rig.targetDist, 7, "clamped");
  setMode(rig, "tv");
  assert.equal(applyRigAction(rig, "rotateRight"), false);
  applyRigAction(rig, "zoomIn");
  assert.ok(rig.targetZoom > 1, "TV zoom changes the lens");
  setMode(rig, "onboard");
  assert.equal(applyRigAction(rig, "zoomIn"), false);
  for (let i = 0; i < 10; i++) applyRigAction(rig, "rotateLeft");
  assert.equal(rig.targetYaw, 1.2);
  setMode(rig, "engineering");
  assert.equal(
    applyRigAction(rig, "zoomIn"),
    false,
    "engineering keeps its own controls",
  );
});

test("easing converges and is frame-rate independent", () => {
  const a = createRig("inspect"),
    b = createRig("inspect");
  for (const r of [a, b]) {
    applyRigAction(r, "rotateRight");
    applyRigAction(r, "zoomOut");
  }
  for (let i = 0; i < 60; i++) stepRig(a, 1 / 60);
  for (let i = 0; i < 144; i++) stepRig(b, 1 / 144);
  assert.ok(Math.abs(a.yaw - b.yaw) < 1e-9 && Math.abs(a.dist - b.dist) < 1e-9);
  for (let i = 0; i < 600; i++) stepRig(a, 1 / 60);
  assert.ok(
    Math.abs(a.yaw + YAW_STEP) < 1e-6 && Math.abs(a.dist - a.targetDist) < 1e-6,
  );
});

test("chase is locked to the car at any speed and snaps after a seek", () => {
  const rig = createRig("chase");
  for (const speed of [10, 90]) {
    const car = { x: speed * 3, y: 0, heading: 0 };
    const h = smoothHeading(rig, car.heading, 1 / 60);
    const pose = cameraPose(rig, car, h, tv);
    assert.ok(
      Math.abs(
        Math.hypot(pose.position.x - car.x, pose.position.y - car.y) - rig.dist,
      ) < 1e-9,
    );
  }
  assert.equal(
    smoothHeading(rig, 0.2, 1 / 60) < 0.2,
    true,
    "small turns are eased",
  );
  assert.equal(
    smoothHeading(rig, Math.PI, 1 / 60),
    Math.PI,
    "large jumps snap",
  );
});

test("TV points cover the lap and every apex; nearest point wins and lens tightens with range", () => {
  const corners = findCorners(track);
  assert.ok(tv.length >= Math.floor(track.length / 220) + corners.length - 2);
  for (const apex of corners) {
    const p = nearestPoint(tv, track.x[apex], track.y[apex]);
    assert.ok(Math.hypot(p.x - track.x[apex], p.y - track.y[apex]) < 40);
  }
  assert.ok(tvFov(200) < tvFov(40));
  assert.ok(tvFov(40, 2) < tvFov(40));
  const rig = createRig("tv");
  const pose = cameraPose(
    rig,
    { x: track.x[300], y: track.y[300], heading: 0 },
    0,
    tv,
  );
  assert.deepEqual(pose.position, nearestPoint(tv, track.x[300], track.y[300]));
});

test("orbit modes look at the car from their distance", () => {
  for (const mode of ["heli", "inspect"] as const) {
    const rig = createRig(mode),
      car = { x: 10, y: -5, heading: 1 };
    const pose = cameraPose(rig, car, 1, tv);
    assert.equal(pose.target.x, car.x);
    const range = Math.hypot(pose.position.x - car.x, pose.position.y - car.y);
    assert.ok(range > 0 && range <= rig.dist + 1e-9);
  }
});

test("TV camera skips blocked views, holds a clear shot and keeps clearance", async () => {
  const { clearTvPoints, pickTvCamera } = await import("../src/components/circuit/cameraRig.ts");
  const pts = [
    { x: 10, y: 0, z: 7 },
    { x: 20, y: 0, z: 7 },
    { x: 40, y: 0, z: 7 },
  ];
  const car = { x: 0, y: 0 };
  assert.equal(pickTvCamera(pts, car, () => false), pts[0]);
  assert.equal(pickTvCamera(pts, car, (p) => p === pts[0]), pts[1], "blocked nearest is skipped");
  assert.equal(pickTvCamera(pts, car, () => true), null);
  // Hysteresis: the current clear camera is kept when it is not much farther.
  assert.equal(pickTvCamera(pts, { x: 14.5, y: 0 }, () => false, pts[1]), pts[1]);
  assert.equal(pickTvCamera(pts, { x: 2, y: 0 }, () => false, pts[2]), pts[0], "far current camera is dropped");
  // (17, 3) is 4.2 m from the 20 m camera and 7.6 m from the 10 m camera.
  assert.deepEqual(clearTvPoints(pts, [{ x: 17, y: 3 }]), [pts[0], pts[2]]);
  assert.equal(clearTvPoints(pts, [{ x: 20, y: 5.9 }]).includes(pts[1]), false);
});
