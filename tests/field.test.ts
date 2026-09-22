import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createField,
  advanceField,
  type CarDefinition,
} from "../src/domain/field.ts";

const definitions: CarDefinition[] = Array.from({ length: 20 }, (_, i) => ({
  id: "car-" + i,
  number: String(i).padStart(2, "0"),
  color: "#00a19c",
  initialProgress: i / 20,
  lapSeconds: 24 + i * 0.1,
  compound: "MEDIUM",
  initialTyreAge: i,
}));
test("20 cars keep unique identities and a complete position order", () => {
  const cars = createField(definitions);
  assert.equal(cars.length, 20);
  assert.equal(new Set(cars.map((c) => c.id)).size, 20);
  assert.deepEqual(
    cars.map((c) => c.position).sort((a, b) => a - b),
    Array.from({ length: 20 }, (_, i) => i + 1),
  );
  assert.ok(cars.every((c) => c.speedKph > 0 && Number.isFinite(c.speedKph)));
});
test("cars advance independently without changing their seed state", () => {
  const initial = createField(definitions);
  const next = advanceField(initial, definitions, 12);
  assert.equal(initial[0].progress, 0);
  assert.equal(next[0].progress, 0.5);
  assert.ok(Math.abs(next[1].progress - initial[1].progress - 0.5) > 0.001);
});
test("overlapping cars remain separate and rank deterministically", () => {
  const overlap = definitions.map((d) => ({
    ...d,
    initialProgress: 0,
    lapSeconds: 24,
  }));
  const advanced = advanceField(createField(overlap), overlap, 49);
  assert.equal(advanced.length, 20);
  assert.ok(
    advanced.every(
      (c) => c.completedLaps === 2 && c.progress >= 0 && c.progress < 1,
    ),
  );
  assert.equal(new Set(advanced.map((c) => c.position)).size, 20);
});
test("lap crossings increment tyre age for each car independently", () => {
  const next = advanceField(createField(definitions), definitions, 25);
  assert.equal(next[0].completedLaps, 1);
  assert.equal(next[0].tyreAge, 1);
  assert.equal(next[19].tyreAge, 20);
});
test("reset exactly restores the initial field", () => {
  const original = createField(definitions);
  advanceField(original, definitions, 130);
  assert.deepEqual(createField(definitions), original);
});
test("field movement is frame-rate independent", () => {
  const run = (fps: number) => {
    let cars = createField(definitions);
    for (let i = 0; i < fps * 60; i++)
      cars = advanceField(cars, definitions, 1 / fps);
    return cars;
  };
  const a = run(30),
    b = run(144);
  a.forEach((car, i) => {
    assert.equal(car.completedLaps, b[i].completedLaps);
    assert.ok(Math.abs(car.progress - b[i].progress) < 1e-9);
    assert.equal(car.position, b[i].position);
  });
});
test("invalid seeds and field mismatches fail explicitly", () => {
  assert.throws(() => createField([definitions[0], definitions[0]]));
  assert.throws(() => createField([{ ...definitions[0], initialProgress: 1 }]));
  assert.throws(() => advanceField([], definitions, 1));
  assert.throws(() =>
    advanceField(createField(definitions), [...definitions].reverse(), 1),
  );
});
