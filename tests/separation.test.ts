import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { MIN_SIDE_GAP, contactAllowed, contactsFrom, separationShifts } from "../src/domain/separation.ts";

const race = JSON.parse(readFileSync(new URL("../public/sessions/1308/race/session.json", import.meta.url), "utf8"));

test("collisions come from race control at the quoted incident time", () => {
  const contacts = contactsFrom(race.raceControl, race.t0);
  // LEC/HUL at 16:40:50 local (08:40:50 UTC) and BOR/SAI at 17:01:01 local.
  assert.equal(contacts.length, 2, JSON.stringify(contacts));
  const lec = contacts.find((c) => c.a === 16 && c.b === 27)!;
  assert.equal(lec.time, Date.parse("2026-10-04T08:40:50Z") - Date.parse(race.t0));
  assert.equal(contactAllowed(contacts, 27, 16, lec.time + 5_000), true, "either order, within 10 s");
  assert.equal(contactAllowed(contacts, 16, 27, lec.time + 60_000), false);
  assert.equal(contactAllowed(contacts, 16, 3, lec.time), false);
});

test("side-by-side cars are nudged apart just enough, and continuously", () => {
  const L = 5543;
  const pair = (ds: number, gap: number) =>
    separationShifts(
      [
        { number: 1, distance: 1000, lateral: 0, active: true },
        { number: 2, distance: 1000 + ds, lateral: -gap, active: true },
      ],
      L,
    );
  const s = pair(0, 1);
  assert.ok(Math.abs(s.get(1)! - s.get(2)! + 1 - MIN_SIDE_GAP) < 1e-9, "gap restored to the minimum");
  assert.ok(s.get(1)! > 0 && s.get(2)! < 0, "each moves away from the other");
  assert.equal(pair(12, 1).get(1), 0, "far apart along the track: untouched");
  assert.equal(pair(0, 3).get(1), 0, "already enough side gap: untouched");
  // Eases in: nothing at the edge, partial in between, full when overlapping.
  assert.ok(Math.abs(pair(9.4, 1).get(1)!) < 0.01);
  assert.ok(pair(7.5, 1).get(1)! > 0.05 && pair(7.5, 1).get(1)! < s.get(1)!);
  // Exempt pairs and inactive cars are left alone.
  const exempt = separationShifts(
    [
      { number: 1, distance: 1000, lateral: 0, active: true },
      { number: 2, distance: 1000, lateral: 0, active: true },
    ],
    L,
    () => true,
  );
  assert.equal(exempt.get(1), 0);
  const pit = separationShifts(
    [
      { number: 1, distance: 1000, lateral: 0, active: true },
      { number: 2, distance: 1000, lateral: 0, active: false },
    ],
    L,
  );
  assert.equal(pit.get(1), 0);
  // Wraps across the line.
  const wrap = separationShifts(
    [
      { number: 1, distance: 1, lateral: 0, active: true },
      { number: 2, distance: L - 1, lateral: -0.5, active: true },
    ],
    L,
  );
  assert.ok(wrap.get(1)! > 0);
});
