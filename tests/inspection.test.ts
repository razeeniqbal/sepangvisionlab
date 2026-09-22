import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createField,
  advanceField,
  type CarDefinition,
} from "../src/domain/field.ts";
import {
  estimatedGap,
  lastFullLapSeconds,
  formatLap,
} from "../src/domain/inspection.ts";
const defs: CarDefinition[] = [
  {
    id: "a",
    number: "07",
    color: "#00a19c",
    initialProgress: 0,
    lapSeconds: 24,
    compound: "MEDIUM",
    initialTyreAge: 0,
  },
  {
    id: "b",
    number: "88",
    color: "#ffaa00",
    initialProgress: 0.5,
    lapSeconds: 24,
    compound: "SOFT",
    initialTyreAge: 2,
  },
];
test("estimated gap uses cumulative progress including full laps", () => {
  const [a, b] = createField(defs);
  assert.equal(estimatedGap(a, b, defs[1]), 60);
  assert.equal(estimatedGap(b, b, defs[1]), 0);
  assert.equal(estimatedGap(a, { ...b, completedLaps: 1 }, defs[1]), 180);
});
test("a partial starting lap is not presented as a full lap", () => {
  const afterPartial = advanceField(createField(defs), defs, 12);
  assert.equal(lastFullLapSeconds(afterPartial[1], defs[1]), null);
  const afterFull = advanceField(createField(defs), defs, 36);
  assert.equal(lastFullLapSeconds(afterFull[1], defs[1]), 120);
});
test("car starting on finish line records its first complete lap", () => {
  assert.equal(lastFullLapSeconds(createField(defs)[0], defs[0]), null);
  assert.equal(
    lastFullLapSeconds(advanceField(createField(defs), defs, 24)[0], defs[0]),
    120,
  );
});
test("lap formatting handles no lap and minute rollover", () => {
  assert.equal(formatLap(null), "—");
  assert.equal(formatLap(119.9999), "2:00.000");
  assert.equal(formatLap(123.456), "2:03.456");
});
