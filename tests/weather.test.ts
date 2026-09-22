import { test } from "node:test";
import assert from "node:assert/strict";
import {
  defaultWeather,
  simulateWeather,
  validateWeather,
  weatherAt,
  weatherStates,
  weatherTyres,
} from "../src/domain/weather.ts";
const anchor = {
  branchLap: 30,
  finishLap: 56,
  baselineSeconds: 95,
  branchTime: 2900,
};
test("weather changes exactly on specified first laps", () => {
  const c = defaultWeather(anchor);
  for (const [lap, state] of [
    [c.lightRainLap - 1, "dry"],
    [c.lightRainLap, "lightRain"],
    [c.wetLap, "wet"],
    [c.dryingLap, "drying"],
  ] as const)
    assert.equal(weatherAt(lap, c), state);
});
test("switches charge two stops, reset wear and use the correct tyre at each boundary", () => {
  const c = defaultWeather(anchor),
    r = simulateWeather(anchor, c);
  assert.equal(r.plans.length, 5);
  for (const p of r.plans.slice(1)) {
    assert.equal(p.laps.filter((l) => l.pit).length, 2);
    for (const stop of p.stops) {
      const l = p.laps.find((l) => l.lap === stop.beforeLap)!;
      assert.equal(l.age, 0);
      assert.equal(l.tyre, stop.tyre);
      assert.equal(
        l.seconds,
        anchor.baselineSeconds + c.penalties[l.state][l.tyre] + c.pitLoss,
      );
    }
    assert.equal(p.laps.at(-1)!.tyre, "slick");
  }
  assert.equal(r.plans[1].stops[0].beforeLap, c.lightRainLap);
  assert.equal(r.plans[2].stops[0].beforeLap, c.lightRainLap + c.delay);
});
test("zero penalties and wear leave exactly two pit losses versus staying out", () => {
  const c = defaultWeather(anchor);
  c.degradation = 0;
  for (const s of weatherStates)
    for (const t of weatherTyres) c.penalties[s][t] = 0;
  const r = simulateWeather(anchor, c);
  assert.equal(r.plans[0].remaining, 26 * 95);
  for (const p of r.plans.slice(1)) assert.equal(p.delta, 2 * c.pitLoss);
  c.pitLoss = 0;
  assert.equal(simulateWeather(anchor, c).fastest.length, 5);
});
test("totals reconcile and results are immutable snapshots of configuration", () => {
  const c = defaultWeather(anchor),
    r = simulateWeather(anchor, c);
  for (const p of r.plans) {
    assert.equal(
      p.remaining,
      p.laps.reduce((n, l) => n + l.seconds, 0),
    );
    assert.equal(p.finishTime, anchor.branchTime + p.remaining);
    assert.equal(p.delta, p.remaining - r.plans[0].remaining);
  }
  c.penalties.wet.slick = 100;
  assert.equal(r.config.penalties.wet.slick, 35);
  assert.deepEqual(simulateWeather(anchor, defaultWeather(anchor)), r);
});
test("wet tyre becomes cheaper with a large slick wet penalty and low stop cost", () => {
  const c = defaultWeather(anchor);
  c.pitLoss = 0;
  c.degradation = 0;
  const r = simulateWeather(anchor, c);
  assert.ok(r.plans.find((p) => p.id === "wet-early")!.delta < 0);
  const delayed = r.plans.find((p) => p.id === "wet-delayed")!,
    early = r.plans.find((p) => p.id === "wet-early")!;
  assert.equal(
    delayed.remaining - early.remaining,
    c.penalties.lightRain.slick - c.penalties.lightRain.wet,
  );
});
test("invalid timelines, nonfinite costs and ambiguous delayed stops are rejected", () => {
  const c = defaultWeather(anchor);
  for (const bad of [
    { ...c, wetLap: c.lightRainLap },
    { ...c, dryingLap: 57 },
    { ...c, delay: 0 },
    { ...c, delay: c.dryingLap - c.lightRainLap },
    { ...c, pitLoss: NaN },
    { ...c, degradation: Infinity },
    { ...c, lightRainLap: 30.5 },
  ])
    assert.throws(() => simulateWeather(anchor, bad));
  c.penalties.wet.slick = -1;
  assert.throws(() => simulateWeather(anchor, c));
});
test("four-lap branch works while shorter timelines are explicitly unavailable", () => {
  const a = { ...anchor, branchLap: 52 };
  assert.equal(validateWeather(a, defaultWeather(a)), null);
  assert.equal(simulateWeather(a, defaultWeather(a)).plans[0].laps.length, 4);
  const b = { ...anchor, branchLap: 53 };
  assert.throws(() => simulateWeather(b, defaultWeather(b)));
});
