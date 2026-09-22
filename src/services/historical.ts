import type { CarDefinition, CarState } from "../domain/field.ts";
export interface HistoricalLap {
  lap: number;
  position: number;
  seconds: number;
  endTime: number;
}
export interface HistoricalDriver {
  id: string;
  number: string;
  name: string;
  team: string;
  teamId: string;
  grid: number;
  classification: number;
  laps: number;
  status: string;
  timing: HistoricalLap[];
  pits: { lap: number; stop: number; duration: number }[];
}
export interface HistoricalReplay {
  schemaVersion: 2;
  source: "historical-lap-timing";
  sessionId: "malaysia-2017";
  title: string;
  date: string;
  circuitId: "sepang";
  duration: number;
  drivers: HistoricalDriver[];
  sourceUrl: string;
  movementQuality: string;
}
const obj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null;
const num = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);
export function parseHistorical(v: unknown): HistoricalReplay {
  const bad = () => {
    throw new Error("Invalid historical session");
  };
  if (
    !obj(v) ||
    v.schemaVersion !== 2 ||
    v.source !== "historical-lap-timing" ||
    v.sessionId !== "malaysia-2017" ||
    v.circuitId !== "sepang" ||
    !num(v.duration) ||
    v.duration <= 0 ||
    v.duration > 20000 ||
    typeof v.title !== "string" ||
    typeof v.date !== "string" ||
    typeof v.movementQuality !== "string" ||
    typeof v.sourceUrl !== "string" ||
    !Array.isArray(v.drivers) ||
    v.drivers.length !== 20
  )
    return bad();
  const ids = new Set<string>();
  for (const d of v.drivers) {
    if (
      !obj(d) ||
      typeof d.id !== "string" ||
      ids.has(d.id) ||
      typeof d.number !== "string" ||
      typeof d.name !== "string" ||
      typeof d.team !== "string" ||
      typeof d.teamId !== "string" ||
      typeof d.status !== "string" ||
      !num(d.grid) ||
      !num(d.classification) ||
      !num(d.laps) ||
      !Array.isArray(d.timing) ||
      d.timing.length !== d.laps ||
      !Array.isArray(d.pits)
    )
      return bad();
    ids.add(d.id);
    let previous = 0;
    for (const [i, l] of d.timing.entries()) {
      if (
        !obj(l) ||
        l.lap !== i + 1 ||
        !num(l.position) ||
        l.position < 1 ||
        l.position > 20 ||
        !num(l.seconds) ||
        l.seconds <= 0 ||
        !num(l.endTime) ||
        Math.abs(l.endTime - previous - l.seconds) > 0.002 ||
        l.endTime > v.duration
      )
        return bad();
      previous = l.endTime;
    }
    for (const pit of d.pits)
      if (
        !obj(pit) ||
        !num(pit.lap) ||
        pit.lap < 1 ||
        pit.lap > d.laps ||
        !num(pit.stop) ||
        !num(pit.duration) ||
        pit.duration < 0
      )
        return bad();
  }
  return v as unknown as HistoricalReplay;
}
export function historicalState(driver: HistoricalDriver, time: number) {
  const done = driver.timing.filter((lap) => lap.endTime <= time + 1e-9);
  const next = driver.timing[done.length];
  const last = done.at(-1);
  const active = Boolean(next);
  const progress = next
    ? Math.max(
        0,
        Math.min(0.999999999, (time - (last?.endTime ?? 0)) / next.seconds),
      )
    : 0;
  return {
    completedLaps: done.length,
    progress,
    active,
    lastLap: last?.seconds ?? null,
    recordedPosition: last?.position ?? null,
    lapAverageKph: next ? (5543 / next.seconds) * 3.6 : null,
    status:
      driver.laps === 0
        ? "Did not start"
        : active
          ? "Reconstructed"
          : driver.status === "Finished" || driver.status.startsWith("+")
            ? "Finished"
            : "Timing ended",
  };
}
const colors: Record<string, string> = {
  mercedes: "#00a19c",
  ferrari: "#e45050",
  red_bull: "#647fba",
  force_india: "#e6a3c4",
  williams: "#b5d5ed",
  mclaren: "#f6a24f",
  toro_rosso: "#729ef2",
  renault: "#e6d75b",
  haas: "#c6cace",
  sauber: "#a9cddd",
};
// These internal fields adapt only geometry markers. Tyres/pedals never appear as historical measurements.
export function markerEntries(data: HistoricalReplay): CarDefinition[] {
  return data.drivers.map((d) => ({
    id: d.id,
    number: d.number,
    color: colors[d.teamId] ?? "#aebcbc",
    initialProgress: 0,
    lapSeconds: 20,
    compound: "MEDIUM",
    initialTyreAge: 0,
  }));
}
export function markerStates(data: HistoricalReplay, time: number): CarState[] {
  return data.drivers.map((d) => {
    const s = historicalState(d, time);
    return {
      id: d.id,
      number: d.number,
      position: s.recordedPosition ?? d.grid,
      completedLaps: s.completedLaps,
      progress: s.progress,
      speedKph: s.lapAverageKph ?? 0,
      compound: "MEDIUM",
      tyreAge: 0,
    };
  });
}
export function historicalTime(time: number) {
  const s = Math.floor(time);
  return `${Math.floor(s / 3600)
    .toString()
    .padStart(2, "0")}:${Math.floor((s % 3600) / 60)
    .toString()
    .padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;
}
