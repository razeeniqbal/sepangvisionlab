import sepang from "./circuits/sepang.json";
import { projectCircuit } from "../domain/circuitGeometry.ts";
import { CIRCUIT_LENGTH_METERS } from "../domain/field.ts";
import { buildTrackProfile } from "../domain/lapPhysics.ts";
import { createPaceModel } from "../domain/physicsField.ts";

// One metric profile of the Bacinger outline, rescaled to the official 5.543 km lap.
export const sepangTrack = buildTrackProfile(
  projectCircuit(sepang.features[0].geometry.coordinates, 1),
  4,
  CIRCUIT_LENGTH_METERS,
);
export const sepangPace = createPaceModel(sepangTrack);
