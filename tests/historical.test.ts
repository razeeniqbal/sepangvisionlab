import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  parseHistorical,
  historicalState,
} from "../src/services/historical.ts";
import { advanceReplay, clampTime } from "../src/domain/replay.ts";
const raw: unknown = JSON.parse(
  execFileSync(
    "python",
    [
      "-c",
      "from backend.historical import historical_replay; print(historical_replay().model_dump_json())",
    ],
    { encoding: "utf8", maxBuffer: 2000000 },
  ),
);
const data = parseHistorical(raw);
const max = data.drivers.find((d) => d.id === "max_verstappen")!;
test("historical lap boundaries and fractional reconstruction match source timing", () => {
  const first = max.timing[0];
  assert.ok(
    Math.abs(historicalState(max, first.endTime / 2).progress - 0.5) < 1e-10,
  );
  assert.equal(historicalState(max, first.endTime).completedLaps, 1);
  assert.equal(historicalState(max, first.endTime).progress, 0);
  assert.equal(historicalState(max, first.endTime).lastLap, first.seconds);
  assert.equal(historicalState(max, 0).recordedPosition, null);
});
test("DNS and ended coverage never become circulating cars", () => {
  const kimi = data.drivers.find((d) => d.id === "raikkonen")!;
  const sainz = data.drivers.find((d) => d.id === "sainz")!;
  assert.equal(historicalState(kimi, 0).active, false);
  assert.equal(historicalState(kimi, 500).status, "Did not start");
  const end = sainz.timing.at(-1)!.endTime;
  assert.equal(historicalState(sainz, end).active, false);
  assert.equal(historicalState(sainz, end + 1000).completedLaps, 29);
  assert.equal(historicalState(sainz, end + 1000).lapAverageKph, null);
  assert.equal(historicalState(max, data.duration).status, "Finished");
});
test("historical playback supports a full race and backward seeks", () => {
  assert.equal(advanceReplay(590, 10, 5, data.duration), 640);
  assert.equal(clampTime(data.duration + 10, data.duration), data.duration);
  assert.equal(historicalState(max, 0).completedLaps, 0);
});
test("historical validation rejects missing and inconsistent lap records", () => {
  assert.throws(() => parseHistorical({ ...data, source: "synthetic" }));
  const broken = structuredClone(data);
  broken.drivers[0].timing[0].endTime += 10;
  assert.throws(() => parseHistorical(broken));
  const missing = structuredClone(data);
  missing.drivers[0].timing.pop();
  assert.throws(() => parseHistorical(missing));
});
