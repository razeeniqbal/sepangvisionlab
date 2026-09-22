import {
  parseStrategy,
  type StrategyRequest,
  type StrategyResult,
} from "./strategy.ts";
export interface Uncertainty {
  paceSd: number;
  degradationSd: number;
  pitSd: number;
  trafficSd: number;
}
export interface MonteCarloRequest {
  strategy: StrategyRequest;
  runs: number;
  seed: number;
  uncertainty: Uncertainty;
}
export interface Distribution {
  mean: number;
  sd: number;
  p10: number;
  p50: number;
  p90: number;
}
export interface MonteCarloPlan {
  id: string;
  label: string;
  remaining: Distribution;
  delta: Distribution;
  fastestShare: number;
  beatsStay: number;
  histogram: { lower: number; upper: number; count: number }[];
}
export interface MonteCarloResult {
  schemaVersion: 1;
  source: "assumption-based-monte-carlo";
  strategy: StrategyResult;
  runs: number;
  seed: number;
  uncertainty: Uncertainty;
  plans: MonteCarloPlan[];
}
const obj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null;
const num = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);
function distribution(v: unknown) {
  return (
    obj(v) &&
    num(v.mean) &&
    num(v.sd) &&
    v.sd >= 0 &&
    num(v.p10) &&
    num(v.p50) &&
    num(v.p90) &&
    v.p10 <= v.p50 &&
    v.p50 <= v.p90
  );
}
export function parseMonteCarlo(
  value: unknown,
  request: MonteCarloRequest,
): MonteCarloResult {
  const bad = () => {
    throw Error("Invalid Monte Carlo response");
  };
  if (
    !obj(value) ||
    value.schemaVersion !== 1 ||
    value.source !== "assumption-based-monte-carlo" ||
    value.runs !== request.runs ||
    value.seed !== request.seed ||
    !obj(value.uncertainty) ||
    !Array.isArray(value.plans)
  )
    return bad();
  const uncertainty = value.uncertainty;
  if (
    Object.entries(request.uncertainty).some(([k, v]) => uncertainty[k] !== v)
  )
    return bad();
  const strategy = parseStrategy(value.strategy, request.strategy);
  if (value.plans.length !== strategy.plans.length) return bad();
  let totalShares = 0;
  for (const [i, p] of value.plans.entries()) {
    if (
      !obj(p) ||
      p.id !== strategy.plans[i].id ||
      p.label !== strategy.plans[i].label ||
      !distribution(p.remaining) ||
      !distribution(p.delta) ||
      !num(p.fastestShare) ||
      p.fastestShare < 0 ||
      p.fastestShare > 1 ||
      !num(p.beatsStay) ||
      p.beatsStay < 0 ||
      p.beatsStay > 1 ||
      !Array.isArray(p.histogram) ||
      p.histogram.length !== 20
    )
      return bad();
    let count = 0;
    let previous: number | null = null;
    for (const b of p.histogram) {
      if (
        !obj(b) ||
        !num(b.lower) ||
        !num(b.upper) ||
        b.upper <= b.lower ||
        !num(b.count) ||
        !Number.isInteger(b.count) ||
        b.count < 0 ||
        (previous !== null && Math.abs(previous - b.lower) > 1e-8)
      )
        return bad();
      count += b.count;
      previous = b.upper;
    }
    if (count !== request.runs) return bad();
    totalShares += p.fastestShare;
  }
  if (Math.abs(totalShares - 1) > 1e-8) return bad();
  return value as unknown as MonteCarloResult;
}
export async function runMonteCarlo(
  request: MonteCarloRequest,
  signal: AbortSignal,
) {
  const r = await fetch("/api/v1/strategy/monte-carlo", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
    signal,
  });
  if (!r.ok) throw Error("Simulation unavailable");
  return parseMonteCarlo(await r.json(), request);
}
