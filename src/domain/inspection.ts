import { SIMULATION_RATE, type CarState, type CarDefinition } from "./field.ts";

export function estimatedGap(
  car: CarState,
  leader: CarState,
  leaderDefinition: CarDefinition,
): number {
  const distance = Math.max(
    0,
    leader.completedLaps + leader.progress - car.completedLaps - car.progress,
  );
  return distance * leaderDefinition.lapSeconds * SIMULATION_RATE;
}
export function lastFullLapSeconds(
  car: CarState,
  definition: CarDefinition,
): number | null {
  const fullLapCompleted =
    car.completedLaps >= (definition.initialProgress === 0 ? 1 : 2);
  return fullLapCompleted ? definition.lapSeconds * SIMULATION_RATE : null;
}
export function formatLap(seconds: number | null): string {
  if (seconds === null) return "—";
  const milliseconds = Math.round(seconds * 1000);
  const minutes = Math.floor(milliseconds / 60000);
  return (
    minutes +
    ":" +
    String(Math.floor(milliseconds / 1000) % 60).padStart(2, "0") +
    "." +
    String(milliseconds % 1000).padStart(3, "0")
  );
}
