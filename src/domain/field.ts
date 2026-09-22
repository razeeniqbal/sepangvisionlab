import { advanceMotion, type MotionState } from "./movement.ts";

export type TyreCompound = "SOFT" | "MEDIUM" | "HARD";
export interface CarDefinition {
  id: string;
  number: string;
  color: string;
  initialProgress: number;
  lapSeconds: number;
  compound: TyreCompound;
  initialTyreAge: number;
}
export interface CarState extends MotionState {
  id: string;
  number: string;
  position: number;
  speedKph: number;
  compound: TyreCompound;
  tyreAge: number;
}
// Five seconds of synthetic session time pass per wall-clock second.
export const SIMULATION_RATE = 5;
export const CIRCUIT_LENGTH_METERS = 5543;

function rankField(cars: CarState[]): CarState[] {
  const order = [...cars].sort(
    (a, b) =>
      b.completedLaps + b.progress - (a.completedLaps + a.progress) ||
      a.number.localeCompare(b.number),
  );
  const ranks = new Map(order.map((car, index) => [car.id, index + 1]));
  return cars.map((car) => ({ ...car, position: ranks.get(car.id)! }));
}
export function createField(definitions: readonly CarDefinition[]): CarState[] {
  if (
    new Set(definitions.map((car) => car.id)).size !== definitions.length ||
    new Set(definitions.map((car) => car.number)).size !== definitions.length
  )
    throw new RangeError("Car identities must be unique");
  for (const car of definitions) {
    if (
      !Number.isFinite(car.initialProgress) ||
      car.initialProgress < 0 ||
      car.initialProgress >= 1 ||
      !Number.isFinite(car.lapSeconds) ||
      car.lapSeconds <= 0 ||
      !Number.isInteger(car.initialTyreAge) ||
      car.initialTyreAge < 0
    )
      throw new RangeError("Invalid car configuration");
  }
  return rankField(
    definitions.map((car) => ({
      id: car.id,
      number: car.number,
      position: 0,
      progress: car.initialProgress,
      completedLaps: 0,
      speedKph:
        (CIRCUIT_LENGTH_METERS / (car.lapSeconds * SIMULATION_RATE)) * 3.6,
      compound: car.compound,
      tyreAge: car.initialTyreAge,
    })),
  );
}
export function advanceField(
  cars: readonly CarState[],
  definitions: readonly CarDefinition[],
  delta: number,
): CarState[] {
  if (cars.length !== definitions.length)
    throw new RangeError("Field configuration mismatch");
  return rankField(
    cars.map((car, index) => {
      const definition = definitions[index];
      if (car.id !== definition.id)
        throw new RangeError("Field identity mismatch");
      const motion = advanceMotion(car, delta, definition.lapSeconds);
      return {
        ...car,
        ...motion,
        tyreAge: definition.initialTyreAge + motion.completedLaps,
      };
    }),
  );
}
