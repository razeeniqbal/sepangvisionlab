import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { CatmullRomCurve3, Vector3 } from "three";
import {
  projectCircuit,
  densifyCircuit,
} from "../src/domain/circuitGeometry.ts";
import {
  surfaceFrame,
  surfaceRibbon,
} from "../src/components/circuit/surfaceGeometry.ts";
import { engineeringCamera } from "../src/components/circuit/cameraView.ts";
import {
  FOUNDATION,
  PIT_LANE,
  KERB_ZONES,
} from "../src/components/circuit/foundationConfig.ts";
const bytes = readFileSync(
  new URL("../src/data/circuits/sepang.json", import.meta.url),
);
const source = JSON.parse(bytes.toString());
const curve = new CatmullRomCurve3(
  densifyCircuit(projectCircuit(source.features[0].geometry.coordinates)).map(
    (p) => new Vector3(p.x, p.y, 0),
  ),
  true,
  "centripetal",
);
curve.arcLengthDivisions = 10000;
test("foundation preserves source bytes and normalized curve position/tangent", () => {
  // Repository-byte fingerprint captured before this milestone (upstream provenance hash differs).
  assert.equal(
    createHash("sha256").update(bytes).digest("hex"),
    "a9b410f19db91d398f5b1bc034e875086b8fc8ee1178da9fd9ee2c2f80ad8bd6",
  );
  const samples = Array.from({ length: 101 }, (_, i) => ({
    p: curve.getPointAt(i / 100),
    t: curve.getTangentAt(i / 100),
  }));
  const geometry = surfaceRibbon(curve, [
    [-0.15, -0.025],
    [-0.15, 0],
    [0.15, 0],
    [0.15, -0.025],
  ]);
  samples.forEach((sample, i) => {
    const frame = surfaceFrame(curve, i / 100);
    assert.ok(frame.position.distanceTo(sample.p) < 1e-9);
    assert.ok(frame.tangent.dot(sample.t) > 0.999999);
    assert.equal(frame.position.z, 0);
    assert.ok(frame.normal.distanceTo(new Vector3(0, 0, 1)) < 1e-9);
  });
  geometry.dispose();
});
test("road has continuous closure, defined width, upward normals, UVs and depth", () => {
  const w = FOUNDATION.halfWidth,
    g = surfaceRibbon(
      curve,
      [
        [-w, -0.025],
        [-w, 0],
        [w, 0],
        [w, -0.025],
      ],
      0,
      1,
      100,
    );
  const p = g.getAttribute("position"),
    n = g.getAttribute("normal");
  assert.equal(g.index!.count / 3, 600);
  assert.equal(g.getAttribute("uv").count, p.count);
  const first = new Vector3().fromBufferAttribute(p, 1),
    last = new Vector3().fromBufferAttribute(p, p.count - 3);
  assert.ok(first.distanceTo(last) < 1e-6);
  assert.ok(
    Math.abs(
      first.distanceTo(new Vector3().fromBufferAttribute(p, 2)) - 2 * w,
    ) < 1e-6,
  );
  assert.equal(p.getZ(1), 0);
  assert.ok(p.getZ(0) < 0);
  assert.ok(n.getZ(1) > 0);
  for (const array of [p.array, n.array, g.getAttribute("uv").array])
    assert.ok(Array.from(array).every(Number.isFinite));
  g.dispose();
});
test("surface frame supports synthetic elevation without changing horizontal progress", () => {
  const elevated = new CatmullRomCurve3(
    [
      new Vector3(0, 0, 0),
      new Vector3(2, 0, 1),
      new Vector3(3, 2, 1),
      new Vector3(0, 3, 0),
    ],
    true,
  );
  const f = surfaceFrame(elevated, 0.2);
  assert.ok(f.position.distanceTo(elevated.getPointAt(0.2)) < 1e-9);
  assert.ok(Math.abs(f.normal.dot(f.tangent)) < 1e-9);
  assert.ok(Math.abs(f.normal.dot(f.lateral)) < 1e-9);
  assert.ok(f.normal.z > 0);
  assert.ok(f.position.z > 0);
});
test("kerb ranges generate raised coloured geometry without inventing a pit lane", () => {
  assert.equal(PIT_LANE, null);
  for (const z of KERB_ZONES) {
    const g = surfaceRibbon(
      curve,
      [
        [0.16, 0],
        [0.18, 0.012],
        [0.21, 0],
      ],
      z.from,
      z.to,
      10,
      true,
    );
    assert.equal(g.index!.count / 3, 40);
    assert.ok(g.getAttribute("color"));
    assert.ok(g.getAttribute("position").getZ(1) > 0.01);
    g.dispose();
  }
  assert.throws(() => surfaceRibbon(curve, [[0, 0]], 0, 1, 10));
  assert.throws(() =>
    surfaceRibbon(
      curve,
      [
        [0, 0],
        [1, 0],
      ],
      0.8,
      0.2,
      10,
    ),
  );
});
test("engineering camera remains orthogonal with top/oblique/orbit poses", () => {
  for (const tilt of [0, 48])
    for (const angle of [-180, -90, 0, 90, 180]) {
      const pose = engineeringCamera({
        zoom: 1,
        angle,
        tilt,
        target: [2, 3, 0],
      });
      assert.ok(Math.abs(pose.position.distanceTo(pose.target) - 45) < 1e-9);
      assert.ok(
        Math.abs(
          pose.position.clone().sub(pose.target).normalize().dot(pose.up),
        ) < 1e-9,
      );
      assert.ok(pose.position.z > 0);
      assert.deepEqual(pose.target.toArray(), [2, 3, 0]);
    }
});
