import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  projectCircuit,
  densifyCircuit,
} from "../src/domain/circuitGeometry.ts";
import { CatmullRomCurve3, Vector3 } from "three";
const data = JSON.parse(
  readFileSync(
    new URL("../src/data/circuits/sepang.json", import.meta.url),
    "utf8",
  ),
);
const coords: number[][] = data.features[0].geometry.coordinates;
const points = projectCircuit(coords);
const curve = new CatmullRomCurve3(
  densifyCircuit(points).map((p) => new Vector3(p.x, p.y, 0)),
  true,
  "centripetal",
);
curve.arcLengthDivisions = 10000;
test("Sepang source has a closed geographic path", () => {
  assert.deepEqual(coords[0], coords.at(-1));
  assert.equal(points.length, coords.length - 1);
  assert.ok(
    coords.every(
      ([lon, lat]) => lon > 101.73 && lon < 101.75 && lat > 2.75 && lat < 2.77,
    ),
  );
});
test("projection centers the track without changing proportions", () => {
  for (const axis of ["x", "y"] as const)
    assert.ok(
      Math.abs(
        Math.min(...points.map((p) => p[axis])) +
          Math.max(...points.map((p) => p[axis])),
      ) < 1e-10,
    );
  const sourceRatio =
    ((coords[1][0] - coords[0][0]) *
      Math.cos(
        ((coords.reduce((s, p) => s + p[1], 0) / coords.length) * Math.PI) /
          180,
      )) /
    (coords[1][1] - coords[0][1]);
  assert.ok(
    Math.abs(
      (points[1].x - points[0].x) / (points[1].y - points[0].y) - sourceRatio,
    ) < 1e-8,
  );
});
test("path length stays within one percent of published 5543 m", () =>
  assert.ok(Math.abs(curve.getLength() * 60 - 5543) / 5543 < 0.01));
test("progress wraps continuously at source start/finish", () => {
  assert.ok(curve.getPointAt(0).distanceTo(curve.getPointAt(1)) < 1e-9);
  assert.ok(
    curve.getPointAt(0).distanceTo(new Vector3(points[0].x, points[0].y, 0)) <
      1e-9,
  );
  assert.ok(curve.getTangentAt(0).dot(curve.getTangentAt(1)) > 0.999);
  assert.ok(curve.getTangentAt(0).x < 0); // Main straight runs west towards turn 1.
});
test("smoothing retains the source polyline within 3 m", () => {
  let maxDistance = 0;
  for (const p of curve.getPoints(2000)) {
    let nearest = Infinity;
    for (let i = 0; i < points.length; i++) {
      const a = points[i],
        b = points[(i + 1) % points.length],
        dx = b.x - a.x,
        dy = b.y - a.y;
      const t = Math.max(
        0,
        Math.min(
          1,
          ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy),
        ),
      );
      nearest = Math.min(
        nearest,
        Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy),
      );
    }
    maxDistance = Math.max(maxDistance, nearest * 60);
  }
  assert.ok(maxDistance < 3, String(maxDistance));
});
test("rejects invalid geometry", () => {
  assert.throws(() => projectCircuit([]));
  assert.throws(() =>
    projectCircuit([
      [0, 0],
      [1, 1],
      [NaN, 2],
      [0, 0],
    ]),
  );
  assert.throws(() => densifyCircuit(points, 0));
});
