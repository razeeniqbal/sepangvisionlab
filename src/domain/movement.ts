export interface MotionState {
  progress: number;
  completedLaps: number;
}
export const LAP_SECONDS = 24;
export function advanceMotion(
  state: MotionState,
  delta: number,
  lapSeconds = LAP_SECONDS,
): MotionState {
  if (
    !Number.isFinite(delta) ||
    delta < 0 ||
    !Number.isFinite(lapSeconds) ||
    lapSeconds <= 0
  )
    throw new RangeError("Invalid simulation time");
  const total = state.progress + delta / lapSeconds;
  const laps = Math.floor(total + 1e-12);
  return {
    progress: Math.max(0, total - laps),
    completedLaps: state.completedLaps + laps,
  };
}
