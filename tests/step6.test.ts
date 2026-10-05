import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { projectCircuit } from "../src/domain/circuitGeometry.ts";
import { buildTrackProfile } from "../src/domain/lapPhysics.ts";
import { leftNormals } from "../src/components/circuit/environment/ribbon.ts";
import {
  BARRIER_OFFSET, distanceToTrack, gravelTraps, officialTurnBoards, palmRows, treeClumps,
} from "../src/components/circuit/environment/layout.ts";
import { QUALITY, readQuality, writeQuality } from "../src/components/circuit/quality.ts";
import { EMPTY, SETUP_KEY, loadSetups, parseSaved, saveSetups } from "../src/domain/setupStore.ts";
import { presentKeyAction } from "../src/components/broadcast/presentMode.ts";

const coords = JSON.parse(readFileSync(new URL("../src/data/circuits/sepang.json", import.meta.url), "utf8")).features[0].geometry.coordinates;
const track = buildTrackProfile(projectCircuit(coords, 1), 4, 5543);
const normals = leftNormals(track);
const distance = distanceToTrack(track);

test("gravel sits on the outside of every numbered corner exit", () => {
  const turns = officialTurnBoards(track, normals);
  const traps = gravelTraps(track, turns.map((t) => t.apex));
  assert.equal(traps.length, 15);
  traps.forEach((g, i) => {
    assert.equal(g.side, track.curvature[turns[i].apex] > 0 ? -1 : 1, "outside of the bend");
    assert.ok(g.to > g.from);
  });
});

test("tree clumps stay behind the barriers and clear of cameras", () => {
  const avoid = [{ x: track.x[100] + 50, y: track.y[100] }];
  const trees = treeClumps(track, normals, { avoid });
  assert.ok(trees.length > 100);
  for (const t of trees) {
    assert.ok(distance(t.x, t.y) >= 38 - 1e-9 && 38 > BARRIER_OFFSET);
    assert.ok(Math.hypot(t.x - avoid[0].x, t.y - avoid[0].y) >= 14);
  }
  assert.deepEqual(treeClumps(track, normals, { avoid }), trees, "deterministic");
});

test("palm rows form a plantation band and any prefix is spread out", () => {
  const palms = palmRows(track);
  assert.ok(palms.length > QUALITY.high.palms, `${palms.length}`);
  for (const p of palms.slice(0, 400)) {
    const d = distance(p.x, p.y);
    assert.ok(d >= 90 - 1 && d <= 330 + 1, `${d}`);
  }
  // A low-preset prefix still reaches round the circuit, not one corner.
  const low = palms.slice(0, QUALITY.low.palms);
  const xs = low.map((p) => p.x), ys = low.map((p) => p.y);
  assert.ok(Math.max(...xs) - Math.min(...xs) > 1000 && Math.max(...ys) - Math.min(...ys) > 900);
});

test("quality preset defaults to balanced and survives bad storage", () => {
  assert.equal(readQuality(null), "balanced");
  assert.equal(readQuality({ getItem: () => "ultra" }), "balanced");
  assert.equal(readQuality({ getItem: () => "high" }), "high");
  assert.equal(readQuality({ getItem: () => { throw new Error("blocked"); } }), "balanced");
  assert.equal(writeQuality({ setItem: () => { throw new Error("full"); } }, "low"), false);
  assert.ok(QUALITY.low.palms < QUALITY.balanced.palms && QUALITY.balanced.palms < QUALITY.high.palms);
  assert.equal(QUALITY.low.shadows, false);
});

test("saved setups are validated, scoped to known cars and round-trip", () => {
  const ids = new Set(["car-07", "car-88"]);
  const good = { powerKw: 850, wingLevel: 4, fuelKg: 20, compound: "SOFT", wet: false };
  const text = JSON.stringify({
    overrides: { "car-07": good, "car-88": { ...good, powerKw: 5000 }, "car-99": good },
    ghost: { carId: "car-07", setup: good },
  });
  const parsed = parseSaved(text, ids);
  assert.deepEqual(Object.keys(parsed.overrides), ["car-07"], "out-of-range and unknown cars dropped");
  assert.deepEqual(parsed.ghost, { carId: "car-07", setup: good });
  assert.deepEqual(parseSaved("{not json", ids), EMPTY);
  assert.deepEqual(parseSaved(null, ids), EMPTY);
  const store = new Map<string, string>();
  const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) };
  assert.equal(saveSetups(storage, parsed), true);
  assert.deepEqual(loadSetups(storage, ids), parsed);
  saveSetups(storage, EMPTY);
  assert.equal(store.has(SETUP_KEY), false, "empty state clears the key");
  assert.deepEqual(loadSetups({ getItem: () => { throw new Error("blocked"); } }, ids), EMPTY);
});

test("present mode keys: P toggles, Escape exits, never while typing", () => {
  assert.equal(presentKeyAction({ key: "p" }, false), "toggle");
  assert.equal(presentKeyAction({ key: "P" }, true), "toggle");
  assert.equal(presentKeyAction({ key: "Escape" }, true), "exit");
  assert.equal(presentKeyAction({ key: "Escape" }, false), null);
  assert.equal(presentKeyAction({ key: "p", target: { tagName: "input" } }, false), null);
  assert.equal(presentKeyAction({ key: "p", target: { isContentEditable: true } }, false), null);
  assert.equal(presentKeyAction({ key: "p", ctrlKey: true }, false), null);
});
