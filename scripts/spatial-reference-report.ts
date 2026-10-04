// Reproduce alignment diagnostics: node --experimental-strip-types scripts/spatial-reference-report.ts
import { readFileSync } from "node:fs";
import { CatmullRomCurve3, Vector3 } from "three";
import {
  projectCircuit,
  densifyCircuit,
} from "../src/domain/circuitGeometry.ts";
import {
  createCircuitReferenceProjector,
  nearestTrackReference,
} from "../src/domain/spatialProjection.ts";
import { SPATIAL_ANCHORS } from "../src/data/circuits/sepangSpatialReferences.ts";
const coords = JSON.parse(
  readFileSync(
    new URL("../src/data/circuits/sepang.json", import.meta.url),
    "utf8",
  ),
).features[0].geometry.coordinates;
const curve = new CatmullRomCurve3(
  densifyCircuit(projectCircuit(coords)).map((p) => new Vector3(p.x, p.y, 0)),
  true,
  "centripetal",
);
curve.arcLengthDivisions = 10000;
const project = createCircuitReferenceProjector(coords);
const references = SPATIAL_ANCHORS.map((r) => {
  const world = project(r.longitude!, r.latitude!);
  return {
    id: r.id,
    label: r.label,
    latitude: r.latitude,
    longitude: r.longitude,
    classification: r.accuracyClass,
    world,
    alignment: nearestTrackReference(curve, world),
    distanceFromExistingOriginMetres:
      new Vector3(world.x, world.y, 0).distanceTo(curve.getPointAt(0)) * 60,
  };
});
const entry = references.find((r) => r.id === "pit-entry")!,
  exit = references.find((r) => r.id === "pit-exit")!;
console.log(
  JSON.stringify(
    {
      method:
        "Nearest 10,000-segment arc-length polyline; separation is not survey error",
      existingCurveLengthMetres: curve.getLength() * 60,
      pitEndpointChordMetres:
        Math.hypot(entry.world.x - exit.world.x, entry.world.y - exit.world.y) *
        60,
      references,
    },
    null,
    2,
  ),
);
