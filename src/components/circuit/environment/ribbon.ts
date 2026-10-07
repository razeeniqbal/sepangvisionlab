// Offset strips swept along the metric track profile. Pure maths (no three.js) so it runs in
// node --test. Frame: x east, y north, z up, metres. Positive offsets are left of travel.
import type { TrackProfile } from "../../../domain/lapPhysics.ts";

export type Offset = number | ((index: number) => number);
export interface StripEdge {
  offset: Offset;
  z: number;
}
export interface StripSpec {
  edges: readonly [StripEdge, StripEdge];
  from?: number; // first sample index; omit both for the closed loop
  to?: number; // last sample index, may exceed count to wrap past the line
  uLength?: number; // metres per texture repeat along the strip
}
export interface StripMesh {
  positions: Float32Array;
  uvs: Float32Array;
  indices: Uint32Array;
}

const wrap = (i: number, n: number) => ((i % n) + n) % n;

/** Unit left normal at every sample (central difference). */
export function leftNormals(track: TrackProfile) {
  const n = track.count,
    nx = new Float64Array(n),
    ny = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const a = wrap(i - 1, n),
      b = wrap(i + 1, n);
    const tx = track.x[b] - track.x[a],
      ty = track.y[b] - track.y[a];
    const len = Math.hypot(tx, ty) || 1;
    nx[i] = -ty / len;
    ny[i] = tx / len;
  }
  return { nx, ny };
}

/** Keep an offset on the inside of a bend within 0.8 × radius so strips never fold over. */
export function clampInside(
  track: TrackProfile,
  index: number,
  offset: number,
) {
  const k = track.curvature[wrap(index, track.count)];
  if (offset * k <= 0 || Math.abs(k) < 1e-9) return offset;
  const limit = 0.8 / Math.abs(k);
  return Math.sign(offset) * Math.min(Math.abs(offset), limit);
}

export function buildStrip(
  track: TrackProfile,
  normals: ReturnType<typeof leftNormals>,
  spec: StripSpec,
): StripMesh {
  const n = track.count;
  const closed = spec.from === undefined && spec.to === undefined;
  const from = spec.from ?? 0,
    to = spec.to ?? n;
  if (!Number.isInteger(from) || !Number.isInteger(to) || to <= from)
    throw new RangeError("Invalid strip range");
  const stations = to - from + 1,
    uLength = spec.uLength ?? 10;
  const positions = new Float32Array(stations * 6),
    uvs = new Float32Array(stations * 4),
    indices = new Uint32Array((stations - 1) * 6);
  let u = 0;
  for (let s = 0; s < stations; s++) {
    // The closed loop repeats sample 0 at the end so UVs stay continuous across the line.
    const i = closed && s === stations - 1 ? 0 : wrap(from + s, n);
    if (s > 0) {
      const p = wrap(from + s - 1, n);
      u +=
        Math.hypot(track.x[i] - track.x[p], track.y[i] - track.y[p]) / uLength;
    }
    spec.edges.forEach((edge, e) => {
      const raw =
        typeof edge.offset === "number" ? edge.offset : edge.offset(i);
      const o = clampInside(track, i, raw);
      positions.set(
        [
          track.x[i] + normals.nx[i] * o,
          track.y[i] + normals.ny[i] * o,
          edge.z + (track.z?.[i] ?? 0),
        ],
        s * 6 + e * 3,
      );
      uvs.set([u, e], s * 4 + e * 2);
    });
  }
  for (let s = 0; s < stations - 1; s++) {
    const a = s * 2;
    indices.set([a, a + 2, a + 1, a + 1, a + 2, a + 3], s * 6);
  }
  return { positions, uvs, indices };
}

/** Concatenate strips into one draw call. */
export function mergeStrips(strips: readonly StripMesh[]): StripMesh {
  const vertices = strips.reduce((sum, s) => sum + s.positions.length / 3, 0);
  const positions = new Float32Array(vertices * 3),
    uvs = new Float32Array(vertices * 2),
    indices = new Uint32Array(
      strips.reduce((sum, s) => sum + s.indices.length, 0),
    );
  let v = 0,
    k = 0;
  for (const s of strips) {
    positions.set(s.positions, v * 3);
    uvs.set(s.uvs, v * 2);
    for (let j = 0; j < s.indices.length; j++)
      indices[k + j] = s.indices[j] + v;
    v += s.positions.length / 3;
    k += s.indices.length;
  }
  return { positions, uvs, indices };
}
