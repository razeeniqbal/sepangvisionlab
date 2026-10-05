import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { projectCircuit } from "../src/domain/circuitGeometry.ts";
import { buildTrackProfile, findCorners, poseAtDistance } from "../src/domain/lapPhysics.ts";
import { buildStrip, clampInside, leftNormals, mergeStrips } from "../src/components/circuit/environment/ribbon.ts";
import {
  BARRIER_OFFSET, PALM_CLEARANCE, TRACK_HALF_WIDTH, barrierOffset, fitBuilding,
  kerbRuns, nearestSample, scatterPalms,
} from "../src/components/circuit/environment/layout.ts";
import { anchorInProfile } from "../src/components/circuit/environment/anchors.ts";
import { SEPANG_SPATIAL_REFERENCES } from "../src/data/circuits/sepangSpatialReferences.ts";

const coords = JSON.parse(
  readFileSync(new URL("../src/data/circuits/sepang.json", import.meta.url), "utf8"),
).features[0].geometry.coordinates;
const track = buildTrackProfile(projectCircuit(coords, 1), 4, 5543);
const normals = leftNormals(track);

test("closed asphalt strip has one station per sample plus the seam", () => {
  const road = buildStrip(track, normals, { edges: [{ offset: -8, z: 0.1 }, { offset: 8, z: 0.1 }] });
  assert.equal(road.positions.length, (track.count + 1) * 6);
  assert.equal(road.indices.length, track.count * 6);
  // Seam repeats sample 0 so the loop closes without a gap.
  assert.deepEqual([...road.positions.slice(0, 6)], [...road.positions.slice(-6)]);
  assert.ok(road.uvs.at(-2)! * 10 > 5500, "u runs the full lap in metres / 10");
  const merged = mergeStrips([road, road]);
  assert.equal(merged.indices.at(-1), road.indices.at(-1)! + road.positions.length / 3);
});

test("inside offsets are clamped to 0.8 × radius at every sample", () => {
  for (let i = 0; i < track.count; i++) {
    const k = track.curvature[i];
    for (const side of [-1, 1] as const) {
      const o = barrierOffset(track, i, side);
      if (o * k > 0) assert.ok(Math.abs(o) <= 0.8 / Math.abs(k) + 1e-9);
      else assert.equal(Math.abs(o), BARRIER_OFFSET);
    }
  }
  // The hairpin (radius ≈ 21 m) pulls the inside barrier well in from 27 m.
  const tightest = findCorners(track).reduce((a, b) => (Math.abs(track.curvature[a]) > Math.abs(track.curvature[b]) ? a : b));
  const inside = Math.sign(track.curvature[tightest]);
  assert.ok(Math.abs(clampInside(track, tightest, inside * BARRIER_OFFSET)) < 20);
});

test("kerbs follow detected apexes on the inside and exits on the outside", () => {
  const corners = findCorners(track);
  const runs = kerbRuns(track, corners);
  assert.equal(runs.length, corners.length * 2);
  runs.forEach((run, i) => {
    const apex = corners[Math.floor(i / 2)];
    const inside = track.curvature[apex] > 0 ? 1 : -1;
    assert.equal(run.side, i % 2 === 0 ? inside : -inside);
    assert.ok(run.to > run.from);
  });
});

test("sourced anchors keep their position; envelopes shrink to clear the track", () => {
  const pit = anchorInProfile(track, coords, "pit-building");
  const building = fitBuilding(track, { ...pit, heading: Math.PI }, 400, 40);
  assert.equal(building.x, pit.x);
  assert.equal(building.y, pit.y);
  assert.ok(building.length < 400 && building.length >= 30);
  const finish = anchorInProfile(track, coords, "finish");
  assert.ok(nearestSample(track, finish.x, finish.y).distance < 5, "finish anchor lies on the road");
  assert.throws(() => anchorInProfile(track, coords, "nowhere"), RangeError);
});

test("palms are deterministic and keep 45 m from the centre line", () => {
  const a = scatterPalms(track, { count: 300 }), b = scatterPalms(track, { count: 300 });
  assert.deepEqual(a, b);
  assert.equal(a.length, 300);
  for (const palm of a) assert.ok(nearestSample(track, palm.x, palm.y).distance >= PALM_CLEARANCE);
  assert.ok(PALM_CLEARANCE > BARRIER_OFFSET + TRACK_HALF_WIDTH, "palms stay behind the barriers");
});

test("pose lookup agrees with the profile samples", () => {
  const p = poseAtDistance(track, track.distance[100]);
  assert.ok(Math.abs(p.x - track.x[100]) < 1e-9 && Math.abs(p.y - track.y[100]) < 1e-9);
  assert.ok(Math.abs(poseAtDistance(track, track.length + 10).x - poseAtDistance(track, 10).x) < 1e-9);
});

test("generated environment is registered as illustrative", () => {
  const generated = SEPANG_SPATIAL_REFERENCES.filter((r) => r.source === "svlEnvironment");
  assert.ok(generated.length >= 6);
  for (const r of generated) {
    assert.equal(r.accuracyClass, "ILLUSTRATIVE");
    assert.equal(r.latitude, null);
  }
  for (const id of ["env-pit-building", "env-main-grandstand"])
    assert.match(generated.find((r) => r.id === id)!.notes, /SOURCED anchor/);
});
