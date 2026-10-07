// Car state shared by the replay, the circuit views and the timing tower.
// Recorded sessions add wet-weather tyres and an explicit unknown (never guessed).
export type TyreCompound =
  | "SOFT"
  | "MEDIUM"
  | "HARD"
  | "INTERMEDIATE"
  | "WET"
  | "UNKNOWN";
export interface CarDefinition {
  id: string;
  number: string;
  color: string;
  /** Team name (recorded sessions), used to pick the team's livery scheme. */
  team?: string;
  initialProgress: number;
  lapSeconds: number;
  compound: TyreCompound;
  initialTyreAge: number;
}
export interface CarState {
  id: string;
  number: string;
  position: number;
  progress: number; // 0..1 along the lap
  completedLaps: number;
  speedKph: number;
  compound: TyreCompound;
  tyreAge: number;
}
export const CIRCUIT_LENGTH_METERS = 5543;
