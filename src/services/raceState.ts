import type { CarDefinition, CarState } from "../domain/field.ts";
import type { TelemetrySample } from "../domain/telemetry.ts";
export interface NormalizedCar extends CarState {
  throttle: number;
  brake: number;
}
export interface RaceState {
  schemaVersion: 1;
  sessionId: string;
  source: "synthetic";
  time: number;
  cars: NormalizedCar[];
}
export interface ReplayData {
  schemaVersion: 1;
  sessionId: string;
  source: "synthetic";
  circuitId: "sepang";
  duration: 600;
  sampleInterval: 1;
  interpolation: "linear-distance";
  entries: CarDefinition[];
  frames: RaceState[];
}
const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;
const finite = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);
const integer = (value: unknown): value is number =>
  finite(value) && Number.isInteger(value) && value >= 0;
const compound = (value: unknown) =>
  value === "SOFT" || value === "MEDIUM" || value === "HARD";
export function parseReplay(value: unknown): ReplayData {
  const fail = () => {
    throw new Error("The session data is incompatible or incomplete.");
  };
  if (!object(value)) return fail();
  if (
    value.schemaVersion !== 1 ||
    value.sessionId !== "sepang-synthetic-v1" ||
    value.source !== "synthetic" ||
    value.circuitId !== "sepang" ||
    value.duration !== 600 ||
    value.sampleInterval !== 1 ||
    value.interpolation !== "linear-distance" ||
    !Array.isArray(value.entries) ||
    value.entries.length !== 20 ||
    !Array.isArray(value.frames) ||
    value.frames.length !== 601
  )
    return fail();
  const ids: string[] = [];
  const numbers: string[] = [];
  for (const entry of value.entries) {
    if (
      !object(entry) ||
      typeof entry.id !== "string" ||
      typeof entry.number !== "string" ||
      typeof entry.color !== "string" ||
      !/^#[0-9a-f]{6}$/i.test(entry.color) ||
      !finite(entry.initialProgress) ||
      entry.initialProgress < 0 ||
      entry.initialProgress >= 1 ||
      !finite(entry.lapSeconds) ||
      entry.lapSeconds <= 0 ||
      !compound(entry.compound) ||
      !integer(entry.initialTyreAge)
    )
      return fail();
    ids.push(entry.id);
    numbers.push(entry.number);
  }
  if (
    new Set(ids).size !== 20 ||
    new Set(numbers).size !== 20 ||
    !ids.includes("car-07")
  )
    return fail();
  for (const [index, frame] of value.frames.entries()) {
    if (
      !object(frame) ||
      frame.schemaVersion !== 1 ||
      frame.sessionId !== value.sessionId ||
      frame.source !== value.source ||
      frame.time !== index ||
      !Array.isArray(frame.cars) ||
      frame.cars.length !== 20
    )
      return fail();
    const ranks: number[] = [];
    for (const [i, car] of frame.cars.entries()) {
      if (
        !object(car) ||
        car.id !== ids[i] ||
        car.number !== numbers[i] ||
        !integer(car.position) ||
        car.position < 1 ||
        car.position > 20 ||
        !integer(car.completedLaps) ||
        !finite(car.progress) ||
        car.progress < 0 ||
        car.progress >= 1 ||
        !finite(car.speedKph) ||
        car.speedKph < 0 ||
        !compound(car.compound) ||
        !integer(car.tyreAge) ||
        !finite(car.throttle) ||
        car.throttle < 0 ||
        car.throttle > 100 ||
        !finite(car.brake) ||
        car.brake < 0 ||
        car.brake > 100
      )
        return fail();
      ranks.push(car.position);
    }
    if (new Set(ranks).size !== 20) return fail();
  }
  return value as unknown as ReplayData;
}
export async function loadReplay(signal: AbortSignal): Promise<ReplayData> {
  const response = await fetch("/api/v1/session/replay", { signal });
  if (!response.ok)
    throw new Error(
      "The local session service is unavailable. Start it and retry.",
    );
  return parseReplay(await response.json());
}
// Interpolate the provider's cumulative distance, never recompute its simulation.
export function sampleRace(data: ReplayData, time: number): NormalizedCar[] {
  const t = Math.max(0, Math.min(data.duration, time));
  const lower = data.frames[Math.floor(t)],
    upper = data.frames[Math.ceil(t)];
  const fraction = t - lower.time;
  const cars = lower.cars.map((car, i) => {
    const next = upper.cars[i];
    const total =
      car.completedLaps +
      car.progress +
      fraction *
        (next.completedLaps + next.progress - car.completedLaps - car.progress);
    const laps = Math.floor(total + 1e-12);
    return {
      ...car,
      progress: Math.max(0, total - laps),
      completedLaps: laps,
      tyreAge: car.tyreAge + laps - car.completedLaps,
      speedKph: car.speedKph + fraction * (next.speedKph - car.speedKph),
      throttle: car.throttle + fraction * (next.throttle - car.throttle),
      brake: car.brake + fraction * (next.brake - car.brake),
    };
  });
  const ranks = new Map(
    [...cars]
      .sort(
        (a, b) =>
          b.completedLaps + b.progress - (a.completedLaps + a.progress) ||
          a.number.localeCompare(b.number),
      )
      .map((car, i) => [car.id, i + 1]),
  );
  return cars.map((car) => ({ ...car, position: ranks.get(car.id)! }));
}
export function sampleTelemetry(
  data: ReplayData,
  id: string,
  time: number,
): TelemetrySample[] {
  const end = Math.max(0, Math.min(data.duration, time));
  const result: TelemetrySample[] = [];
  const add = (t: number) => {
    const car = sampleRace(data, t).find((car) => car.id === id)!;
    result.push({
      time: t,
      speed: car.speedKph,
      throttle: car.throttle,
      brake: car.brake,
    });
  };
  for (let t = Math.max(0, end - 60); t < end; t += 0.5) add(t);
  add(end);
  return result;
}
