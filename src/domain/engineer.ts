// The race engineer. Pure.
//
// A brief of what the followed car's engineer can see at a replay moment, built only from
// recorded OpenF1 channels; preset questions answered from it by rules (no network, no key);
// and the prompt that lets Claude answer free questions from the same brief. Every answer is a
// fresh, one-off radio call: nothing is carried between questions.

import { formatLap } from "./inspection.ts";
import type { PitRow, RaceControlRow, WeatherRow } from "./recordedSession.ts";

export interface BriefCar {
  number: string;
  position: number;
  lap: number;
  compound: string;
  tyreAge: number;
  bestLap: number | null;
  lastLap: number | null;
  gapText: string | null;
  intervalText: string | null;
  inPit: boolean;
  present: boolean;
  stale: boolean;
}

export interface BriefInput {
  sessionName: string;
  race: boolean;
  /** Replay time, ms since session start. */
  time: number;
  clock: string;
  totalLaps?: number;
  cars: readonly BriefCar[];
  followed: string;
  identity: (number: string) => { code: string; name: string; team: string };
  pit: readonly PitRow[];
  raceControl: readonly RaceControlRow[];
  weather: WeatherRow | null;
  trackStatus: string;
}

export interface Neighbour {
  code: string;
  /** Race: interval on track, e.g. "+1.204". Other sessions: best-lap difference. */
  delta: string | null;
}

export interface EngineerBrief {
  session: string;
  race: boolean;
  clock: string;
  driver: { code: string; name: string; team: string };
  position: number;
  lap: number;
  totalLaps: number | null;
  ahead: Neighbour | null;
  behind: Neighbour | null;
  gapToLeader: string | null;
  /** "?" when OpenF1 does not say (or contradicts itself). */
  tyre: { compound: string; age: number };
  lastLap: string | null;
  bestLap: string | null;
  sessionBest: { code: string; time: string } | null;
  /** Personal best minus session best, seconds; null without both. */
  offBest: number | null;
  pitStops: number;
  inPit: boolean;
  onAir: boolean;
  trackStatus: string;
  weather: { air: number | null; track: number | null; raining: boolean; humidity: number | null } | null;
  raceControl: string[];
}

const delta = (a: number | null, b: number | null) => (a === null || b === null ? null : a - b);
const signed = (v: number) => (v >= 0 ? "+" : "-") + Math.abs(v).toFixed(3);

export function buildBrief(input: BriefInput): EngineerBrief {
  const me = input.cars.find((c) => c.number === input.followed) ?? input.cars[0];
  const ordered = [...input.cars].sort((a, b) => a.position - b.position);
  const at = ordered.indexOf(me);
  // Race: the interval between the two cars is held by the car behind of the pair.
  const near = (car: BriefCar | undefined, interval: string | null | undefined): Neighbour | null => {
    if (!car) return null;
    if (input.race) return { code: input.identity(car.number).code, delta: interval ?? null };
    const d = delta(car.bestLap, me.bestLap);
    return { code: input.identity(car.number).code, delta: d === null ? null : signed(d) };
  };
  const bests = input.cars.filter((c) => c.bestLap !== null);
  const best = bests.length ? bests.reduce((a, b) => (b.bestLap! < a.bestLap! ? b : a)) : null;
  const n = Number(me.number);
  const stops = new Set(input.pit.filter((p) => p.d === n && p.t <= input.time).map((p) => p.stop ?? p.t));
  const messages = input.raceControl
    .filter((r) => r.t <= input.time && r.message)
    .slice(-3)
    .map((r) => r.message!);
  return {
    session: input.sessionName,
    race: input.race,
    clock: input.clock,
    driver: input.identity(me.number),
    position: me.position,
    lap: me.lap,
    totalLaps: input.totalLaps ?? null,
    ahead: near(ordered[at - 1], me.intervalText),
    behind: near(ordered[at + 1], ordered[at + 1]?.intervalText),
    gapToLeader: at === 0 ? null : me.gapText,
    tyre: { compound: me.compound === "UNKNOWN" ? "?" : me.compound, age: me.tyreAge },
    lastLap: me.lastLap === null ? null : formatLap(me.lastLap),
    bestLap: me.bestLap === null ? null : formatLap(me.bestLap),
    sessionBest: best ? { code: input.identity(best.number).code, time: formatLap(best.bestLap) } : null,
    offBest: best ? delta(me.bestLap, best.bestLap) : null,
    pitStops: stops.size,
    inPit: me.inPit && me.present,
    onAir: me.present && !me.stale,
    trackStatus: input.trackStatus,
    weather: input.weather && {
      air: input.weather.air,
      track: input.weather.track,
      raining: (input.weather.rain ?? 0) > 0,
      humidity: input.weather.humidity,
    },
    raceControl: messages,
  };
}

export type PresetId = "gaps" | "tyres" | "pace" | "track" | "weather" | "summary";
export const PRESETS: { id: PresetId; label: string }[] = [
  { id: "gaps", label: "Gaps ahead and behind?" },
  { id: "tyres", label: "How old are the tyres?" },
  { id: "pace", label: "How's my pace?" },
  { id: "track", label: "Track status?" },
  { id: "weather", label: "Weather update?" },
  { id: "summary", label: "Where are we?" },
];

const COMPOUND: Record<string, string> = {
  SOFT: "softs",
  MEDIUM: "mediums",
  HARD: "hards",
  INTERMEDIATE: "inters",
  WET: "full wets",
};
const STATUS: Record<string, string> = {
  GREEN: "Track is green.",
  YELLOW: "Yellow flag out there, careful.",
  SC: "Safety car, safety car. Stay above the delta.",
  VSC: "VSC deployed. Keep to the delta.",
  RED: "Red flag, red flag. Back to the pit lane.",
  CHEQUERED: "Chequered flag is out.",
  NONE: "No flags from race control.",
};

/** A preset answered from the brief alone: short, radio style, nothing beyond the data. */
export function presetAnswer(id: PresetId, b: EngineerBrief): string {
  if (!b.onAir && !b.inPit) return `${b.driver.code}, we've lost your data at the moment. No reading to give you.`;
  const pos = `P${b.position}`;
  switch (id) {
    case "gaps": {
      if (b.race) {
        const ahead = b.ahead ? `${b.ahead.code} ahead, ${b.ahead.delta ?? "no gap reading"}` : "Nobody ahead, you're leading";
        const behind = b.behind ? `${b.behind.code} behind, ${b.behind.delta ?? "no gap reading"}` : "nobody behind";
        return `${pos}. ${ahead}. ${behind}.`;
      }
      // Best-lap differences: how much quicker the car ahead is, how much slower the car behind.
      const by = (d: string | null) => (d === null ? null : d.slice(1));
      const ahead = b.ahead
        ? `${b.ahead.code} ahead on the sheet, ${by(b.ahead.delta) ? by(b.ahead.delta) + " quicker" : "no time to compare"}`
        : "Top of the timesheet";
      const behind = b.behind
        ? `${b.behind.code} behind, ${by(b.behind.delta) ? by(b.behind.delta) + " slower" : "no time yet"}`
        : "nobody behind";
      return `${pos} on best laps. ${ahead}. ${behind}.`;
    }
    case "tyres": {
      const stops = b.race ? ` ${b.pitStops === 0 ? "No stops yet." : `${b.pitStops} stop${b.pitStops > 1 ? "s" : ""} so far.`}` : "";
      if (b.tyre.compound === "?") return `Can't confirm the compound on this set, the data doesn't agree.${stops}`;
      return `You're on ${COMPOUND[b.tyre.compound] ?? b.tyre.compound.toLowerCase()}, ${b.tyre.age} lap${b.tyre.age === 1 ? "" : "s"} old.${stops}`;
    }
    case "pace": {
      if (!b.bestLap) return "No timed lap from you yet. Nothing to compare.";
      const last = b.lastLap ? `Last lap ${b.lastLap}. ` : "";
      if (b.offBest === null || !b.sessionBest) return `${last}Your best is ${b.bestLap}.`;
      if (b.offBest <= 0) return `${last}Your best ${b.bestLap} is the fastest lap of the session. Good job.`;
      return `${last}Best ${b.bestLap}, that's ${signed(b.offBest)} to ${b.sessionBest.code}'s ${b.sessionBest.time}.`;
    }
    case "track": {
      const latest = b.raceControl.at(-1);
      return `${STATUS[b.trackStatus] ?? b.trackStatus}${latest ? ` Last from race control: ${sentence(latest)}` : ""}`;
    }
    case "weather": {
      if (!b.weather) return "No weather reading at the moment.";
      const w = b.weather;
      const temps = [w.air !== null && `air ${w.air.toFixed(0)}`, w.track !== null && `track ${w.track.toFixed(0)}`]
        .filter(Boolean)
        .join(", ");
      return `${w.raining ? "Rain reported, track is wet." : "No rain, track is dry."}${temps ? ` Temps ${temps} degrees.` : ""}`;
    }
    case "summary": {
      if (b.inPit) return `You're in the pit lane, ${pos}.`;
      const lap = b.race && b.totalLaps ? `Lap ${Math.max(1, b.lap)} of ${b.totalLaps}` : `Lap ${Math.max(1, b.lap)}`;
      const leader = b.race ? (b.gapToLeader ? `, ${b.gapToLeader} to the leader` : ", leading the race") : "";
      return `${lap}, ${pos}${leader}.`;
    }
  }
}

const sentence = (s: string) => {
  const t = s.charAt(0) + s.slice(1).toLowerCase();
  return /[.!?]$/.test(t) ? t : t + ".";
};

/** The preset a typed or spoken question most likely means, for answering without a key. */
export function matchPreset(question: string): PresetId | null {
  const q = question.toLowerCase();
  const rules: [PresetId, RegExp][] = [
    ["tyres", /tyre|tire|compound|soft|medium|hard|stint|box|pit/],
    ["gaps", /gap|ahead|behind|interval|catch|front|attack|defend/],
    ["pace", /pace|lap ?time|fast|slow|best|quick|purple/],
    ["track", /flag|yellow|safety|vsc|red|status|race control|incident/],
    ["weather", /weather|rain|wet|dry|temp|hot|humid/],
    ["summary", /where|position|summary|update|how are we|what lap|place/],
  ];
  return rules.find(([, r]) => r.test(q))?.[0] ?? null;
}

export const ENGINEER_SYSTEM = `You are the race engineer for one driver, talking on team radio during a replay of a recorded 2026 Sepang session.

Each message gives you a data brief (JSON) of what the pit wall can see at this moment, then the driver's question. Answer like a real race engineer on the radio: one to three short spoken sentences, calm, direct, first names or driver codes, no lists, no markdown, no emojis.

Use only the brief. Every number you say must appear in it. If the brief does not cover the question, say you don't have that data rather than guess. A tyre compound of "?" means the data is unclear. Never invent tyre wear, fuel, damage, strategy plans or other teams' intentions. You may add a short generic call such as "keep it clean" when it fits.`;

/** The user turn: the brief, then the question. One per request; nothing else is sent. */
export function engineerMessage(brief: EngineerBrief, question: string) {
  return `Data brief:\n${JSON.stringify(brief)}\n\nDriver: ${question.trim()}`;
}
