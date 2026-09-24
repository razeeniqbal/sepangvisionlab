import { test } from "node:test";
import assert from "node:assert/strict";
import { GestureDetector, classifyPose } from "../src/domain/gestures.ts";
import type { TrackedHand } from "../src/domain/hands.ts";
function hand(pose = "open", x = 0.5, label = "Left"): TrackedHand {
  const p = Array.from({ length: 21 }, () => ({ x, y: 0.6, z: 0 }));
  p[0] = { x, y: 0.8, z: 0 };
  p[5] = { x: x - 0.08, y: 0.6, z: 0 };
  p[17] = { x: x + 0.08, y: 0.6, z: 0 };
  for (const [k, i] of [8, 12, 16, 20].entries()) {
    p[i - 2] = { x: x + (k - 1.5) * 0.04, y: 0.5, z: 0 };
    p[i] = {
      x: p[i - 2].x,
      y: pose === "fist" || (pose === "point" && k > 0) ? 0.65 : 0.25,
      z: 0,
    };
  }
  p[4] = { x: x - 0.2, y: 0.55, z: 0 };
  if (pose === "pinch") p[4] = { ...p[8] };
  if (pose === "neutral")
    for (const i of [8, 12, 16, 20]) p[i] = { ...p[i - 2] };
  return { label, score: 0.99, points: p };
}
test("geometry recognizes open, fist, pinch and point and rejects low confidence", () => {
  for (const pose of ["open", "fist", "pinch", "point", "neutral"])
    assert.equal(classifyPose(hand(pose)), pose);
  assert.equal(classifyPose({ ...hand(), score: 0.5 }), "neutral");
});
test("held pinch fires once and requires release before retrigger", () => {
  const d = new GestureDetector();
  let events = 0;
  for (let t = 0; t < 2000; t += 100)
    if (d.update([hand("pinch")], t) === "select") events++;
  assert.equal(events, 1);
  for (let t = 2000; t <= 2300; t += 100) d.update([hand("neutral")], t);
  const out = [];
  for (let t = 2400; t <= 3000; t += 100)
    out.push(d.update([hand("pinch")], t));
  assert.equal(out.filter(Boolean).length, 1);
});
test("mirrored swipe direction controls seek and vertical drift suppresses swipe", () => {
  const d = new GestureDetector();
  d.update([hand("open", 0.6)], 0);
  assert.equal(d.update([hand("open", 0.35)], 200), "forward");
  d.reset();
  d.update([hand("open", 0.4)], 0);
  assert.equal(d.update([hand("open", 0.65)], 200), "rewind");
  d.reset();
  d.update([hand()], 0);
  const h = hand("open", 0.2);
  for (const p of h.points) p.y += 0.2;
  assert.equal(d.update([h], 200), null);
});
test("lost, stale, duplicate or low-confidence frames do not finish a held pose", () => {
  const d = new GestureDetector();
  d.update([hand("pinch")], 0);
  d.update([hand("pinch")], 200);
  assert.equal(d.update([hand("pinch")], 700), null);
  assert.equal(d.update([hand("pinch")], 700), null);
  d.update([], 800);
  assert.equal(d.update([hand("pinch")], 900), null);
  assert.equal(d.update([{ ...hand("pinch"), score: 0.2 }], 1000), null);
});
test("two-hand apart and together detect zoom with stable handedness ordering", () => {
  const d = new GestureDetector();
  d.update([hand("open", 0.35, "Left"), hand("open", 0.65, "Right")], 0);
  assert.equal(
    d.update([hand("open", 0.75, "Right"), hand("open", 0.25, "Left")], 200),
    "zoomIn",
  );
  d.reset();
  d.update([hand("open", 0.25, "Left"), hand("open", 0.75, "Right")], 0);
  assert.equal(
    d.update([hand("open", 0.35, "Left"), hand("open", 0.65, "Right")], 200),
    "zoomOut",
  );
});
test("still palms need dwell, fist cancels, and reset discards pending action", () => {
  const d = new GestureDetector(),
    pair = [hand("open", 0.3), hand("open", 0.7, "Right")];
  let result = null;
  for (let t = 0; t <= 900; t += 100) result = d.update(pair, t);
  assert.equal(result, "strategy");
  d.reset();
  for (let t = 0; t < 500; t += 100)
    assert.equal(d.update([hand("fist")], t), null);
  assert.equal(d.update([hand("fist")], 500), "cancel");
  d.reset();
  assert.equal(d.update([hand("pinch")], 1000), null);
});

test('fist can cancel directly after a latched pinch',()=>{
 const d=new GestureDetector();for(let t=0;t<=500;t+=100)d.update([hand('pinch')],t);
 let action=null;for(let t=600;t<=1100;t+=100)action=d.update([hand('fist')],t);assert.equal(action,'cancel');
});
test('rotation uses mirrored hand-line direction and ignores small movement',()=>{
 const d=new GestureDetector();d.update([hand('open',.3,'Left'),hand('open',.7,'Right')],0);
 const a=hand('open',.3,'Left'),b=hand('open',.7,'Right');for(const p of a.points)p.y+=.3;
 assert.equal(d.update([a,b],200),'rotateRight');
 d.reset();d.update([hand('open',.3,'Left'),hand('open',.7,'Right')],0);for(const p of a.points)p.y-=.6;
 assert.equal(d.update([a,b],200),'rotateLeft');
});
