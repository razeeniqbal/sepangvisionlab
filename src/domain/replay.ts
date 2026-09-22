import {
  advanceField,
  createField,
  SIMULATION_RATE,
  type CarDefinition,
} from "./field.ts";
import { TELEMETRY_WINDOW, type TelemetrySample } from "./telemetry.ts";
export const SESSION_DURATION = 600;
export const PLAYBACK_SPEEDS = [0.5, 1, 2, 5, 10] as const;
export function clampTime(time: number, duration = SESSION_DURATION): number {
  if (!Number.isFinite(time)) throw new RangeError("Invalid replay time");
  return Math.max(0, Math.min(duration, time));
}
export function advanceReplay(
  time: number,
  delta: number,
  speed: number,
  duration = SESSION_DURATION,
): number {
  if (
    !Number.isFinite(delta) ||
    delta < 0 ||
    !PLAYBACK_SPEEDS.some((value) => value === speed)
  )
    throw new RangeError("Invalid playback step");
  return clampTime(clampTime(time, duration) + delta * speed, duration);
}
export function fieldAtTime(
  definitions: readonly CarDefinition[],
  time: number,
) {
  return advanceField(
    createField(definitions),
    definitions,
    clampTime(time) / SIMULATION_RATE,
  );
}
export function lapMarkers(
  car: CarDefinition,
): { lap: number; time: number }[] {
  const duration = car.lapSeconds * SIMULATION_RATE;
  const markers = [{ lap: 1, time: 0 }];
  for (let lap = 2; ; lap++) {
    const time = (lap - 1 - car.initialProgress) * duration;
    if (time > SESSION_DURATION) break;
    markers.push({ lap, time });
  }
  return markers;
}
// Reconstruct this deterministic synthetic session, including seeks to unseen times.
export function telemetryAtTime(
  car: CarDefinition,
  time: number,
): TelemetrySample[] {
  const end = clampTime(time);
  const start = Math.max(0, end - TELEMETRY_WINDOW);
  const speed = createField([car])[0].speedKph;
  const samples: TelemetrySample[] = [];
  for (let t = start; t < end; t += 0.5)
    samples.push({ time: t, speed, throttle: 50, brake: 0 });
  samples.push({ time: end, speed, throttle: 50, brake: 0 });
  return samples;
}
export function formatTime(time: number): string {
  const seconds = Math.floor(clampTime(time));
  return `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
}
