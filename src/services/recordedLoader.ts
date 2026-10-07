import { sepangTrack } from "../data/sepangPace";
import pitLaneData from "../data/circuits/sepangPitLane.json";
import type { PitLane } from "../domain/pitLane";
import type { Similarity } from "../domain/alignment";
import type { CarDefinition } from "../domain/field";
import {
  prepareDriver,
  type DriverFile,
  type RecordedSession,
  type SessionFile,
} from "../domain/recordedSession";
import type {
  DriverIdentity,
  TeamGlyphShape,
} from "../components/broadcast/TeamGlyph";

export const MEETING = 1308;
const base = `/sessions/${MEETING}`;

export interface RecordedIndex {
  meetingKey: number;
  attribution: string;
  sessions: { slug: string; sessionKey: number; name: string; dateStart: string }[];
}

async function json<T>(url: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`Could not load ${url} (${response.status})`);
  return (await response.json()) as T;
}

export const loadIndex = (signal: AbortSignal) =>
  json<RecordedIndex>(`${base}/index.json`, signal);

/** Fetch a session and prepare every driver, yielding between drivers so the page stays live. */
export async function loadRecordedSession(
  slug: string,
  signal: AbortSignal,
  onProgress: (done: number, total: number) => void,
): Promise<RecordedSession> {
  const [file, alignment] = await Promise.all([
    json<SessionFile>(`${base}/${slug}/session.json`, signal),
    json<{ transform: Similarity }>(`${base}/alignment.json`, signal),
  ]);
  const files = await Promise.all(
    file.drivers.map((d) =>
      json<DriverFile>(`${base}/${slug}/drivers/${d.driver_number}.json`, signal),
    ),
  );
  const drivers = [];
  for (const [i, f] of files.entries()) {
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");
    drivers.push(prepareDriver(f, alignment.transform, sepangTrack, pitLaneData as PitLane));
    onProgress(i + 1, files.length);
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  return { file, track: sepangTrack, drivers };
}

const SHAPES: TeamGlyphShape[] = ["circle", "square", "triangle", "diamond", "hexagon"];
const titleCase = (s: string) =>
  s.toLowerCase().replace(/(^|[\s-])\p{L}/gu, (m) => m.toUpperCase());

/**
 * Broadcast identity for real entries: real names and team names, OpenF1 team colours, and
 * a plain geometric glyph per team (shape by alphabetical team order). No logos or headshots.
 */
export function recordedIdentities(file: SessionFile) {
  const teams = [...new Set(file.drivers.map((d) => d.team_name))].sort();
  const identities = new Map<number, DriverIdentity & { color: string }>();
  for (const d of file.drivers) {
    const k = teams.indexOf(d.team_name);
    identities.set(d.driver_number, {
      code: d.name_acronym,
      name:
        d.first_name && d.last_name
          ? `${d.first_name} ${titleCase(d.last_name)}`
          : titleCase(d.full_name),
      team: { name: d.team_name, glyph: SHAPES[k % SHAPES.length], filled: k < SHAPES.length },
      color: "#" + (d.team_colour ?? "8a9a98"),
    });
  }
  return identities;
}

/** Entries in the CarDefinition shape the circuit scene and minimap already consume. */
export function recordedEntries(file: SessionFile): CarDefinition[] {
  const ids = recordedIdentities(file);
  return file.drivers.map((d) => ({
    id: "d" + d.driver_number,
    number: String(d.driver_number),
    color: ids.get(d.driver_number)!.color,
    team: d.team_name,
    initialProgress: 0,
    lapSeconds: 20, // unused in recorded mode: gaps and laps come from timing data
    compound: "UNKNOWN",
    initialTyreAge: 0,
  }));
}
