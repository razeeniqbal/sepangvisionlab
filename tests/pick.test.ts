import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pickLocked, pickOutcome, readPick, writePick } from "../src/domain/pick.ts";

const race = JSON.parse(
  readFileSync(new URL("../public/sessions/1308/race/session.json", import.meta.url), "utf8"),
);

test("pick outcome follows the official classification", () => {
  assert.deepEqual(pickOutcome(race.result, 3), { kind: "won", position: 1 });
  const second = race.result.find((r: { position: number }) => r.position === 2).driver_number;
  assert.deepEqual(pickOutcome(race.result, second), { kind: "podium", position: 2 });
  assert.equal(pickOutcome(race.result, 999), null);
  assert.deepEqual(pickOutcome([{ position: null, driver_number: 5, dnf: true }], 5), { kind: "out", reason: "DNF" });
  assert.deepEqual(pickOutcome([{ position: 12, driver_number: 5 }], 5), { kind: "finished", position: 12 });
  assert.deepEqual(pickOutcome([{ position: 7, driver_number: 5 }], 5), { kind: "points", position: 7 });
});

test("picks lock at lights out and persist per session", () => {
  assert.equal(pickLocked(100, 200), false);
  assert.equal(pickLocked(200, 200), true);
  assert.equal(pickLocked(5, null), false);
  const store = new Map<string, string>();
  const storage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
  assert.equal(readPick(storage, 1), null);
  writePick(storage, 1, 44);
  assert.equal(readPick(storage, 1), 44);
  assert.equal(readPick(storage, 2), null, "per session");
  writePick(storage, 1, null);
  assert.equal(readPick(storage, 1), null);
  assert.equal(readPick(null, 1), null);
});
