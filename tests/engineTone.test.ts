import { test } from "node:test";
import assert from "node:assert/strict";
import { engineTone } from "../src/domain/engineTone.ts";

test("engine tone follows RPM and throttle, silent when paused or off", () => {
  const full = engineTone(11000, 100, true);
  assert.equal(full.frequency, 550, "11,000 rpm on a V6 fires at 550 Hz");
  assert.ok(full.volume > engineTone(11000, 0, true).volume, "louder on throttle");
  assert.ok(full.cutoff > engineTone(11000, 0, true).cutoff, "brighter on throttle");
  assert.equal(engineTone(11000, 100, false).volume, 0, "paused replay is silent");
  assert.equal(engineTone(0, 0, true).volume, 0, "engine off is silent");
  assert.equal(engineTone(99999, 500, true).frequency, 750, "clamped");
});
