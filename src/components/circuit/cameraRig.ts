// Camera rig for the circuit viewport. Pure maths (no three.js) so it runs in node --test.
// Buttons and gestures only change targets; the frame loop eases toward them with stepRig.
// Metric frame: x east, y north, z up, metres.
import { findCorners, type TrackProfile } from "../../domain/lapPhysics.ts";

export const CAMERA_MODES = [
  "tv",
  "chase",
  "onboard",
  "heli",
  "inspect",
] as const;
export type CameraMode = (typeof CAMERA_MODES)[number];
export const CAMERA_LABELS: Record<CameraMode, string> = {
  chase: "Chase",
  onboard: "Onboard",
  tv: "TV",
  heli: "Heli",
  inspect: "Inspect",
};

export interface CameraRigState {
  mode: CameraMode;
  yaw: number; // orbit / look-around offset, radians
  targetYaw: number;
  dist: number; // chase, heli and inspect distance, metres
  targetDist: number;
  zoom: number; // TV lens multiplier
  targetZoom: number;
  heading: number | null; // eased car heading for chase
}

const DIST = {
  chase: [7, 13, 30],
  heli: [40, 90, 220],
  inspect: [5, 9, 24],
} as const;
type Orbiting = keyof typeof DIST;
const orbiting = (mode: CameraMode): mode is Orbiting => mode in DIST;
export const YAW_STEP = 0.4;

export function createRig(mode: CameraMode = "tv"): CameraRigState {
  const dist = orbiting(mode) ? DIST[mode][1] : DIST.chase[1];
  return {
    mode,
    yaw: 0,
    targetYaw: 0,
    dist,
    targetDist: dist,
    zoom: 1,
    targetZoom: 1,
    heading: null,
  };
}

export function nextMode(mode: CameraMode): CameraMode {
  return CAMERA_MODES[(CAMERA_MODES.indexOf(mode) + 1) % CAMERA_MODES.length];
}

/** Switch mode: look-around resets and each orbiting mode starts at its default distance. */
export function setMode(rig: CameraRigState, mode: CameraMode) {
  rig.mode = mode;
  rig.targetYaw = 0;
  rig.targetZoom = 1;
  if (orbiting(mode)) rig.targetDist = DIST[mode][1];
}

export type RigAction = "zoomIn" | "zoomOut" | "rotateLeft" | "rotateRight";
/** Apply a button or gesture to the targets. Returns false where the mode ignores it. */
export function applyRigAction(
  rig: CameraRigState,
  action: RigAction,
): boolean {
  const mode = rig.mode;
  if (action === "rotateLeft" || action === "rotateRight") {
    if (mode === "tv") return false;
    rig.targetYaw += action === "rotateLeft" ? YAW_STEP : -YAW_STEP;
    // Onboard is a limited look-around; orbits can go all the way round.
    if (mode === "onboard")
      rig.targetYaw = Math.max(-1.2, Math.min(1.2, rig.targetYaw));
    return true;
  }
  const closer = action === "zoomIn";
  if (mode === "tv") {
    rig.targetZoom = Math.max(
      0.5,
      Math.min(4, rig.targetZoom * (closer ? 1.25 : 0.8)),
    );
    return true;
  }
  if (!orbiting(mode)) return false;
  const [min, , max] = DIST[mode];
  rig.targetDist = Math.max(
    min,
    Math.min(max, rig.targetDist * (closer ? 0.8 : 1.25)),
  );
  return true;
}

const approach = (current: number, target: number, dt: number, rate: number) =>
  dt > 0 ? target + (current - target) * Math.exp(-rate * dt) : current;
const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/** Ease every value toward its target; frame-rate independent. */
export function stepRig(rig: CameraRigState, dt: number) {
  rig.yaw = approach(rig.yaw, rig.targetYaw, dt, 6);
  rig.dist = approach(rig.dist, rig.targetDist, dt, 5);
  rig.zoom = approach(rig.zoom, rig.targetZoom, dt, 5);
}

/**
 * Eased car heading for the chase camera. Position stays locked to the car (lerping it
 * lags 15–20 m at 300 km/h); only this heading is smoothed. Snaps beyond ~35° (seeks).
 */
export function smoothHeading(
  rig: CameraRigState,
  heading: number,
  dt: number,
) {
  if (rig.heading === null || Math.abs(wrapAngle(heading - rig.heading)) > 0.6)
    rig.heading = heading;
  else
    rig.heading = wrapAngle(
      rig.heading +
        wrapAngle(heading - rig.heading) *
          (1 - Math.exp(-5 * Math.max(0, Math.min(dt, 0.25)))),
    );
  return rig.heading;
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}
/** Trackside TV positions: every ~220 m plus one outside each detected apex. */
export function tvPoints(
  track: TrackProfile,
  normals: { nx: Float64Array; ny: Float64Array },
  spacing = 220,
  offset = 36,
): Vec3[] {
  const step = Math.max(1, Math.round(spacing / (track.length / track.count)));
  const indices = new Set<number>();
  for (let i = 0; i < track.count; i += step) indices.add(i);
  for (const apex of findCorners(track)) indices.add(apex);
  return [...indices]
    .sort((a, b) => a - b)
    .map((i) => {
      // Outside of the bend (left on straights), behind the 27 m barrier line.
      const side = track.curvature[i] > 0 ? -1 : 1;
      return {
        x: track.x[i] + normals.nx[i] * side * offset,
        y: track.y[i] + normals.ny[i] * side * offset,
        z: 10, // camera tower height: keeps boards below a tight TV frame
      };
    });
}

export function nearestPoint(
  points: readonly Vec3[],
  x: number,
  y: number,
): Vec3 {
  let best = points[0],
    d = Infinity;
  for (const p of points) {
    const q = (p.x - x) ** 2 + (p.y - y) ** 2;
    if (q < d) {
      d = q;
      best = p;
    }
  }
  return best;
}

/** TV lens: keep roughly an 18 m wide frame on the car, so far shots zoom in. */
export function tvFov(distance: number, zoom = 1) {
  const fov = (2 * Math.atan(9 / Math.max(1, distance)) * 180) / Math.PI;
  return Math.max(3, Math.min(60, fov / zoom));
}

export interface CarPose {
  x: number;
  y: number;
  heading: number;
}
export interface CameraPose {
  position: Vec3;
  target: Vec3;
  fov: number;
}
/** Camera position, look target and vertical FOV for a mode around a car pose. */
export function cameraPose(
  rig: CameraRigState,
  car: CarPose,
  chaseHeading: number,
  tv: readonly Vec3[],
): CameraPose {
  const at = (heading: number, back: number, z: number) => ({
    x: car.x - Math.cos(heading) * back,
    y: car.y - Math.sin(heading) * back,
    z,
  });
  switch (rig.mode) {
    case "onboard": {
      // T-cam above the roll hoop, looking along the car with limited look-around.
      const look = car.heading + rig.yaw;
      return {
        position: at(car.heading, 0.35, 1.32),
        target: {
          x: car.x + Math.cos(look) * 40,
          y: car.y + Math.sin(look) * 40,
          z: 0.9,
        },
        fov: 72,
      };
    }
    case "tv": {
      const p = nearestPoint(tv, car.x, car.y);
      return {
        position: p,
        target: { x: car.x, y: car.y, z: 0.6 },
        fov: tvFov(Math.hypot(p.x - car.x, p.y - car.y, p.z), rig.zoom),
      };
    }
    case "heli": {
      const h = car.heading + rig.yaw + 0.5;
      return {
        position: at(h, rig.dist * 0.75, rig.dist * 0.65),
        target: { x: car.x, y: car.y, z: 0 },
        fov: 40,
      };
    }
    case "inspect": {
      const h = car.heading + rig.yaw + Math.PI * 0.8;
      return {
        position: at(h, rig.dist, 1.4 + rig.dist * 0.18),
        target: { x: car.x, y: car.y, z: 0.55 },
        fov: 45,
      };
    }
    default: {
      const h = chaseHeading + rig.yaw;
      return {
        position: at(h, rig.dist, 1.6 + rig.dist * 0.22),
        target: {
          x: car.x + Math.cos(h) * 14,
          y: car.y + Math.sin(h) * 14,
          z: 1.2,
        },
        fov: 55,
      };
    }
  }
}

/** Drop trackside cameras closer than `clearance` metres to any obstacle point. */
export function clearTvPoints(
  points: readonly Vec3[],
  obstacles: readonly { x: number; y: number }[],
  clearance = 6,
): Vec3[] {
  return points.filter((p) =>
    obstacles.every((o) => Math.hypot(p.x - o.x, p.y - o.y) >= clearance),
  );
}

/**
 * Nearest trackside camera with a clear line of sight to the car. The current camera is
 * kept while it is unblocked and within `hold` × the nearest clear distance, so shots
 * do not flicker between two similar cameras. Returns null if every candidate is blocked.
 */
export function pickTvCamera(
  points: readonly Vec3[],
  car: { x: number; y: number },
  blocked: (point: Vec3) => boolean,
  current: Vec3 | null = null,
  candidates = 6,
  hold = 1.35,
): Vec3 | null {
  const range = (p: Vec3) => Math.hypot(p.x - car.x, p.y - car.y);
  const nearest = [...points].sort((a, b) => range(a) - range(b)).slice(0, candidates);
  const clear = nearest.find((p) => !blocked(p)) ?? null;
  if (!clear) return null;
  if (current && current !== clear && range(current) <= range(clear) * hold && !blocked(current))
    return current;
  return clear;
}
