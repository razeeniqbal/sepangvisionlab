// Visual car motion derived from the track and the sampled state. Pure maths, no three.js.
// None of this feeds back into race state; it only animates wheels and body attitude.
import { poseAtDistance, type TrackProfile } from "./lapPhysics.ts";

const G = 9.81;
export const MAX_STEER = 0.38; // rad
export const MAX_PITCH = 0.03; // rad
export const MAX_ROLL = 0.035; // rad

const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const clamp = (v: number, limit: number) =>
  Math.max(-limit, Math.min(limit, v));

/**
 * Front-wheel steer from the heading change over the next `lookahead` metres
 * (kinematic bicycle model: δ = atan(L · Δψ / Δs)). Positive steers left.
 */
export function steerAngle(
  track: TrackProfile,
  distance: number,
  wheelbase: number,
  lookahead = 6,
) {
  const a = poseAtDistance(track, distance).heading,
    b = poseAtDistance(track, distance + lookahead).heading;
  return clamp(
    Math.atan((wheelbase * wrapAngle(b - a)) / lookahead),
    MAX_STEER,
  );
}

/** Signed path curvature (1/m, positive left) at a distance, from the profile samples. */
export function curvatureAt(track: TrackProfile, distance: number) {
  const d = ((distance % track.length) + track.length) % track.length;
  const i = Math.min(
    track.count - 1,
    Math.floor((d / track.length) * track.count),
  );
  return track.curvature[i];
}

/**
 * Target body attitude. Pitch is positive nose-down (braking), roll is positive
 * toward the right side (outside of a left-hand bend). Gains suit a stiff open-wheeler.
 */
export function attitudeTarget(
  acceleration: number,
  speed: number,
  curvature: number,
) {
  const lateralG = (speed * speed * curvature) / G;
  return {
    pitch: clamp((-acceleration / G) * 0.012, MAX_PITCH),
    roll: clamp(lateralG * 0.009, MAX_ROLL),
  };
}

/** Frame-rate independent exponential easing toward a target. */
export function ease(current: number, target: number, delta: number, rate = 8) {
  if (!(delta > 0)) return current;
  return target + (current - target) * Math.exp(-rate * delta);
}

/**
 * Wheel rotation (rad) for the distance covered since the last frame. Seeks and
 * lap wraps larger than `maxStep` metres turn into no spin rather than a blur.
 */
export function spinDelta(
  previousDistance: number,
  distance: number,
  radius: number,
  lapLength: number,
  maxStep = 60,
) {
  let step = distance - previousDistance;
  if (step < -lapLength / 2) step += lapLength;
  if (step > lapLength / 2) step -= lapLength;
  return Math.abs(step) > maxStep ? 0 : step / radius;
}

/**
 * Damped spring step (semi-implicit Euler, sub-stepped for stability). Suspension settles
 * with a slight overshoot instead of the dead-beat easing of `ease`. Returns [value, velocity].
 */
export function spring(
  value: number,
  velocity: number,
  target: number,
  delta: number,
  stiffness = 90,
  damping = 11,
): [number, number] {
  if (!(delta > 0)) return [value, velocity];
  const steps = Math.min(8, Math.ceil(delta / (1 / 120)));
  const h = Math.min(delta, 0.1) / steps;
  for (let i = 0; i < steps; i++) {
    velocity += (stiffness * (target - value) - damping * velocity) * h;
    value += velocity * h;
  }
  return [value, velocity];
}

/** Downforce squat (m): the body runs lower as speed rises, about 2 cm at 300 km/h. */
export const rideDrop = (speed: number) => Math.min(0.025, 2.9e-6 * speed * speed);

/** Small road vibration (rad), stronger with speed; deterministic in replay time. */
export function roadShake(time: number, speed: number, seed: number) {
  const a = Math.min(1, speed / 80) * 0.0012;
  return {
    pitch: a * (Math.sin(time * 37 + seed) * 0.6 + Math.sin(time * 61 + seed * 2.3) * 0.4),
    roll: a * (Math.sin(time * 43 + seed * 1.7) * 0.6 + Math.sin(time * 71 + seed * 0.7) * 0.4),
  };
}

export const BRAKE_AMBIENT = 200; // °C, a warm disc between stops
/**
 * Illustrative carbon brake temperature (°C), stepped in replay time. Heat goes in with
 * braking power (deceleration × speed), and the disc cools towards BRAKE_AMBIENT faster at
 * speed (airflow). Tuned so a 300→80 km/h stop adds ~400-500 °C and a straight sheds it again.
 * Not measured: OpenF1 has no brake temperatures.
 */
export function brakeTemperature(temp: number, gLong: number, speed: number, dt: number) {
  if (!(dt > 0)) return temp;
  const steps = Math.ceil(Math.min(dt, 1) / 0.05),
    h = Math.min(dt, 1) / steps;
  for (let i = 0; i < steps; i++) {
    const heat = Math.max(0, -gLong) * speed * 2.4;
    const cool = (temp - BRAKE_AMBIENT) * 0.35 * (1 + speed / 80);
    temp = Math.min(1200, Math.max(BRAKE_AMBIENT, temp + (heat - cool) * h));
  }
  return temp;
}

/** Brake glow 0..1: none below 550 °C, full at 950 °C. */
export const brakeGlow = (temp: number) => Math.max(0, Math.min(1, (temp - 550) / 400));
