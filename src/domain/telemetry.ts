import type { CarState } from "./field.ts";
export interface TelemetrySample {
  time: number;
  speed: number;
  throttle: number;
  brake: number;
}
export type TelemetryHistory = Record<string, TelemetrySample[]>;
export const TELEMETRY_WINDOW = 60;
export const MAX_SAMPLES = 121;
// Constant-pace demonstration inputs, not inferred pedal measurements.
export function recordTelemetry(
  history: TelemetryHistory,
  cars: readonly CarState[],
  time: number,
): TelemetryHistory {
  if (!Number.isFinite(time) || time < 0)
    throw new RangeError("Invalid telemetry time");
  return Object.fromEntries(
    cars.map((car) => {
      const previous = history[car.id] ?? [];
      const last = previous.at(-1);
      if (last && time > 0 && time <= last.time) return [car.id, previous];
      const kept =
        time === 0
          ? []
          : previous.filter((sample) => sample.time >= time - TELEMETRY_WINDOW);
      return [
        car.id,
        [...kept, { time, speed: car.speedKph, throttle: 50, brake: 0 }].slice(
          -MAX_SAMPLES,
        ),
      ];
    }),
  );
}
