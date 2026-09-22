import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ResourceScope,
  cameraError,
  validHand,
  previewPoint,
  handAngle,
  type HandPoint,
} from "../src/domain/hands.ts";
test("resource scope stops everything once, including a late camera stream", () => {
  const scope = new ResourceScope(),
    calls: string[] = [];
  scope.own(() => calls.push("worker"));
  scope.own(() => calls.push("camera"));
  scope.close();
  scope.close();
  scope.own(() => calls.push("late camera"));
  assert.deepEqual(calls, ["camera", "worker", "late camera"]);
  assert.equal(scope.active, false);
});
test("cleanup failure cannot retain the remaining camera resources", () => {
  const scope = new ResourceScope();
  let released = false;
  scope.own(() => {
    released = true;
  });
  scope.own(() => {
    throw Error();
  });
  scope.close();
  assert.equal(released, true);
});
test("mirrored coordinates and aspect-correct orientation match preview", () => {
  assert.deepEqual(previewPoint({ x: 0.25, y: 0.5, z: 0 }, 640, 480), {
    x: 480,
    y: 240,
  });
  const p: HandPoint[] = Array.from({ length: 21 }, () => ({
    x: 0.5,
    y: 0.5,
    z: 0,
  }));
  p[9] = { x: 0.5, y: 0.25, z: 0 };
  assert.equal(handAngle(p, 640, 480), 0);
  p[9] = { x: 0.25, y: 0.5, z: 0 };
  assert.equal(handAngle(p, 640, 480), 90);
  p[9] = { ...p[0] };
  assert.equal(handAngle(p, 640, 480), null);
});
test("incomplete and nonfinite detections cannot become visible landmarks", () => {
  const hand = {
    label: "Left",
    score: 0.9,
    points: Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5, z: 0 })),
  };
  assert.ok(validHand(hand));
  assert.equal(validHand({ ...hand, points: hand.points.slice(1) }), false);
  hand.points[3].x = NaN;
  assert.equal(validHand(hand), false);
});
test("camera errors provide recoverable user messages", () => {
  const denied = new Error();
  denied.name = "NotAllowedError";
  assert.match(cameraError(denied), /not allowed/);
  const missing = new Error();
  missing.name = "NotFoundError";
  assert.match(cameraError(missing), /No camera/);
  assert.match(cameraError(null), /Normal controls/);
});
