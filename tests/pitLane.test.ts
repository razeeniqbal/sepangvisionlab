import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PIT_SEPARATION, pitLaneFromBins, pitOffsetAt, type PitLane } from "../src/domain/pitLane.ts";
import { ON_TRACK_METRES } from "../src/domain/recordedSession.ts";

const lane = JSON.parse(
  readFileSync(new URL("../src/data/circuits/sepangPitLane.json", import.meta.url), "utf8"),
) as PitLane & { accuracyClass: string };

test("pit lane is found as the longest run beyond the track, wrapping past the line", () => {
  const n = 40;
  const bins = Array.from({ length: n }, (_, k) =>
    k >= 34 || k <= 4 ? [-12, -12.4, -12.2, -12.1] : k === 33 || k === 5 ? [-7, -7.5, -7.2, -7.1] : [1, -1, 0.5, 0],
  );
  const found = pitLaneFromBins(bins)!;
  assert.equal(found.side, -1);
  assert.equal(found.from, 33, "extended over the entry blend");
  assert.equal(found.to, 45, "wraps past sample 0 to the exit blend");
  assert.equal(pitOffsetAt(found, 2, n)! < -PIT_SEPARATION, true);
  assert.equal(pitOffsetAt(found, 20, n), null);
  assert.equal(pitLaneFromBins(Array.from({ length: n }, () => [0, 1, -1, 0])), null, "no lane without pit data");
});

test("the DERIVED Sepang pit lane sits beside the main straight, clear of racing positions", () => {
  assert.equal(lane.accuracyClass, "DERIVED");
  assert.equal(lane.offsets.length, lane.to - lane.from + 1);
  const separate = lane.offsets.filter((o) => Math.abs(o) > ON_TRACK_METRES + 1).length;
  assert.ok(separate / lane.offsets.length > 0.6, "most of the lane is beyond the on-track band");
  assert.ok(lane.offsets.every((o) => Math.sign(o) === lane.side), "one side only");
  // About 600 m long, like the real pit lane (4 m profile samples).
  assert.ok(lane.offsets.length * 4 > 450 && lane.offsets.length * 4 < 800);
});
