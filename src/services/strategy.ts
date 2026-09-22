export interface StrategyAssumptions {
  currentDegradation: number;
  freshDegradation: number;
  freshPaceDelta: number;
  pitLoss: number;
  trafficPenalty: number;
  compound: "SOFT" | "MEDIUM" | "HARD";
  weather: "dry" | "custom";
  weatherPenalty: number;
}
export const defaultAssumptions: StrategyAssumptions = {
  currentDegradation: 0.05,
  freshDegradation: 0.05,
  freshPaceDelta: 0,
  pitLoss: 22,
  trafficPenalty: 0,
  compound: "HARD",
  weather: "dry",
  weatherPenalty: 0,
};
export interface StrategyRequest {
  driverId: string;
  completedLaps: number;
  delayedPitLap: number | null;
  assumptions: StrategyAssumptions;
}
export interface StrategyPlan {
  id: "stay" | "now" | "later";
  label: string;
  pitLap: number | null;
  compound: string;
  remainingSeconds: number;
  finishTime: number;
  deltaToStay: number;
  laps: { lap: number; seconds: number; cumulative: number; pit: boolean }[];
}
export interface StrategyResult {
  schemaVersion: 1;
  source: "assumption-based-simulation";
  driverId: string;
  driverName: string;
  branchLap: number;
  branchTime: number;
  finishLap: number;
  baselineSeconds: number;
  baselineLaps: number[];
  assumptions: StrategyAssumptions;
  plans: StrategyPlan[];
  fastestPlan: string;
}
const obj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null;
const finite = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);
export function parseStrategy(
  value: unknown,
  request: StrategyRequest,
): StrategyResult {
  const bad = () => {
    throw Error("Invalid strategy response");
  };
  if (
    !obj(value) ||
    value.schemaVersion !== 1 ||
    value.source !== "assumption-based-simulation" ||
    value.driverId !== request.driverId ||
    value.branchLap !== request.completedLaps ||
    value.finishLap !== 56 ||
    typeof value.driverName !== "string" ||
    !finite(value.branchTime) ||
    !finite(value.baselineSeconds) ||
    value.baselineSeconds <= 0 ||
    !Array.isArray(value.baselineLaps) ||
    value.baselineLaps.length !== 3 ||
    !value.baselineLaps.every(
      (l) => finite(l) && l > 1 && l <= request.completedLaps,
    ) ||
    !obj(value.assumptions) ||
    !Array.isArray(value.plans) ||
    value.plans.length !== (request.delayedPitLap === null ? 2 : 3)
  )
    return bad();
  const returnedAssumptions = value.assumptions;
  if (
    Object.entries(request.assumptions).some(
      ([k, v]) => returnedAssumptions[k] !== v,
    )
  )
    return bad();
  const ids = ["stay", "now", "later"];
  for (const [i, plan] of value.plans.entries()) {
    if (
      !obj(plan) ||
      plan.id !== ids[i] ||
      typeof plan.label !== "string" ||
      typeof plan.compound !== "string" ||
      plan.pitLap !== [null, request.completedLaps, request.delayedPitLap][i] ||
      !finite(plan.remainingSeconds) ||
      plan.remainingSeconds <= 0 ||
      !finite(plan.finishTime) ||
      !finite(plan.deltaToStay) ||
      !Array.isArray(plan.laps) ||
      plan.laps.length !== 56 - request.completedLaps
    )
      return bad();
    let cumulative = 0;
    for (const [j, l] of plan.laps.entries()) {
      if (
        !obj(l) ||
        l.lap !== request.completedLaps + j + 1 ||
        !finite(l.seconds) ||
        l.seconds <= 0 ||
        !finite(l.cumulative) ||
        typeof l.pit !== "boolean"
      )
        return bad();
      cumulative += l.seconds;
      if (Math.abs(cumulative - l.cumulative) > 1e-6) return bad();
    }
    if (
      Math.abs(cumulative - plan.remainingSeconds) > 1e-6 ||
      Math.abs(value.branchTime + plan.remainingSeconds - plan.finishTime) >
        1e-6
    )
      return bad();
  }
  const plans = value.plans as StrategyPlan[];
  const stay = plans[0].remainingSeconds;
  if (
    plans.some(
      (plan) =>
        Math.abs(plan.remainingSeconds - stay - plan.deltaToStay) > 1e-6,
    ) ||
    !plans.some(
      (plan) =>
        plan.id === value.fastestPlan &&
        plan.remainingSeconds ===
          Math.min(...plans.map((p) => p.remainingSeconds)),
    )
  )
    return bad();
  return value as unknown as StrategyResult;
}
export async function compareStrategy(
  request: StrategyRequest,
  signal: AbortSignal,
) {
  const response = await fetch("/api/v1/strategy/compare", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
    signal,
  });
  if (!response.ok)
    throw Error(
      "The comparison could not be calculated. Check the assumptions and branch lap, then retry.",
    );
  return parseStrategy(await response.json(), request);
}
