// DERIVES the pit lane from where cars actually drove during the 2026 race pit stops.
// For every pit stop, aligned positions from 25 s before to 25 s after the stop are binned by
// track sample; the median across-track offset per sample gives the lane centre line.
// Writes src/data/circuits/sepangPitLane.json. Run:
//   node --experimental-strip-types scripts/derive-pit-lane.ts
import { readFileSync, writeFileSync } from "node:fs";
import { projectCircuit } from "../src/domain/circuitGeometry.ts";
import { CIRCUIT_LENGTH_METERS } from "../src/domain/field.ts";
import { buildTrackProfile } from "../src/domain/lapPhysics.ts";
import { prepareDriver, type DriverFile } from "../src/domain/recordedSession.ts";
import { pitLaneFromBins } from "../src/domain/pitLane.ts";

const read = (p: string) => JSON.parse(readFileSync(new URL(p, import.meta.url), "utf8"));
const track = buildTrackProfile(
  projectCircuit(read("../src/data/circuits/sepang.json").features[0].geometry.coordinates, 1),
  4,
  CIRCUIT_LENGTH_METERS,
);
const transform = read("../public/sessions/1308/alignment.json").transform;
const race = read("../public/sessions/1308/race/session.json");
const bins: number[][] = Array.from({ length: track.count }, () => []);
const cache = new Map<number, ReturnType<typeof prepareDriver>>();
for (const stop of race.pit) {
  if (!cache.has(stop.d))
    cache.set(stop.d, prepareDriver(read(`../public/sessions/1308/race/drivers/${stop.d}.json`) as DriverFile, transform, track));
  const d = cache.get(stop.d)!;
  for (let i = 0; i < d.t.length; i++) {
    if (d.t[i] < stop.t - 25000 || d.t[i] > stop.t + (stop.lane ?? 30) * 1000 + 25000) continue;
    const s = ((d.s[i] % track.length) + track.length) % track.length;
    bins[Math.floor((s / track.length) * track.count) % track.count].push(d.lateral[i]);
  }
}
const lane = pitLaneFromBins(bins);
if (!lane) throw new Error("No pit lane found in the race data");
writeFileSync(
  new URL("../src/data/circuits/sepangPitLane.json", import.meta.url),
  JSON.stringify(
    {
      schemaVersion: 1,
      accuracyClass: "DERIVED",
      description:
        "Pit lane centre line as a signed across-track offset (metres, + left of travel) per track profile sample, from aligned OpenF1 positions during the 2026 race pit stops (median per 4 m sample, smoothed). Width and wall are illustrative.",
      source: "OpenF1 location, session 11731, aligned with public/sessions/1308/alignment.json",
      stops: race.pit.length,
      ...lane,
      offsets: lane.offsets.map((v) => Math.round(v * 100) / 100),
    },
    null,
    1,
  ) + "\n",
);
console.log(`pit lane: samples ${lane.from}..${lane.to} (${lane.offsets.length}), side ${lane.side}, offsets ${Math.min(...lane.offsets).toFixed(1)}..${Math.max(...lane.offsets).toFixed(1)} m`);
