export interface TrackPoint {
  x: number;
  y: number;
}
export function projectCircuit(
  coordinates: readonly (readonly number[])[],
  metersPerUnit = 60,
): TrackPoint[] {
  if (
    coordinates.length < 4 ||
    !Number.isFinite(metersPerUnit) ||
    metersPerUnit <= 0
  )
    throw new RangeError("Invalid circuit geometry");
  if (
    coordinates.some(
      (p) => p.length < 2 || !Number.isFinite(p[0]) || !Number.isFinite(p[1]),
    )
  )
    throw new RangeError("Invalid coordinate");
  const origin = coordinates[0];
  const latitude =
    coordinates.reduce((sum, p) => sum + p[1], 0) / coordinates.length;
  const metersPerDegree = (Math.PI / 180) * 6371008.8;
  const points = coordinates.map((p) => ({
    x:
      ((p[0] - origin[0]) *
        metersPerDegree *
        Math.cos((latitude * Math.PI) / 180)) /
      metersPerUnit,
    y: ((p[1] - origin[1]) * metersPerDegree) / metersPerUnit,
  }));
  const last = points[points.length - 1];
  if (Math.hypot(last.x - points[0].x, last.y - points[0].y) < 1e-8)
    points.pop();
  const minX = Math.min(...points.map((p) => p.x)),
    maxX = Math.max(...points.map((p) => p.x));
  const minY = Math.min(...points.map((p) => p.y)),
    maxY = Math.max(...points.map((p) => p.y));
  if (maxX - minX <= 0 || maxY - minY <= 0)
    throw new RangeError("Degenerate circuit");
  return points.map((p) => ({
    x: p.x - (minX + maxX) / 2,
    y: p.y - (minY + maxY) / 2,
  }));
}
// Subdivide long straights before spline interpolation to avoid bowed straights.
export function densifyCircuit(
  points: readonly TrackPoint[],
  maxStep = 8 / 60,
): TrackPoint[] {
  if (points.length < 3 || !Number.isFinite(maxStep) || maxStep <= 0)
    throw new RangeError("Invalid sampling interval");
  return points.flatMap((a, i) => {
    const b = points[(i + 1) % points.length];
    const count = Math.max(
      1,
      Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / maxStep),
    );
    return Array.from({ length: count }, (_, j) => ({
      x: a.x + ((b.x - a.x) * j) / count,
      y: a.y + ((b.y - a.y) * j) / count,
    }));
  });
}
