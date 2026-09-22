import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { parseMonteCarlo } from "../src/services/monteCarlo.ts";
import { defaultAssumptions } from "../src/services/strategy.ts";
const request = {
  strategy: {
    driverId: "max_verstappen",
    completedLaps: 30,
    delayedPitLap: 33,
    assumptions: defaultAssumptions,
  },
  runs: 1000,
  seed: 42,
  uncertainty: { paceSd: 0.5, degradationSd: 0.02, pitSd: 2, trafficSd: 0.2 },
};
const raw: unknown = JSON.parse(
  execFileSync(
    "python",
    [
      "-c",
      "from backend.monte_carlo import MonteCarloRequest,simulate; from backend.strategy import StrategyRequest; print(simulate(MonteCarloRequest(strategy=StrategyRequest(driverId='max_verstappen',completedLaps=30,delayedPitLap=33),runs=1000)).model_dump_json())",
    ],
    { encoding: "utf8" },
  ),
);
test("Monte Carlo contract contains complete normalized distributions", () => {
  const data = parseMonteCarlo(raw, request);
  assert.equal(data.plans.length, 3);
  assert.equal(
    data.plans[0].histogram.reduce((n, b) => n + b.count, 0),
    1000,
  );
});
test("changed seed, branch or uncertainty rejects stale responses", () => {
  assert.throws(() => parseMonteCarlo(raw, { ...request, seed: 43 }));
  assert.throws(() =>
    parseMonteCarlo(raw, {
      ...request,
      strategy: { ...request.strategy, completedLaps: 31 },
    }),
  );
  assert.throws(() =>
    parseMonteCarlo(raw, {
      ...request,
      uncertainty: { ...request.uncertainty, paceSd: 2 },
    }),
  );
});
test("invalid histogram counts, quantiles and probabilities are rejected", () => {
  const data = parseMonteCarlo(raw, request);
  const bins = structuredClone(data);
  bins.plans[0].histogram[0].count++;
  assert.throws(() => parseMonteCarlo(bins, request));
  const q = structuredClone(data);
  q.plans[0].remaining.p10 = q.plans[0].remaining.p90 + 1;
  assert.throws(() => parseMonteCarlo(q, request));
  const shares = structuredClone(data);
  shares.plans.forEach((p) => (p.fastestShare = 0));
  assert.throws(() => parseMonteCarlo(shares, request));
});
