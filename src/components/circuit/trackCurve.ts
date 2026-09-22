import { CatmullRomCurve3, Vector3, Box3 } from "three";
import sepang from "../../data/circuits/sepang.json";
import {
  projectCircuit,
  densifyCircuit,
} from "../../domain/circuitGeometry.ts";
export const trackPoints = projectCircuit(
  sepang.features[0].geometry.coordinates,
);
export const trackCurve = new CatmullRomCurve3(
  densifyCircuit(trackPoints).map((p) => new Vector3(p.x, p.y, 0)),
  true,
  "centripetal",
);
trackCurve.arcLengthDivisions = 10000;
const bounds = new Box3().setFromPoints(trackCurve.getPoints(4000));
export const trackSize = bounds.getSize(new Vector3());
export const trackCenter = bounds.getCenter(new Vector3());
