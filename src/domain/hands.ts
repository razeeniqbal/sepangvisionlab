export interface HandPoint {
  x: number;
  y: number;
  z: number;
}
export interface TrackedHand {
  label: string;
  score: number;
  points: HandPoint[];
}
export const handConnections = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [0, 5],
  [5, 6],
  [6, 7],
  [7, 8],
  [5, 9],
  [9, 10],
  [10, 11],
  [11, 12],
  [9, 13],
  [13, 14],
  [14, 15],
  [15, 16],
  [13, 17],
  [0, 17],
  [17, 18],
  [18, 19],
  [19, 20],
] as const;
export const fingerTips = [
  { name: "Thumb", index: 4 },
  { name: "Index", index: 8 },
  { name: "Middle", index: 12 },
  { name: "Ring", index: 16 },
  { name: "Little", index: 20 },
] as const;
export function validHand(hand: TrackedHand): boolean {
  return (
    hand.points.length === 21 &&
    Number.isFinite(hand.score) &&
    hand.score >= 0 &&
    hand.score <= 1 &&
    hand.points.every((p) => [p.x, p.y, p.z].every(Number.isFinite))
  );
}
/** Clockwise wrist-to-middle-MCP angle in the mirrored preview; zero points up. */
export function handAngle(
  points: HandPoint[],
  width: number,
  height: number,
): number | null {
  if (points.length !== 21) return null;
  const x = -(points[9].x - points[0].x) * width,
    y = -(points[9].y - points[0].y) * height;
  return Math.hypot(x, y) < 1e-6
    ? null
    : (Math.atan2(x, y) * 180) / Math.PI || 0;
}
export function previewPoint(point: HandPoint, width: number, height: number) {
  return { x: (1 - point.x) * width, y: point.y * height };
}
/** Releases late-arriving resources after stop, restart, or component unmount. */
export class ResourceScope {
  private releases: (() => void)[] = [];
  active = true;
  own(release: () => void) {
    if (this.active) this.releases.push(release);
    else release();
  }
  close() {
    if (!this.active) return;
    this.active = false;
    for (const release of this.releases.splice(0).reverse()) {
      try {
        release();
      } catch {
        /* Continue releasing remaining resources. */
      }
    }
  }
}
export function cameraError(error: unknown): string {
  const name = error instanceof Error ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError")
    return "Camera access was not allowed. You can keep using the app normally or enable camera access in your browser and retry.";
  if (name === "NotFoundError")
    return "No camera was found. Connect a webcam and try again.";
  if (name === "NotReadableError")
    return "The camera could not start. Close other apps using it and retry.";
  return "Hand tracking could not start or stopped unexpectedly. Check camera availability and retry. Normal controls still work.";
}
