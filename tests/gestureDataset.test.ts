import { test } from "node:test";
import assert from "node:assert/strict";
import {
  captureFrame,
  clipProblem,
  datasetExport,
  type GestureClip,
} from "../src/domain/gestureDataset.ts";
const hand = () => ({
  label: "Left",
  score: 0.95,
  points: Array.from({ length: 21 }, (_, i) => ({
    x: 0.2 + i * 0.01,
    y: 0.3 + i * 0.01,
    z: 0,
  })),
});
const clip = (): GestureClip => ({
  id: "clip",
  sessionId: "session",
  label: "neutral",
  aspect: 4 / 3,
  frames: Array.from(
    { length: 20 },
    (_, i) => captureFrame([hand()], i * 100)!,
  ),
});
test("capture clones finite high-confidence landmarks and rejects duplicate identities", () => {
  const h = hand(),
    f = captureFrame([h], 10)!;
  h.points[0].x = 9;
  assert.equal(f.hands[0].points[0].x, 0.2);
  assert.equal(captureFrame([hand(), hand()], 10), null);
  assert.equal(captureFrame([{ ...hand(), score: 0.5 }], 10), null);
  assert.equal(captureFrame([], 10), null);
  assert.equal(captureFrame([hand()], NaN), null);
});
test("clip quality rejects short, interrupted and incorrect hand-count recordings", () => {
  assert.equal(clipProblem(clip()), null);
  const c = clip();
  c.frames = c.frames.slice(0, 10);
  assert.ok(clipProblem(c));
  const d = clip();
  d.frames[8].ms = 1800;
  assert.ok(clipProblem(d));
  const z = clip();
  z.label = "zoom";
  assert.ok(clipProblem(z));
  const r = clip();
  r.frames[8].hands[0].label = "Right";
  assert.ok(clipProblem(r));
});
test("export contains only complete labeled clips and explicit provenance", () => {
  assert.throws(() => datasetExport([]));
  assert.equal(datasetExport([clip()]).source, "user-labeled-camera");
  const bad = clip();
  bad.frames = [];
  assert.throws(() => datasetExport([bad]));
});
