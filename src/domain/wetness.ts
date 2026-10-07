// Track wetness (0 dry .. 1 soaked) from OpenF1 rain readings. Pure.
import type { WeatherRow } from "./recordedSession.ts";

/**
 * Minutes for the track to dry after the rain stops. Illustrative, fitted to the 2026 race: rain
 * ended 44 min into the replay, cars came off intermediates after lap 9 (~120 min, 76 min later)
 * and lap times stopped falling around lap 13 (~130 min, 86 min later).
 */
export const DRYING_MINUTES = 90;

/** 1 while the latest reading says rain, then falling linearly to 0 over DRYING_MINUTES. */
export function wetnessAt(weather: readonly WeatherRow[], time: number) {
  let lastRain: number | null = null,
    raining = false;
  for (const w of weather) {
    if (w.t > time) break;
    raining = (w.rain ?? 0) > 0;
    if (raining) lastRain = w.t;
  }
  if (raining) return 1;
  if (lastRain === null) return 0;
  return Math.max(0, 1 - (time - lastRain) / (DRYING_MINUTES * 60_000));
}

/** Whether rain is falling at a time (latest reading). */
export function rainingAt(weather: readonly WeatherRow[], time: number) {
  let raining = false;
  for (const w of weather) {
    if (w.t > time) break;
    raining = (w.rain ?? 0) > 0;
  }
  return raining;
}
