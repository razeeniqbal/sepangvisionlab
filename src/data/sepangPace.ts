import sepang from "./circuits/sepang.json";
import elevation from "./circuits/sepangElevation.json";
import { projectCircuit } from "../domain/circuitGeometry.ts";
import { CIRCUIT_LENGTH_METERS } from "../domain/field.ts";
import { buildTrackProfile } from "../domain/lapPhysics.ts";

// One metric profile of the Bacinger outline, rescaled to the official 5.543 km lap.
// Recorded positions are aligned to it (Step 3) and the driver view is built from it.
export const sepangTrack = buildTrackProfile(
  projectCircuit(sepang.features[0].geometry.coordinates, 1),
  4,
  CIRCUIT_LENGTH_METERS,
);
// DERIVED elevation from OpenF1 heights (scripts/derive-elevation.ts), one value per sample.
if (elevation.heights.length === sepangTrack.count)
  sepangTrack.z = Float64Array.from(elevation.heights);
