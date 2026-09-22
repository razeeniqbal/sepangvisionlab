import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { parseStints } from "../src/services/stints.ts";
const raw: unknown = JSON.parse(
  execFileSync(
    "python",
    [
      "-c",
      "from backend.stint_analysis import stint_analysis; print(stint_analysis('max_verstappen',33).model_dump_json())",
    ],
    { encoding: "utf8" },
  ),
);
test("stint contract retains completed-lap coverage and explicit unknown tyre data", () => {
  const report = parseStints(raw, "max_verstappen", 33);
  assert.equal(report.stints.length, 2);
  assert.equal(report.stints[1].fit!.sampleCount, 5);
  assert.equal(report.stints[1].compound, null);
  assert.equal(report.stints[1].tyreAge, null);
  assert.ok(report.stints.flatMap((s) => s.samples).every((s) => s.lap <= 33));
});
test("stale driver/cursor responses and invented tyre data are rejected", () => {
  assert.throws(() => parseStints(raw, "hamilton", 33));
  assert.throws(() => parseStints(raw, "max_verstappen", 10));
  const bad = structuredClone(raw) as { stints: { compound: unknown }[] };
  bad.stints[0].compound = "MEDIUM";
  assert.throws(() => parseStints(bad, "max_verstappen", 33));
});
test("missing samples or inconsistent fit counts are rejected", () => {
  const report = parseStints(raw, "max_verstappen", 33);
  const missing = structuredClone(report);
  missing.stints[0].samples.pop();
  assert.throws(() => parseStints(missing, "max_verstappen", 33));
  const count = structuredClone(report);
  count.stints[1].fit!.sampleCount = 3;
  assert.throws(() => parseStints(count, "max_verstappen", 33));
});
