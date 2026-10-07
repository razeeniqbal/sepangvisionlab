// Engine tone parameters from recorded telemetry. Pure.

/** A 1.6 L turbo V6 fires three times per crankshaft revolution. */
export const FIRINGS_PER_REV = 3;

/**
 * Oscillator settings for an engine at `rpm` with `throttle` (0-100): the fundamental is the
 * firing frequency, the low-pass cutoff opens with throttle, and the volume is a gentle idle
 * level rising with throttle. Silent when the replay is paused or the engine is off.
 */
export function engineTone(rpm: number, throttle: number, running: boolean) {
  const r = Math.max(0, Math.min(15000, rpm)),
    t = Math.max(0, Math.min(100, throttle)) / 100;
  const frequency = Math.max(30, (r / 60) * FIRINGS_PER_REV);
  return {
    frequency,
    cutoff: 600 + t * 2400 + frequency,
    volume: running && r > 500 ? 0.025 + t * 0.06 : 0,
  };
}
