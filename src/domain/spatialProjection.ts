import { projectCircuit } from "./circuitGeometry.ts";
import { Vector3, type Curve } from "three";
// Use the circuit's fixed origin/mean latitude/centering; NEVER center an anchor batch separately.
export function createCircuitReferenceProjector(
  coordinates: readonly (readonly number[])[],
  metresPerUnit = 60,
) {
  const projected = projectCircuit(coordinates, metresPerUnit);
  const origin = coordinates[0],
    anchor = projected[0];
  const latitude =
    coordinates.reduce((sum, p) => sum + p[1], 0) / coordinates.length;
  const metresPerDegree = (Math.PI / 180) * 6371008.8;
  return (longitude: number, lat: number) => {
    if (
      !Number.isFinite(longitude) ||
      !Number.isFinite(lat) ||
      Math.abs(longitude) > 180 ||
      Math.abs(lat) > 90
    )
      throw new RangeError("Invalid geographic anchor");
    return {
      x:
        ((longitude - origin[0]) *
          metresPerDegree *
          Math.cos((latitude * Math.PI) / 180)) /
          metresPerUnit +
        anchor.x,
      y: ((lat - origin[1]) * metresPerDegree) / metresPerUnit + anchor.y,
      z: 0,
    };
  };
}
// Deterministic nearest segment of a densely sampled arc-length polyline. Diagnostic only.
// Lateral separation is NOT survey error; distinct features may legitimately be off the race path.
export function nearestTrackReference(
  curve: Curve<Vector3>,
  point: { x: number; y: number; z: number },
  samples = 10000,
  metresPerUnit = 60,
) {
  if (
    !Number.isInteger(samples) ||
    samples < 10 ||
    !Number.isFinite(metresPerUnit) ||
    metresPerUnit <= 0 ||
    ![point.x, point.y, point.z].every(Number.isFinite)
  )
    throw new RangeError("Invalid alignment query");
  const target = new Vector3(point.x, point.y, point.z);
  let best = Infinity,
    progress = 0,
    nearest = new Vector3();
  let a = curve.getPointAt(0);
  for (let i = 1; i <= samples; i++) {
    const b = curve.getPointAt(i / samples),
      delta = b.clone().sub(a);
    const t = Math.max(
      0,
      Math.min(1, target.clone().sub(a).dot(delta) / (delta.lengthSq() || 1)),
    );
    const p = a.clone().addScaledVector(delta, t),
      distance = p.distanceToSquared(target);
    if (distance < best) {
      best = distance;
      progress = ((i - 1 + t) / samples) % 1;
      nearest = p;
    }
    a = b;
  }
  return {
    accuracyClass: "DERIVED" as const,
    distanceMetres: Math.sqrt(best) * metresPerUnit,
    progress,
    position: nearest.toArray(),
    samples,
  };
}
