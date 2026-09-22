export interface StintSample {
  lap: number;
  seconds: number;
  included: boolean;
  reason: string;
}
export interface PaceFit {
  method: "median pairwise slopes";
  secondsPerLap: number;
  intercept: number;
  fitMae: number;
  firstLap: number;
  lastLap: number;
  sampleCount: number;
}
export interface Stint {
  number: number;
  startLap: number;
  endLap: number;
  boundary: string;
  compound: null;
  tyreAge: null;
  samples: StintSample[];
  fit: PaceFit | null;
}
export interface StintAnalysis {
  schemaVersion: 1;
  sessionId: "malaysia-2017";
  source: "historical-lap-timing";
  driverId: string;
  completedLaps: number;
  minSamples: number;
  stints: Stint[];
  limitation: string;
}
const obj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null;
const finite = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);
const integer = (v: unknown): v is number => finite(v) && Number.isInteger(v);
export function parseStints(
  value: unknown,
  driverId: string,
  completed: number,
): StintAnalysis {
  const bad = () => {
    throw Error("Invalid stint analysis");
  };
  if (
    !obj(value) ||
    value.schemaVersion !== 1 ||
    value.sessionId !== "malaysia-2017" ||
    value.source !== "historical-lap-timing" ||
    value.driverId !== driverId ||
    value.completedLaps !== completed ||
    value.minSamples !== 5 ||
    !Array.isArray(value.stints) ||
    typeof value.limitation !== "string"
  )
    return bad();
  let previous = 0;
  for (const [i, s] of value.stints.entries()) {
    if (
      !obj(s) ||
      s.number !== i + 1 ||
      !integer(s.startLap) ||
      s.startLap !== previous + 1 ||
      !integer(s.endLap) ||
      s.endLap < s.startLap - 1 ||
      s.endLap > completed ||
      !Array.isArray(s.samples) ||
      s.samples.length !== Math.max(0, s.endLap - s.startLap + 1) ||
      s.compound !== null ||
      s.tyreAge !== null ||
      !["race start", "recorded pit stop"].includes(String(s.boundary))
    )
      return bad();
    previous = s.endLap;
    for (const [j, row] of s.samples.entries())
      if (
        !obj(row) ||
        row.lap !== s.startLap + j ||
        !finite(row.seconds) ||
        row.seconds <= 0 ||
        typeof row.included !== "boolean" ||
        !["included", "opening lap", "pit lap", "lap after pit"].includes(
          String(row.reason),
        ) ||
        row.included !== (row.reason === "included")
      )
        return bad();
    const kept = s.samples.filter((row) => row.included);
    if (s.fit === null) {
      if (kept.length >= 5) return bad();
    } else {
      const f = s.fit;
      if (
        !obj(f) ||
        f.method !== "median pairwise slopes" ||
        !finite(f.secondsPerLap) ||
        !finite(f.intercept) ||
        !finite(f.fitMae) ||
        f.fitMae < 0 ||
        f.sampleCount !== kept.length ||
        kept.length < 5 ||
        f.firstLap !== kept[0].lap ||
        f.lastLap !== kept.at(-1).lap
      )
        return bad();
    }
  }
  return value as unknown as StintAnalysis;
}
export async function loadStints(
  driverId: string,
  completed: number,
  signal: AbortSignal,
) {
  const response = await fetch(
    `/api/v1/analysis/stints?driver_id=${encodeURIComponent(driverId)}&completed_laps=${completed}`,
    { signal },
  );
  if (!response.ok) throw Error("Stint analysis unavailable");
  return parseStints(await response.json(), driverId, completed);
}
