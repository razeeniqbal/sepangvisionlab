import { useEffect, useMemo, useState } from "react";
import CircuitScene from "../circuit/CircuitViewport";
import Standings from "../standings/Standings";
import MiniMap from "../broadcast/MiniMap";
import { useGestureReceiver } from "../handtracking/GestureContext";
import useReplay from "../../hooks/useReplay";
import {
  defaultStart,
  extractMarkers,
  recordedFieldAt,
  trackStatusAt,
  weatherAt,
  type RecordedCarState,
  type RecordedSession,
} from "../../domain/recordedSession";
import { formatLap } from "../../domain/inspection";
import {
  loadIndex,
  loadRecordedSession,
  recordedEntries,
  recordedIdentities,
  type RecordedIndex,
} from "../../services/recordedLoader";
import RecordedTelemetryCard from "./RecordedTelemetryCard";
import RaceControlTicker from "./RaceControlTicker";
import WeatherStrip from "./WeatherStrip";
import ThemeToggle from "../broadcast/ThemeToggle";
import RecordedTimeline, { clockText } from "./RecordedTimeline";

export const RECORDED_LABEL = "Recorded session · interpolated motion · data via OpenF1";
const ATTRIBUTION = "Data via OpenF1 (unofficial). Not associated with Formula 1.";
const SHORT: Record<string, string> = {
  fp1: "FP1",
  fp2: "FP2",
  fp3: "FP3",
  qualifying: "Qualifying",
  race: "Race",
};

interface Sheet {
  handsOpen: boolean;
  onHands: () => void;
}

export default function RecordedWorkspace(sheet: Sheet) {
  const [index, setIndex] = useState<RecordedIndex | null>(null);
  const [slug, setSlug] = useState("race");
  const [session, setSession] = useState<RecordedSession | null>(null);
  const [progress, setProgress] = useState<[number, number]>([0, 0]);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    loadIndex(controller.signal).then(setIndex, () => setIndex(null));
    return () => controller.abort();
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setSession(null);
    setError("");
    loadRecordedSession(slug, controller.signal, (done, total) =>
      setProgress([done, total]),
    ).then(setSession, (e: unknown) => {
      if (!controller.signal.aborted)
        setError(e instanceof Error ? e.message : "The recorded session could not load.");
    });
    return () => controller.abort();
  }, [slug]);
  const picker = (
    <div className="rec-picker" role="tablist" aria-label="Recorded session">
      {(index?.sessions ?? Object.keys(SHORT).map((s) => ({ slug: s, name: SHORT[s] }))).map((s) => (
        <button key={s.slug} role="tab" aria-selected={s.slug === slug} onClick={() => setSlug(s.slug)}>
          {SHORT[s.slug] ?? s.name}
        </button>
      ))}
    </div>
  );
  if (!session)
    return (
      <div className="app bc rec-loading">
        {picker}
        <div className="session-loading">
          <h1>{error ? "Recorded session unavailable" : "Loading recorded session"}</h1>
          <p role="status">
            {error ||
              (progress[1]
                ? `Aligning driver ${progress[0]} of ${progress[1]} to the track…`
                : "Fetching OpenF1 replay files…")}
          </p>
          <p className="rec-attribution">{ATTRIBUTION}</p>
        </div>
      </div>
    );
  return <RecordedReplay key={slug} session={session} picker={picker} {...sheet} />;
}

function RecordedReplay({
  session,
  picker,
  handsOpen,
  onHands,
}: { session: RecordedSession; picker: React.ReactNode } & Sheet) {
  const { file } = session;
  const duration = file.durationMs / 1000;
  const replay = useReplay(duration, false);
  const { time, running, speed } = replay;
  const start = defaultStart(file) / 1000;
  useEffect(() => {
    replay.seek(start);
    replay.setSpeed(1);
    // Open at the session start once per session; replay functions are stable enough here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file]);
  const entries = useMemo(() => recordedEntries(file), [file]);
  const identities = useMemo(() => recordedIdentities(file), [file]);
  const markers = useMemo(() => extractMarkers(file.raceControl), [file]);
  const sample = useMemo(
    () => (t: number) => recordedFieldAt(session, t * 1000),
    [session],
  );
  const cars = sample(time) as RecordedCarState[];
  const previous = new Map(sample(Math.max(0, time - 10)).map((c) => [c.id, c.position]));
  const [selectedId, setSelectedId] = useState(() => {
    const leader = [...cars].sort((a, b) => a.position - b.position)[0];
    return leader?.id ?? entries[0].id;
  });
  const [drawer, setDrawer] = useState<"laps" | "info">("laps");
  useGestureReceiver((action) => {
    if (action === "select") {
      setSelectedId((id) => entries[(entries.findIndex((c) => c.id === id) + 1) % entries.length].id);
      return true;
    }
    if (action === "inspect") {
      setDrawer("laps");
      replay.setSpeed(0.5);
      return true;
    }
    return false;
  });
  const selected = cars.find((c) => c.id === selectedId) ?? cars[0];
  const number = Number(selected.number);
  const identity = identities.get(number)!;
  const status = trackStatusAt(file.raceControl, time * 1000);
  const weather = weatherAt(file.weather, time * 1000);
  const race = file.slug === "race";
  const ordered = [...cars].sort((a, b) => a.position - b.position);
  const bests = cars.map((c) => c.bestLap).filter((v): v is number => v !== null);
  const sessionBest = bests.length ? Math.min(...bests) : null;
  const bestHolder = cars.find((c) => c.bestLap === sessionBest);
  const totalLaps = race ? Math.max(0, ...file.laps.map((l) => l.n)) : undefined;
  const leaderLap = race ? Math.min(totalLaps!, Math.max(1, ordered[0]?.lap ?? 1)) : undefined;
  const leaderBest = ordered[0]?.bestLap ?? null;
  // Stable props for the memoised 3D scene (the clock ticks this component 10× a second).
  const scene = useMemo(() => ({ entries, sample }), [entries, sample]);
  const tags = useMemo(
    () => entries.map((e) => identities.get(Number(e.number))!.code),
    [entries, identities],
  );
  const wet = (weather?.rain ?? 0) > 0;
  const lapRows = file.laps
    .filter((l) => l.d === number && l.t !== null && l.dur && l.t + l.dur * 1000 <= time * 1000)
    .sort((a, b) => b.n - a.n)
    .slice(0, 14);
  const utcClock = (ms: number) => new Date(Date.parse(file.t0) + ms).toISOString().slice(11, 19);
  return (
    <div className="app bc rec">
      <header className="bc-header">
        <div className="identity">
          <div className="svl-logo">
            <img src="/assets/brands/svl-concept.png" alt="Sepang Vision Lab" />
          </div>
        </div>
        <div className="bc-header-session">
          <span className="bc-circuit">Sepang · {file.sessionName}</span>
          {picker}
          <span className="bc-session-pill rec-pill">
            <span className="live-dot" /> {RECORDED_LABEL}
          </span>
          <span className="bc-clock" data-testid="session-clock">
            {clockText(time * 1000)}
          </span>
          <b className="bc-speed">{speed}×</b>
          <ThemeToggle />
          <button className="bc-hands-button" aria-pressed={handsOpen} onClick={onHands}>
            Hands
          </button>
        </div>
      </header>
      <main id="race-view" tabIndex={-1} className="race-workspace bc-stage">
        <section className="viewport bc-viewport" aria-label="Sepang circuit with recorded car positions">
          <CircuitScene
            clock={replay.clock}
            session={scene}
            sessionLabel={RECORDED_LABEL}
            selectedId={selectedId}
            onSelect={setSelectedId}
            tags={tags}
            wet={wet}
          />
          <Standings
            cars={cars}
            definitions={entries}
            selectedId={selectedId}
            onSelect={setSelectedId}
            previous={previous}
            lap={leaderLap}
            totalLaps={totalLaps}
            label="Recorded classification"
            identity={(car) => identities.get(Number(car.number))!}
            gap={(car, _ahead, leader, mode) => {
              const c = car as RecordedCarState;
              if (car.id === leader.id) return "Leader";
              if (race) return (mode === "interval" ? c.intervalText : c.gapText) ?? "";
              return c.bestLap !== null && leaderBest !== null
                ? "+" + (c.bestLap - leaderBest).toFixed(3)
                : "No time";
            }}
            extras={(car) => {
              const c = car as RecordedCarState;
              return {
                best: c.bestLap === null ? "" : formatLap(c.bestLap),
                sessionBest: c.bestLap !== null && c.bestLap === sessionBest,
                pit: c.inPit && c.present, // shown as a PIT badge; "In pit lane" on the card
                stale: c.stale,
              };
            }}
            footer={
              sessionBest !== null && bestHolder ? (
                <p className="rec-session-best">
                  Session best{" "}
                  <strong>
                    {identities.get(Number(bestHolder.number))!.code} {formatLap(sessionBest)}
                  </strong>
                </p>
              ) : null
            }
            note={ATTRIBUTION}
          />
          <MiniMap cars={cars} definitions={entries} selectedId={selectedId} onSelect={setSelectedId} />
          <WeatherStrip weather={weather} />
          <RecordedTelemetryCard car={selected} driver={identity} color={identity.color} />
          <RaceControlTicker
            latest={status.latest}
            status={status.status}
            yellowSectors={status.yellowSectors}
            clock={utcClock}
          />
        </section>
        <aside className="bc-drawer" aria-label="Selected driver details">
          <div className="bc-drawer-tabs rec-tabs" role="tablist">
            <button role="tab" aria-selected={drawer === "laps"} onClick={() => setDrawer("laps")}>
              Laps
            </button>
            <button role="tab" aria-selected={drawer === "info"} onClick={() => setDrawer("info")}>
              Session
            </button>
          </div>
          {drawer === "laps" ? (
            <section className="inspector rec-laps-list" aria-label={"Laps for " + identity.name}>
              <h3>
                {identity.name} <small>{identity.team.name}</small>
              </h3>
              <table>
                <thead>
                  <tr>
                    <th>Lap</th>
                    <th>Time</th>
                    <th>S1</th>
                    <th>S2</th>
                    <th>S3</th>
                  </tr>
                </thead>
                <tbody>
                  {lapRows.map((l) => (
                    <tr
                      key={l.n}
                      className={
                        l.dur === sessionBest ? "is-session-best" : l.dur === selected.bestLap ? "is-personal-best" : ""
                      }
                    >
                      <td>
                        {l.n}
                        {l.pitOut ? " · out" : ""}
                      </td>
                      <td>{formatLap(l.dur)}</td>
                      <td>{l.s1?.toFixed(3) ?? "—"}</td>
                      <td>{l.s2?.toFixed(3) ?? "—"}</td>
                      <td>{l.s3?.toFixed(3) ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {lapRows.length === 0 && <p className="note">No completed laps yet at this time.</p>}
            </section>
          ) : (
            <section className="inspector rec-info" aria-label="Session information">
              <dl className="inspector-values">
                <div>
                  <dt>Session</dt>
                  <dd>{file.sessionName}</dd>
                </div>
                <div>
                  <dt>Starts (UTC)</dt>
                  <dd>{file.t0.slice(0, 10)}</dd>
                </div>
                <div>
                  <dt>Replay time</dt>
                  <dd>{utcClock(time * 1000)} UTC</dd>
                </div>
                <div>
                  <dt>Track status</dt>
                  <dd>{status.status}</dd>
                </div>
                <div>
                  <dt>Drivers</dt>
                  <dd>{file.drivers.length}</dd>
                </div>
              </dl>
              <p className="note">
                {RECORDED_LABEL}. Positions are OpenF1 samples (about 4 Hz) aligned to the track
                (DERIVED, RMS 3.1 m) and interpolated along the circuit; in the pit lane the aligned
                raw position is shown. A gap in the data holds the last sample for 2 s, then the car
                is marked stale. {ATTRIBUTION}
              </p>
            </section>
          )}
        </aside>
      </main>
      <div className="bc-dash">
        <RecordedTimeline
          time={time}
          duration={duration}
          t0={file.t0}
          running={running}
          speed={speed}
          markers={markers}
          start={start}
          onSeek={replay.seek}
          onToggle={replay.toggle}
          onSpeed={replay.setSpeed}
        />
      </div>
      <footer className="bc-footer rec-footer">
        <span>{ATTRIBUTION}</span>
        <span>Driver and team names are shown for identification only; no team or series logos are used.</span>
      </footer>
    </div>
  );
}
