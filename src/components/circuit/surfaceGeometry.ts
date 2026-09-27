import {
  BufferGeometry,
  Float32BufferAttribute,
  Vector3,
  type Curve,
} from "three";

export interface TrackSurfaceFrame {
  position: Vector3;
  tangent: Vector3;
  lateral: Vector3;
  normal: Vector3;
}
// Visual surface frame only. The authoritative curve and normalized progress are never mutated.
// Z-up, neutral banking. A future verified elevation curve can supply position.z/pitch.
export function surfaceFrame(
  curve: Curve<Vector3>,
  progress: number,
): TrackSurfaceFrame {
  const u = ((progress % 1) + 1) % 1;
  const position = curve.getPointAt(u);
  const tangent = curve.getTangentAt(u).normalize();
  const lateral = new Vector3(-tangent.y, tangent.x, 0).normalize();
  const normal = new Vector3().crossVectors(tangent, lateral).normalize();
  return { position, tangent, lateral, normal };
}
// Sweep a small cross-section along a normalized curve interval. Supports open metadata ranges.
// Offset/height pairs allow pavement sides, raised kerbs, rail profiles and future overlays.
export function surfaceRibbon(
  curve: Curve<Vector3>,
  profile: readonly (readonly [number, number])[],
  from = 0,
  to = 1,
  steps = 1600,
  alternating = false,
) {
  if (
    profile.length < 2 ||
    !Number.isFinite(from) || !Number.isFinite(to) ||
    steps < 1 ||
    !Number.isInteger(steps) ||
    from < 0 ||
    to > 1 ||
    to <= from ||
    profile.some((p) => p.some((v) => !Number.isFinite(v)))
  )
    throw new RangeError("Invalid surface ribbon");
  const positions: number[] = [],
    uvs: number[] = [],
    colours: number[] = [],
    indices: number[] = [];
  const length = curve.getLength();
  // Duplicate each station pair so kerb colour changes stay sharp and UVs remain continuous.
  for (let i = 0; i < steps; i++) {
    const base = positions.length / 3;
    for (const station of [i, i + 1]) {
      const progress = from + ((to - from) * station) / steps;
      const frame = surfaceFrame(curve, progress);
      for (const [offset, height] of profile) {
        const p = frame.position
          .clone()
          .addScaledVector(frame.lateral, offset)
          .addScaledVector(frame.normal, height);
        positions.push(p.x, p.y, p.z);
        uvs.push(progress * length, offset);
        const colour =
          alternating && i % 2 === 0
            ? [0.36, 0.085, 0.075]
            : [0.58, 0.59, 0.55];
        colours.push(...colour);
      }
    }
    for (let j = 0; j < profile.length - 1; j++) {
      const a = base + j,
        b = a + profile.length;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  if (alternating)
    geometry.setAttribute("color", new Float32BufferAttribute(colours, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}
