import {
  rankField,
  SIMULATION_RATE,
  type CarDefinition,
  type CarState,
  type TyreCompound,
} from "./field.ts";
import {
  sampleAtTime,
  solveSpeedProfile,
  type CarSetup,
  type SpeedProfile,
  type TrackProfile,
  type TrackSample,
} from "./lapPhysics.ts";
import { clampTime } from "./replay.ts";
import { TELEMETRY_WINDOW, type TelemetrySample } from "./telemetry.ts";

export interface PhysicsCarState extends CarState {
  throttle: number; // 0..100 %
  brake: number; // 0..100 %
  lateralG: number;
}
export interface PaceModel {
  track: TrackProfile;
  profile: (setup: CarSetup) => SpeedProfile;
}

// Solving a profile is cheap but runs per car; cache by setup so seeks never re-solve.
export function createPaceModel(track: TrackProfile): PaceModel {
  const cache = new Map<string, SpeedProfile>();
  return {
    track,
    profile(setup) {
      const key = `${setup.powerKw}|${setup.wingLevel}|${setup.fuelKg}|${setup.compound}|${setup.wet}`;
      let profile = cache.get(key);
      if (!profile) {
        profile = solveSpeedProfile(track, setup);
        cache.set(key, profile);
      }
      return profile;
    },
  };
}

// Fictional, deterministic setups that spread the field by roughly two seconds a lap.
export function setupForEntry(index: number, compound: TyreCompound): CarSetup {
  return {
    powerKw: 780 - ((index * 7) % 20) * 3,
    wingLevel: 5 + ((index * 3) % 4),
    fuelKg: 30 + ((index * 11) % 9) * 5,
    compound,
    wet: false,
  };
}

/** Attach a setup to every entry and derive lapSeconds from the physics lap. */
export function withPhysicsSetups(
  definitions: readonly CarDefinition[],
  model: PaceModel,
): CarDefinition[] {
  return definitions.map((definition, index) => {
    const setup = definition.setup ?? setupForEntry(index, definition.compound);
    return {
      ...definition,
      setup,
      lapSeconds: model.profile(setup).lapSeconds / SIMULATION_RATE,
    };
  });
}

function requireSetup(definition: CarDefinition): CarSetup {
  if (!definition.setup)
    throw new RangeError("Car is not configured for physics pace");
  return definition.setup;
}

// initialProgress is treated as a phase of the lap in time, so lap boundaries stay at
// (lap - 1 - initialProgress) × lapTime and lapMarkers / inspector maths remain exact.
export function sampleCar(
  definition: CarDefinition,
  model: PaceModel,
  time: number,
): TrackSample {
  const profile = model.profile(requireSetup(definition));
  return sampleAtTime(
    model.track,
    profile,
    definition.initialProgress * profile.lapSeconds + clampTime(time),
  );
}

export function physicsCarAtTime(
  definition: CarDefinition,
  model: PaceModel,
  time: number,
): PhysicsCarState {
  const sample = sampleCar(definition, model, time);
  return {
    id: definition.id,
    number: definition.number,
    position: 0,
    progress: Math.min(sample.progress, 1 - 1e-12),
    completedLaps: sample.completedLaps,
    speedKph: sample.speed * 3.6,
    compound: definition.compound,
    tyreAge: definition.initialTyreAge + sample.completedLaps,
    throttle: sample.throttle * 100,
    brake: sample.brake * 100,
    lateralG: sample.lateralG,
  };
}

/** Deterministic field at an absolute replay time; no state is integrated between calls. */
export function physicsFieldAtTime(
  definitions: readonly CarDefinition[],
  model: PaceModel,
  time: number,
): PhysicsCarState[] {
  return rankField(
    definitions.map((definition) => physicsCarAtTime(definition, model, time)),
  );
}

export function physicsTelemetryAtTime(
  definition: CarDefinition,
  model: PaceModel,
  time: number,
): TelemetrySample[] {
  const end = clampTime(time);
  const samples: TelemetrySample[] = [];
  const add = (t: number) => {
    const car = physicsCarAtTime(definition, model, t);
    samples.push({
      time: t,
      speed: car.speedKph,
      throttle: car.throttle,
      brake: car.brake,
    });
  };
  for (let t = Math.max(0, end - TELEMETRY_WINDOW); t < end; t += 0.5) add(t);
  add(end);
  return samples;
}
