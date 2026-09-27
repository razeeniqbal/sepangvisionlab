import test from "node:test";
import assert from "node:assert/strict";
import { carDetail } from "../src/components/cars/carDetail.ts";
test("Projected-size tiers have stable transitions in both directions", () => {
  assert.equal(carDetail(12, "far"), "far");
  assert.equal(carDetail(18, "far"), "medium");
  assert.equal(carDetail(16, "medium"), "medium");
  assert.equal(carDetail(13, "medium"), "far");
  assert.equal(carDetail(15.8, "medium"), "far");
  assert.equal(carDetail(28, "medium"), "near");
  assert.equal(carDetail(25, "near"), "near");
  assert.equal(carDetail(23, "near"), "medium");
  assert.equal(carDetail(8, "near"), "far");
  assert.equal(carDetail(50, "far"), "near");
});
