import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { parseStrategy, defaultAssumptions } from "../src/services/strategy.ts";
const request = {
  driverId: "max_verstappen",
  completedLaps: 30,
  delayedPitLap: 33,
  assumptions: defaultAssumptions,
};
const raw: unknown = JSON.parse(
  execFileSync(
    "python",
    [
      "-c",
      "from backend.strategy import StrategyRequest,compare_strategy; print(compare_strategy(StrategyRequest(driverId='max_verstappen',completedLaps=30,delayedPitLap=33)).model_dump_json())",
    ],
    { encoding: "utf8" },
  ),
);
test("strategy response reconciles plans with the frozen request", () => {
  const data = parseStrategy(raw, request);
  assert.equal(data.plans.length, 3);
  assert.equal(data.plans[0].laps.length, 26);
  assert.equal(data.branchLap, 30);
});
test("stale or altered assumptions cannot be displayed as current results", () => {
  assert.throws(() => parseStrategy(raw, { ...request, completedLaps: 31 }));
  assert.throws(() =>
    parseStrategy(raw, {
      ...request,
      assumptions: { ...defaultAssumptions, pitLoss: 30 },
    }),
  );
});
test("inconsistent totals and winning plan are rejected", () => {
  const data = parseStrategy(raw, request);
  const bad = structuredClone(data);
  bad.plans[0].remainingSeconds += 1;
  assert.throws(() => parseStrategy(bad, request));
  const wrong = structuredClone(data);
  wrong.fastestPlan = "missing";
  assert.throws(() => parseStrategy(wrong, request));
});
