// DERIVES the circuit's elevation profile from OpenF1 heights. Every on-track race sample from
// every driver is binned by profile sample; the median height per sample (OpenF1 decimetres,
// scaled like x and y by the alignment) gives the profile, smoothed over ~40 m and closed
// around the lap. Writes src/data/circuits/sepangElevation.json. Run:
//   node --experimental-strip-types scripts/derive-elevation.ts
import { readFileSync, writeFileSync } from "node:fs";
import { projectCircuit } from "../src/domain/circuitGeometry.ts";
import { CIRCUIT_LENGTH_METERS } from "../src/domain/field.ts";
import { buildTrackProfile } from "../src/domain/lapPhysics.ts";
import { prepareDriver, undelta, type DriverFile } from "../src/domain/recordedSession.ts";
import { elevationFromBins } from "../src/domain/elevation.ts";

const read = (p: string) => JSON.parse(readFileSync(new URL(p, import.meta.url), "utf8"));
const track = buildTrackProfile(
  projectCircuit(read("../src/data/circuits/sepang.json").features[0].geometry.coordinates, 1),
  4,
  CIRCUIT_LENGTH_METERS,
);
const alignment = read("../public/sessions/1308/alignment.json");
const race = read("../public/sessions/1308/race/session.json");
const bins: number[][] = Array.from({ length: track.count }, () => []);
for (const driver of race.drivers) {
  const file = read(`../public/sessions/1308/race/drivers/${driver.driver_number}.json`) as DriverFile;
  const d = prepareDriver(file, alignment.transform, track);
  const z = undelta(file.location.z);
  for (let i = 0; i < d.t.length; i++) {
    if (d.road[i] !== 1) continue;
    const s = ((d.s[i] % track.length) + track.length) % track.length;
    bins[Math.floor((s / track.length) * track.count) % track.count].push(z[i] * alignment.transform.scale);
  }
}
const profile = elevationFromBins(bins);
writeFileSync(
  new URL("../src/data/circuits/sepangElevation.json", import.meta.url),
  JSON.stringify(
    {
      schemaVersion: 1,
      accuracyClass: "DERIVED",
      description:
        "Track surface height (metres, relative to the lowest point) per track profile sample, from the median OpenF1 location z of every on-track 2026 race sample, scaled like x and y by the alignment and smoothed over about 40 m. Car-reference heights, not a survey.",
      source: "OpenF1 location, session 11731, aligned with public/sessions/1308/alignment.json",
      samples: profile.samples,
      range: Math.round(profile.range * 100) / 100,
      heights: profile.heights.map((h) => Math.round(h * 100) / 100),
    },
    null,
    0,
  ) + "\n",
);
console.log(`elevation: ${profile.heights.length} samples, range ${profile.range.toFixed(2)} m, ${profile.samples} race samples, empty bins filled ${profile.filled}`);
