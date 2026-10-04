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
  createCircuitReferenceProjector,
  nearestTrackReference,
} from "../src/domain/spatialProjection.ts";
import {
  parseSpatialReferences,
  SPATIAL_ANCHORS,
  SEPANG_SPATIAL_REFERENCES,
  SEPANG_SPATIAL_PROFILES,
  SPATIAL_SOURCES,
} from "../src/data/circuits/sepangSpatialReferences.ts";
const bytes = readFileSync(
  new URL("../src/data/circuits/sepang.json", import.meta.url),
);
const coords = JSON.parse(bytes.toString()).features[0].geometry
  .coordinates as number[][];
const project = createCircuitReferenceProjector(coords);
const curve = new CatmullRomCurve3(
  densifyCircuit(projectCircuit(coords)).map((p) => new Vector3(p.x, p.y, 0)),
  true,
  "centripetal",
);
curve.arcLengthDivisions = 10000;
test("spatial registry validates complete provenance and unique source-backed anchors", () => {
  assert.equal(SPATIAL_ANCHORS.length, 8);
  assert.equal(
    new Set(SEPANG_SPATIAL_REFERENCES.map((r) => r.id)).size,
    SEPANG_SPATIAL_REFERENCES.length,
  );
  assert.deepEqual(
    parseSpatialReferences(
      JSON.parse(JSON.stringify(SEPANG_SPATIAL_REFERENCES)),
    ),
    SEPANG_SPATIAL_REFERENCES,
  );
  for (const r of SEPANG_SPATIAL_REFERENCES) {
    assert.ok(SPATIAL_SOURCES[r.source]);
    assert.ok(r.notes);
    assert.ok(r.category);
  }
});
test("parser rejects missing/partial coordinates, unknown confidence and bad sources", () => {
  const good = SPATIAL_ANCHORS[0];
  for (const patch of [
    { latitude: null },
    { longitude: NaN },
    { latitude: 100 },
    { source: "missing" },
    { source: "toString" },
    { accuracyClass: "VERIFIED" },
    { sourceDate: "yesterday" },
    { notes: "" },
    { accuracyClass: "UNAVAILABLE" },
  ])
    assert.throws(() => parseSpatialReferences([{ ...good, ...patch }]));
  assert.throws(() => parseSpatialReferences([good, good]));
  assert.throws(() => parseSpatialReferences(null));
});
test("reference projection matches every existing coordinate without recentering", () => {
  const existing = projectCircuit(coords);
  existing.forEach((p, i) => {
    const actual = project(coords[i][0], coords[i][1]);
    assert.ok(Math.abs(actual.x - p.x) < 1e-12);
    assert.ok(Math.abs(actual.y - p.y) < 1e-12);
    assert.equal(actual.z, 0);
  });
  assert.throws(() => project(NaN, 2.76));
  assert.throws(() => project(101, 91));
});
test("pit entry, exit, finish and three intermediates retain published GPS and neutral Z", () => {
  const expected = [
    ["pit-entry", 101.73881, 2.76094],
    ["pit-exit", 101.73507, 2.76062],
    ["finish", 101.7384, 2.76074],
    ["intermediate-1", 101.73395, 2.76383],
    ["intermediate-2", 101.74238, 2.7614],
    ["intermediate-3", 101.73477, 2.75782],
  ] as const;
  for (const [id, lon, lat] of expected) {
    const r = SPATIAL_ANCHORS.find((r) => r.id === id)!;
    assert.equal(r.longitude, lon);
    assert.equal(r.latitude, lat);
    assert.equal(r.accuracyClass, "SOURCED");
    const p = project(lon, lat);
    assert.equal(p.z, 0);
    assert.ok(Math.abs(p.x) < 20 && Math.abs(p.y) < 20);
  }
  const finish = project(101.7384, 2.76074);
  assert.ok(
    new Vector3(finish.x, finish.y, 0).distanceTo(curve.getPointAt(0)) * 60 >
      200,
  );
});
test("official overall dimensions cannot become local width, elevation or pit-path samples", () => {
  for (const [id, value] of [
    ["width-min", 16],
    ["width-max", 22],
    ["circuit-length", 5543],
    ["corners", 15],
  ] as const) {
    const r = SEPANG_SPATIAL_REFERENCES.find((r) => r.id === id)!;
    assert.equal(r.value, value);
    assert.equal(r.accuracyClass, "OFFICIAL");
  }
  assert.equal(SEPANG_SPATIAL_PROFILES.width.samples, null);
  assert.equal(SEPANG_SPATIAL_PROFILES.elevation.samples, null);
  assert.equal(SEPANG_SPATIAL_PROFILES.pitLane.points, null);
  for (const id of ["width-profile", "elevation-profile", "pit-centreline"]) {
    const r = SEPANG_SPATIAL_REFERENCES.find((r) => r.id === id)!;
    assert.equal(r.accuracyClass, "UNAVAILABLE");
    assert.equal(r.latitude, null);
    assert.equal(r.value, null);
  }
});
test("building anchors and illustrative foundation retain lower-confidence classifications", () => {
  for (const id of ["pit-building", "main-grandstand"]) {
    const r = SPATIAL_ANCHORS.find((r) => r.id === id)!;
    assert.equal(r.accuracyClass, "SOURCED");
    assert.equal(r.sourceDate, null);
  }
  for (const id of ["kerbs", "gravel", "runoff", "barriers", "terrain"])
    assert.equal(
      SEPANG_SPATIAL_REFERENCES.find((r) => r.id === id)!.accuracyClass,
      "ILLUSTRATIVE",
    );
});
test("nearest-track diagnostics preserve source bytes and curve samples", () => {
  assert.equal(
    createHash("sha256").update(bytes).digest("hex"),
    "a9b410f19db91d398f5b1bc034e875086b8fc8ee1178da9fd9ee2c2f80ad8bd6",
  );
  const before = curve.getSpacedPoints(100).map((p) => p.toArray());
  const p = curve.getPointAt(0.25),
    exact = nearestTrackReference(curve, p, 10000);
  assert.ok(exact.distanceMetres < 1e-7);
  assert.ok(Math.abs(exact.progress - 0.25) < 1e-8);
  assert.equal(exact.accuracyClass, "DERIVED");
  assert.deepEqual(
    curve.getSpacedPoints(100).map((p) => p.toArray()),
    before,
  );
  assert.throws(() => nearestTrackReference(curve, p, 0));
});
