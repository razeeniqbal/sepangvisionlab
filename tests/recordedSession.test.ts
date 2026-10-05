import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { projectCircuit } from "../src/domain/circuitGeometry.ts";
import { buildTrackProfile, poseAtDistance } from "../src/domain/lapPhysics.ts";
import type { Similarity } from "../src/domain/alignment.ts";
import {
  ON_TRACK_METRES, STALE_AFTER_MS, defaultStart, extractMarkers, motionAt, prepareDriver,
  recordedFieldAt, trackStatusAt, tyreAt, weatherAt,
  type DriverFile, type RaceControlRow, type SessionFile,
} from "../src/domain/recordedSession.ts";

const read = (p: string) => JSON.parse(readFileSync(new URL(p, import.meta.url), "utf8"));
const coords = read("../src/data/circuits/sepang.json").features[0].geometry.coordinates;
const track = buildTrackProfile(projectCircuit(coords, 1), 4, 5543);
// Fixture positions are already in profile decimetres, so the transform is a pure scale.
const decimetres: Similarity = { scale: 0.1, rotation: 0, tx: 0, ty: 0, mirror: false };
const delta = (v: number[]) => v.map((x, i) => x - (i ? v[i - 1] : 0));

/** A car at 60 m/s from 200 m before the line for 1.2 laps, 4 Hz, with a 5 s data gap. */
function fixtureDriver(): DriverFile {
  const t: number[] = [], x: number[] = [], y: number[] = [];
  for (let ms = 0; ms <= 115000; ms += 250) {
    if (ms > 40000 && ms < 45000) continue; // gap
    const p = poseAtDistance(track, -200 + (ms / 1000) * 60);
    t.push(ms); x.push(Math.round(p.x * 10)); y.push(Math.round(p.y * 10));
  }
  const n = t.length;
  return {
    number: 7,
    location: { t: delta(t), x: delta(x), y: delta(y), z: delta(Array(n).fill(0)) },
    telemetry: { t: delta(t), speed: Array(n).fill(216), rpm: Array(n).fill(11000), gear: Array(n).fill(7), throttle: Array(n).fill(100), brake: Array(n).fill(0), drs: Array(n).fill(-1) },
  };
}

test("interpolated distance is monotonic within a lap and unwraps across the line", () => {
  const d = prepareDriver(fixtureDriver(), decimetres, track);
  let prev = -Infinity;
  for (let ms = 0; ms <= 115000; ms += 100) {
    const m = motionAt(d, track, ms);
    assert.ok(m.distance >= prev - 1e-6, `${ms}: ${m.distance} < ${prev}`);
    prev = m.distance;
  }
  // 115 s at 60 m/s: 6,900 m covered, crossing the line, with no wrap jump.
  const covered = motionAt(d, track, 115000).distance - motionAt(d, track, 0).distance;
  assert.ok(Math.abs(covered - 6900) < 10, `${covered}`);
  for (const ms of [5000, 70000]) assert.ok(motionAt(d, track, ms).onTrack);
});

test("a data gap holds the last sample and marks the car stale, never inventing motion", () => {
  const d = prepareDriver(fixtureDriver(), decimetres, track);
  const before = motionAt(d, track, 40000), inGap = motionAt(d, track, 43000);
  assert.equal(inGap.stale, true);
  assert.equal(inGap.distance, before.distance, "held, not interpolated across the gap");
  assert.equal(motionAt(d, track, 41000).stale, false, "within the 2 s grace the hold is not yet stale");
  assert.equal(motionAt(d, track, 46000).stale, false, "fresh again after the gap");
  assert.equal(motionAt(d, track, -10).present, false);
  assert.ok(STALE_AFTER_MS === 2000);
});

test("off-profile samples render raw, beyond the on-track band", () => {
  const file = fixtureDriver();
  // Move one stretch 30 m to the side (a pit lane): x offsets in decimetres.
  const x = file.location.x.map((v, i) => v);
  let acc = 0;
  const abs = x.map((v) => (acc += v));
  for (let i = 40; i < 60; i++) abs[i] += 300;
  file.location.x = delta(abs);
  const d = prepareDriver(file, decimetres, track);
  const m = motionAt(d, track, d.t[50]);
  assert.equal(m.onTrack, false);
  assert.ok(Math.abs(m.lateral) > ON_TRACK_METRES);
  assert.ok(Math.abs(m.x - d.wx[50]) < 1e-9 && Math.abs(m.y - d.wy[50]) < 1e-9, "raw aligned position");
});

const control = (t: number, category: string, flag: string | null, scope: string | null, message: string, sector: number | null = null): RaceControlRow =>
  ({ t, lap: null, category, flag, scope, sector, d: null, message });
const rc: RaceControlRow[] = [
  control(0, "SessionStatus", null, null, "SESSION STARTED"),
  control(1000, "Flag", "GREEN", "Track", "GREEN LIGHT - PIT EXIT OPEN"),
  control(5000, "Flag", "YELLOW", "Sector", "YELLOW IN TRACK SECTOR 4", 4),
  control(9000, "Flag", "DOUBLE YELLOW", "Sector", "DOUBLE YELLOW IN TRACK SECTOR 5", 5),
  control(30000, "Flag", "CLEAR", "Sector", "CLEAR IN TRACK SECTOR 4", 4),
  control(31000, "Flag", "CLEAR", "Sector", "CLEAR IN TRACK SECTOR 5", 5),
  control(40000, "SafetyCar", null, "Track", "SAFETY CAR DEPLOYED"),
  control(70000, "Flag", "GREEN", "Track", "TRACK CLEAR"),
  control(80000, "SafetyCar", null, "Track", "VSC DEPLOYED"),
  control(90000, "Other", null, null, "CAR 11 (PER) TIME 1:39.000 DELETED - TRACK LIMITS AT TURN 7 LAP 3"),
  control(99000, "Flag", "CHEQUERED", "Track", "CHEQUERED FLAG"),
];

test("track status follows race control, with sector yellows over green", () => {
  assert.equal(trackStatusAt(rc, -1).status, "NONE");
  assert.equal(trackStatusAt(rc, 2000).status, "GREEN");
  const y = trackStatusAt(rc, 10000);
  assert.equal(y.status, "YELLOW");
  assert.deepEqual(y.yellowSectors, [4, 5]);
  assert.equal(trackStatusAt(rc, 32000).status, "GREEN");
  assert.equal(trackStatusAt(rc, 50000).status, "SC");
  assert.equal(trackStatusAt(rc, 85000).status, "VSC");
  assert.equal(trackStatusAt(rc, 99500).status, "CHEQUERED");
  assert.equal(trackStatusAt(rc, 99500).latest?.message, "CHEQUERED FLAG");
});

test("markers: start, merged yellows, SC, VSC, track limits, chequered", () => {
  const kinds = extractMarkers(rc).map((m) => m.kind);
  assert.deepEqual(kinds, ["start", "yellow", "sc", "vsc", "trackLimits", "chequered"]);
});

test("tyres follow stints, including intermediates and unknowns", () => {
  const stints = [
    { d: 1, n: 1, lapStart: 1, lapEnd: 12, compound: "INTERMEDIATE", ageStart: 0 },
    { d: 1, n: 2, lapStart: 13, lapEnd: 55, compound: "MEDIUM", ageStart: 2 },
    { d: 2, n: 1, lapStart: 1, lapEnd: 3, compound: null, ageStart: 0 },
  ];
  assert.deepEqual(tyreAt(stints, 1, 5), { compound: "INTERMEDIATE", age: 4 });
  assert.deepEqual(tyreAt(stints, 1, 20), { compound: "MEDIUM", age: 9 });
  assert.equal(tyreAt(stints, 2, 2).compound, "UNKNOWN");
  assert.equal(tyreAt(stints, 9, 2).compound, "UNKNOWN");
});

test("real qualifying data: deterministic seeks, positions, weather and a sensible start", () => {
  const file: SessionFile = read("../public/sessions/1308/qualifying/session.json");
  const alignment = read("../public/sessions/1308/alignment.json");
  const numbers = [3, 44, 16];
  const drivers = numbers.map((n) => prepareDriver(read(`../public/sessions/1308/qualifying/drivers/${n}.json`), alignment.transform, track));
  const session = { file: { ...file, drivers: file.drivers.filter((d) => numbers.includes(d.driver_number)) }, track, drivers };
  const start = defaultStart(file);
  assert.ok(start >= 0 && start < 20 * 60000);
  const at = start + 15 * 60000;
  const forward = recordedFieldAt(session, at);
  recordedFieldAt(session, at + 600000);
  const back = recordedFieldAt(session, at);
  assert.deepEqual(back, forward, "rewind lands on the identical state");
  for (const car of forward) {
    assert.ok(car.position >= 1 && car.position < 99);
    assert.ok(car.progress >= 0 && car.progress < 1);
  }
  assert.ok(weatherAt(file.weather, at)!.air! > 20);
  // Someone on a timed lap is on the profile and close to the racing surface.
  const running = forward.filter((c) => c.present && c.onTrack && c.speedKph > 150);
  for (const c of running) assert.ok(Math.abs(c.pose.x) < 1000 && Math.abs(c.pose.y) < 1000);
});
