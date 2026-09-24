import { validHand, type TrackedHand, type HandPoint } from "./hands.ts";
export type GestureAction =
  | "rewind"
  | "forward"
  | "select"
  | "inspect"
  | "strategy"
  | "cancel"
  | "zoomIn"
  | "zoomOut"
  | "rotateLeft"
  | "rotateRight";
export const gestureActions: {
  action: GestureAction;
  label: string;
  pose: string;
}[] = [
  {
    action: "rewind",
    label: "Rewind 10 seconds",
    pose: "One open hand swipes left",
  },
  {
    action: "forward",
    label: "Forward 10 seconds",
    pose: "One open hand swipes right",
  },
  {
    action: "select",
    label: "Select next driver",
    pose: "Hold thumb–index pinch",
  },
  {
    action: "inspect",
    label: "Show selected inspector",
    pose: "Hold index pointing up",
  },
  {
    action: "strategy",
    label: "Show Strategy Lab",
    pose: "Hold two open palms still",
  },
  { action: "cancel", label: "Pause and disarm gestures", pose: "Hold a fist" },
  { action: "zoomIn", label: "Zoom in", pose: "Move two open hands apart" },
  {
    action: "zoomOut",
    label: "Zoom out",
    pose: "Move two open hands together",
  },
  {
    action: "rotateLeft",
    label: "Rotate left",
    pose: "Rotate line between open hands left",
  },
  {
    action: "rotateRight",
    label: "Rotate right",
    pose: "Rotate line between open hands right",
  },
];
type Pose = "open" | "pinch" | "point" | "fist" | "neutral";
const distance = (a: HandPoint, b: HandPoint, aspect: number) =>
  Math.hypot((a.x - b.x) * aspect, a.y - b.y);
export function classifyPose(h: TrackedHand, aspect = 4 / 3): Pose {
  if (!validHand(h) || h.score < 0.8) return "neutral";
  const p = h.points,
    scale = distance(p[5], p[17], aspect);
  if (scale < 0.025) return "neutral";
  if (distance(p[4], p[8], aspect) / scale < 0.28) return "pinch";
  const ratios = [8, 12, 16, 20].map(
    (i) =>
      distance(p[i], p[0], aspect) /
      Math.max(0.001, distance(p[i - 2], p[0], aspect)),
  );
  if (ratios.every((r) => r > 1.2)) return "open";
  if (ratios.every((r) => r < 0.95)) return "fist";
  if (ratios[0] > 1.2 && ratios.slice(1).every((r) => r < 1.05)) return "point";
  return "neutral";
}
interface Sample {
  time: number;
  x: number;
  y: number;
  distance: number;
  angle: number;
}
/** Bounded rule detector. No timers or actions run outside fresh frame updates. */
export class GestureDetector {
  private last = -Infinity;
  private signature = "";
  private since = 0;
  private fired = false;
  private neutralSince: number | null = null;
  private cooldown = -Infinity;
  private anchor: Sample | null = null;
  reset() {
    this.last = -Infinity;
    this.signature = "";
    this.since = 0;
    this.fired = false;
    this.neutralSince = null;
    this.cooldown = -Infinity;
    this.anchor = null;
  }
  update(
    hands: TrackedHand[],
    time: number,
    aspect = 4 / 3,
  ): GestureAction | null {
    if (!Number.isFinite(time) || !Number.isFinite(aspect) || aspect <= 0) {
      this.reset();
      return null;
    }
    if (time <= this.last) return null;
    if (time - this.last > 350) {
      this.signature = "";
      this.anchor = null;
      this.fired = false;
      this.neutralSince = null;
    }
    this.last = time;
    if (
      hands.length < 1 ||
      hands.length > 2 ||
      hands.some((h) => !validHand(h) || h.score < 0.8)
    ) {
      this.signature = "";
      this.anchor = null;
      this.fired = false;
      return null;
    }
    const sorted = [...hands].sort((a, b) => a.points[0].x - b.points[0].x);
    const poses = sorted.map((h) => classifyPose(h, aspect));
    const sig = sorted.map((h, i) => h.label + ":" + poses[i]).join("|");
    const neutral = poses.every((p) => p === "neutral");
    if (neutral) {
      this.neutralSince ??= time;
      if (time - this.neutralSince >= 250) {
        this.fired = false;
        this.signature = "";
        this.anchor = null;
      }
      return null;
    }
    this.neutralSince = null;
    if (sig !== this.signature) {
      this.signature = sig;
      this.since = time;
      this.anchor = null; /* Require a release after every fired gesture. */
    }
    // Cancel remains available after another gesture without requiring neutral.
    if (poses.length === 1 && poses[0] === "fist" && time - this.since >= 500) {
      this.reset();
      return "cancel";
    }
    if (this.fired || time < this.cooldown) return null;
    let action: GestureAction | null = null;
    if (poses.length === 1) {
      if (poses[0] === "open") {
        const p = sorted[0].points[0],
          x = 1 - p.x,
          y = p.y;
        if (!this.anchor || time - this.anchor.time > 700)
          this.anchor = { time, x, y, distance: 0, angle: 0 };
        const dx = x - this.anchor.x,
          dy = y - this.anchor.y;
        if (
          time - this.anchor.time >= 100 &&
          Math.abs(dx) > 0.18 &&
          Math.abs(dy) < 0.12
        )
          action = dx > 0 ? "forward" : "rewind";
      } else if (time - this.since >= 500) {
        action =
          poses[0] === "pinch"
            ? "select"
            : poses[0] === "point"
              ? "inspect"
              : poses[0] === "fist"
                ? "cancel"
                : null;
      }
    } else if (poses.every((p) => p === "open")) {
      const left = sorted[1].points[0],
        right = sorted[0].points[0];
      const dx = (left.x - right.x) * aspect,
        dy = right.y - left.y;
      const dist = Math.hypot(dx, dy),
        angle = (Math.atan2(dy, dx) * 180) / Math.PI;
      if (dist < 0.12) {
        this.anchor = null;
        this.since = time;
        return null;
      }
      this.anchor ??= { time, x: 0, y: 0, distance: dist, angle };
      if (time - this.anchor.time >= 150) {
        const ratio = dist / this.anchor.distance,
          turn = ((angle - this.anchor.angle + 540) % 360) - 180;
        if (Math.abs(turn) > 20)
          action = turn > 0 ? "rotateRight" : "rotateLeft";
        else if (ratio > 1.3) action = "zoomIn";
        else if (ratio < 0.75) action = "zoomOut";
        else if (
          time - this.since >= 900 &&
          Math.abs(turn) < 8 &&
          Math.abs(ratio - 1) < 0.08
        )
          action = "strategy";
      }
    }
    if (action) {
      this.fired = true;
      this.cooldown = time + 1000;
      this.anchor = null;
    }
    return action;
  }
}
