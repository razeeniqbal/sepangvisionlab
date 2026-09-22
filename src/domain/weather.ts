/** Hypothetical lap-boundary weather model, independent of historical weather. */
export const weatherStates = ["dry", "lightRain", "wet", "drying"] as const;
export const weatherTyres = ["slick", "intermediate", "wet"] as const;
export type WeatherState = (typeof weatherStates)[number];
export type WeatherTyre = (typeof weatherTyres)[number];
export const weatherLabels: Record<WeatherState, string> = {
  dry: "Dry",
  lightRain: "Light rain",
  wet: "Wet",
  drying: "Drying",
};
export interface WeatherAnchor {
  branchLap: number;
  finishLap: number;
  baselineSeconds: number;
  branchTime: number;
}
export interface WeatherConfig {
  lightRainLap: number;
  wetLap: number;
  dryingLap: number;
  delay: number;
  pitLoss: number;
  degradation: number;
  penalties: Record<WeatherState, Record<WeatherTyre, number>>;
}
export interface WeatherLap {
  lap: number;
  state: WeatherState;
  tyre: WeatherTyre;
  age: number;
  pit: boolean;
  penalty: number;
  seconds: number;
  cumulative: number;
}
export interface WeatherPlan {
  id: string;
  label: string;
  stops: { beforeLap: number; tyre: WeatherTyre }[];
  laps: WeatherLap[];
  remaining: number;
  finishTime: number;
  delta: number;
}
export interface WeatherResult {
  config: WeatherConfig;
  plans: WeatherPlan[];
  fastest: string[];
}
export function defaultWeather(
  anchor: WeatherAnchor,
  pitLoss = 22,
): WeatherConfig {
  const span = anchor.finishLap - anchor.branchLap;
  return {
    lightRainLap: anchor.branchLap + Math.max(2, Math.floor(span / 4)),
    wetLap: anchor.branchLap + Math.max(3, Math.floor(span / 2)),
    dryingLap: anchor.branchLap + Math.max(4, Math.floor((3 * span) / 4)),
    delay: 1,
    pitLoss,
    degradation: 0.05,
    penalties: {
      dry: { slick: 0, intermediate: 8, wet: 15 },
      lightRain: { slick: 12, intermediate: 2, wet: 6 },
      wet: { slick: 35, intermediate: 12, wet: 3 },
      drying: { slick: 4, intermediate: 6, wet: 12 },
    },
  };
}
export function validateWeather(
  a: WeatherAnchor,
  c: WeatherConfig,
): string | null {
  if (
    !Number.isInteger(a.branchLap) ||
    a.branchLap < 1 ||
    a.finishLap !== 56 ||
    a.branchLap > 52 ||
    !Number.isFinite(a.baselineSeconds) ||
    a.baselineSeconds <= 0 ||
    !Number.isFinite(a.branchTime) ||
    a.branchTime < 0
  )
    return "Weather scenarios need a valid branch with at least four laps remaining.";
  if (
    ![c.lightRainLap, c.wetLap, c.dryingLap, c.delay].every(Number.isInteger) ||
    c.lightRainLap < a.branchLap + 2 ||
    c.wetLap <= c.lightRainLap ||
    c.dryingLap <= c.wetLap ||
    c.dryingLap > a.finishLap
  )
    return "Use whole laps in this order: one dry lap, light rain, wet, then drying by lap 56.";
  if (c.delay < 1 || c.lightRainLap + c.delay >= c.dryingLap)
    return "Delayed switching must happen after light rain starts and before drying starts.";
  if (
    !Number.isFinite(c.pitLoss) ||
    c.pitLoss < 0 ||
    c.pitLoss > 120 ||
    !Number.isFinite(c.degradation) ||
    c.degradation < 0 ||
    c.degradation > 2
  )
    return "Pit loss must be 0–120 seconds and pace loss 0–2 seconds per lap.";
  if (
    weatherStates.some((s) =>
      weatherTyres.some(
        (t) =>
          !Number.isFinite(c.penalties[s][t]) ||
          c.penalties[s][t] < 0 ||
          c.penalties[s][t] > 120,
      ),
    )
  )
    return "Every weather penalty must be between 0 and 120 seconds.";
  return null;
}
export function weatherAt(lap: number, c: WeatherConfig): WeatherState {
  return lap >= c.dryingLap
    ? "drying"
    : lap >= c.wetLap
      ? "wet"
      : lap >= c.lightRainLap
        ? "lightRain"
        : "dry";
}
export function simulateWeather(
  anchor: WeatherAnchor,
  config: WeatherConfig,
): WeatherResult {
  const error = validateWeather(anchor, config);
  if (error) throw Error(error);
  const c = structuredClone(config);
  const candidates: {
    id: string;
    label: string;
    stops: WeatherPlan["stops"];
  }[] = [{ id: "slick", label: "Stay on slicks", stops: [] }];
  for (const tyre of ["intermediate", "wet"] as const) {
    for (const timing of ["early", "delayed"] as const) {
      candidates.push({
        id: `${tyre}-${timing}`,
        label: `${timing === "early" ? "Early" : "Delayed"} ${tyre === "wet" ? "wets" : "intermediates"}`,
        stops: [
          {
            beforeLap: c.lightRainLap + (timing === "delayed" ? c.delay : 0),
            tyre,
          },
          { beforeLap: c.dryingLap, tyre: "slick" },
        ],
      });
    }
  }
  const plans = candidates.map((candidate) => {
    let tyre: WeatherTyre = "slick",
      age = 0,
      total = 0;
    const laps: WeatherLap[] = [];
    for (let lap = anchor.branchLap + 1; lap <= anchor.finishLap; lap++) {
      const stop = candidate.stops.find((s) => s.beforeLap === lap);
      if (stop) {
        tyre = stop.tyre;
        age = 0;
      }
      const state = weatherAt(lap, c),
        penalty = c.penalties[state][tyre];
      const seconds =
        anchor.baselineSeconds +
        c.degradation * age +
        penalty +
        (stop ? c.pitLoss : 0);
      total += seconds;
      laps.push({
        lap,
        state,
        tyre,
        age,
        pit: !!stop,
        penalty,
        seconds,
        cumulative: total,
      });
      age++;
    }
    return {
      ...candidate,
      laps,
      remaining: total,
      finishTime: anchor.branchTime + total,
      delta: 0,
    };
  });
  for (const p of plans) p.delta = p.remaining - plans[0].remaining;
  const best = Math.min(...plans.map((p) => p.remaining));
  return {
    config: c,
    plans,
    fastest: plans
      .filter((p) => Math.abs(p.remaining - best) < 1e-8)
      .map((p) => p.id),
  };
}
