// Replay clock helpers: bounded time and fixed playback speeds.
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
