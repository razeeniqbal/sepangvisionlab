import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ENGINEER_SYSTEM,
  PRESETS,
  buildBrief,
  engineerMessage,
  matchPreset,
  presetAnswer,
  type BriefCar,
  type BriefInput,
} from "../src/domain/engineer.ts";

const car = (number: string, position: number, extra: Partial<BriefCar> = {}): BriefCar => ({
  number,
  position,
  lap: 12,
  compound: "MEDIUM",
  tyreAge: 9,
  bestLap: 100 + position / 10,
  lastLap: 101,
  gapText: position === 1 ? null : "+" + (position * 1.1).toFixed(3),
  intervalText: position === 1 ? null : "+1.100",
  inPit: false,
  present: true,
  stale: false,
  ...extra,
});
const codes: Record<string, string> = { "1": "AAA", "2": "BBB", "3": "CCC" };
const input = (extra: Partial<BriefInput> = {}): BriefInput => ({
  sessionName: "Race",
  race: true,
  time: 60_000,
  clock: "0:01:00",
  totalLaps: 56,
  cars: [car("3", 3), car("1", 1), car("2", 2, { intervalText: "+0.842" })],
  followed: "2",
  identity: (n) => ({ code: codes[n], name: "Driver " + n, team: "Team" }),
  pit: [
    { d: 2, t: 10_000, lap: 5, lane: 22, stop: 2.5 },
    { d: 2, t: 90_000, lap: 20, lane: 22, stop: 2.4 },
  ],
  raceControl: [
    { t: 30_000, lap: 3, category: "Flag", flag: "YELLOW", scope: "Sector", sector: 4, d: null, message: "YELLOW IN TRACK SECTOR 4" },
    { t: 120_000, lap: 25, category: "Flag", flag: null, scope: null, sector: null, d: null, message: "LATER" },
  ],
  weather: { t: 0, air: 31.4, track: 44.2, rain: 0, humidity: 70, wind: 1 },
  trackStatus: "GREEN",
  ...extra,
});

test("the brief holds the followed car, its neighbours and only data up to now", () => {
  const b = buildBrief(input());
  assert.equal(b.driver.code, "BBB");
  assert.equal(b.position, 2);
  assert.deepEqual(b.ahead, { code: "AAA", delta: "+0.842" });
  assert.deepEqual(b.behind, { code: "CCC", delta: "+1.100" });
  assert.equal(b.pitStops, 1, "the stop after the replay time is not counted");
  assert.deepEqual(b.raceControl, ["YELLOW IN TRACK SECTOR 4"]);
  assert.equal(b.sessionBest?.code, "AAA");
  assert.ok(Math.abs(b.offBest! - 0.1) < 1e-9);
});

test("practice neighbours compare best laps; unknown tyres stay unknown", () => {
  const b = buildBrief(input({ race: false, cars: [car("1", 1), car("2", 2, { compound: "UNKNOWN" }), car("3", 3)] }));
  assert.equal(b.ahead?.delta, "-0.100");
  assert.equal(b.behind?.delta, "+0.100");
  assert.equal(b.tyre.compound, "?");
  assert.match(presetAnswer("tyres", b), /can't confirm/i);
  assert.equal(presetAnswer("gaps", b), "P2 on best laps. AAA ahead on the sheet, 0.100 quicker. CCC behind, 0.100 slower.");
});

test("preset answers say only what the data says", () => {
  const b = buildBrief(input());
  assert.equal(presetAnswer("gaps", b), "P2. AAA ahead, +0.842. CCC behind, +1.100.");
  assert.equal(presetAnswer("tyres", b), "You're on mediums, 9 laps old. 1 stop so far.");
  assert.match(presetAnswer("pace", b), /\+0\.100 to AAA/);
  assert.match(presetAnswer("track", b), /green.*Yellow in track sector 4\./i);
  assert.match(presetAnswer("weather", b), /No rain.*air 31, track 44/);
  assert.equal(presetAnswer("summary", b), "Lap 12 of 56, P2, +2.200 to the leader.");
  const lost = buildBrief(input({ cars: [car("1", 1), car("2", 2, { stale: true })] }));
  assert.match(presetAnswer("gaps", lost), /lost your data/);
  for (const p of PRESETS) assert.ok(presetAnswer(p.id, b).length > 0);
});

test("typed questions map to presets when there is no key", () => {
  assert.equal(matchPreset("how are my tyres holding up"), "tyres");
  assert.equal(matchPreset("What's the gap to the car in front?"), "gaps");
  assert.equal(matchPreset("is it going to rain"), "weather");
  assert.equal(matchPreset("any yellow flags?"), "track");
  assert.equal(matchPreset("tell me a joke"), null);
});

test("each question is sent alone, with the brief and the rules", () => {
  const m = engineerMessage(buildBrief(input()), "  gap?  ");
  assert.match(m, /^Data brief:\n\{.*\}\n\nDriver: gap\?$/s);
  assert.match(ENGINEER_SYSTEM, /Use only the brief/);
});
