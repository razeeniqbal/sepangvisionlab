import { useCallback, useEffect, useMemo, useState } from "react";
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
import Icon from "../ui/Icon";
import Popover from "../ui/Popover";
import DriveHud from "./DriveHud";
import PickWinner, { PickResult } from "./PickWinner";
import QuickGuide from "./QuickGuide";
import CompareTab from "./CompareTab";
import { ghostTime } from "../../domain/compare";
import { buildShare, parseShare } from "../../domain/share";
import { rainingAt, wetnessAt } from "../../domain/wetness";
import useEngineSound from "../../hooks/useEngineSound";
import { CAMERA_MODES } from "../circuit/cameraRig";

// A shared link (#s=race&t=9697&d=3&cam=chase), read once when the app opens.
const shared = parseShare(typeof window === "undefined" ? "" : window.location.hash);
const sharedCamera = CAMERA_MODES.find((m) => m === shared.camera);
import { motionAt } from "../../domain/recordedSession";
import { guideSeen, markGuideSeen } from "./guideStorage";
import { pickLocked, pickOutcome, readPick, writePick } from "../../domain/pick";
import type { CameraMode } from "../circuit/cameraRig";

const browserStorage = () => {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

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
  const [slug, setSlug] = useState(shared.slug ?? "race");
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
    <div className="sv-segmented sv-sessions" role="tablist" aria-label="Session">
      {(index?.sessions ?? Object.keys(SHORT).map((s) => ({ slug: s, name: SHORT[s] }))).map((s) => (
        <button
          key={s.slug}
          role="tab"
          aria-selected={s.slug === slug}
          onClick={() => {
            // Choosing a session ends the shared link's hold on the time and driver.
            shared.time = undefined;
            shared.driver = undefined;
            setSlug(s.slug);
          }}
        >
          {SHORT[s.slug] ?? s.name}
        </button>
      ))}
    </div>
  );
  if (!session) {
    const pct = progress[1] ? Math.round((progress[0] / progress[1]) * 100) : 4;
    return (
      <div className="sv-app sv-loading">
        <div className="sv-loading-card glass" role="status" aria-live="polite">
          <div className="svl-logo" role="img" aria-label="Sepang Vision Lab">
            <img src="/assets/brands/svl-concept.png" alt="" />
          </div>
          <h1>{error ? "Session unavailable" : "Sepang 2026 · " + (SHORT[slug] ?? slug)}</h1>
          <p>
            {error ||
              (progress[1]
                ? `Aligning ${progress[0]} of ${progress[1]} cars to the track`
                : "Fetching OpenF1 replay files")}
          </p>
          {!error && (
            <div className="sv-progress" aria-hidden="true">
              <i style={{ width: pct + "%" }} />
            </div>
          )}
          {picker}
          <p className="sv-muted">{ATTRIBUTION}</p>
        </div>
      </div>
    );
  }
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
    // A shared link opens at its own time in the session it names (until another is chosen).
    const linked = shared.time !== undefined && (shared.slug ?? "race") === file.slug;
    replay.seek(linked ? shared.time! : start, true);
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
    const linked = shared.driver !== undefined && entries.find((e) => e.number === String(shared.driver));
    if (linked) return linked.id;
    const leader = [...cars].sort((a, b) => a.position - b.position)[0];
    return leader?.id ?? entries[0].id;
  });
  const [drawer, setDrawer] = useState<"laps" | "compare" | "info">("laps");
  const [rivalChoice, setRival] = useState<number | null>(null);
  const [ghostOn, setGhostOn] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [cameraMode, setCameraMode] = useState<CameraMode>(sharedCamera ?? "tv");
  const [copied, setCopied] = useState(false);
  const [sound, setSound] = useState(false);
  const copyLink = () => {
    const url = buildShare(window.location.origin, {
      slug: file.slug,
      time,
      driver: number,
      camera: cameraMode,
    });
    window.history.replaceState(null, "", url);
    void navigator.clipboard?.writeText(url).then(
      () => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      },
      () => setCopied(false),
    );
  };
  const [pick, setPickState] = useState<number | null>(() => readPick(browserStorage(), file.sessionKey));
  const [resultClosed, setResultClosed] = useState(false);
  // Shared links open straight at their moment, without the tour.
  const [guideOpen, setGuideOpen] = useState(() => !guideSeen(browserStorage()) && shared.time === undefined);
  const closeGuide = useCallback((remember: boolean) => {
    if (remember) markGuideSeen(browserStorage());
    setGuideOpen(false);
  }, []);
  const setPick = (driver: number | null) => {
    setPickState(driver);
    setResultClosed(false);
    writePick(browserStorage(), file.sessionKey, driver);
  };
  useGestureReceiver((action) => {
    if (action === "select") {
      setSelectedId((id) => entries[(entries.findIndex((c) => c.id === id) + 1) % entries.length].id);
      return true;
    }
    if (action === "inspect") {
      setDrawer("laps");
      setPanelOpen(true);
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
  // Compare: default rival is the car one place ahead (or behind, for the leader).
  const rival =
    rivalChoice !== null && rivalChoice !== number
      ? rivalChoice
      : Number(
          (ordered.find((c) => c.position === selected.position - 1) ??
            ordered.find((c) => c.position === selected.position + 1) ??
            ordered.find((c) => c.id !== selected.id))!.number,
        );
  // Ghost: the rival at the same moment of the same lap (stable while me/rival are unchanged).
  const ghost = useMemo(() => {
    if (!ghostOn) return undefined;
    const d = session.drivers.find((x) => x.number === rival);
    if (!d) return undefined;
    return {
      id: "ghost-" + rival,
      sample: (seconds: number) => {
        const t = ghostTime(file.laps, number, rival, seconds * 1000);
        if (t === null) return null;
        const m = motionAt(d, session.track, t);
        if (!m.present) return null;
        const L = session.track.length;
        return {
          ...entries[0],
          id: "ghost-" + rival,
          number: String(rival),
          position: 0,
          progress: (((m.distance % L) + L) % L) / L,
          completedLaps: 0,
          speedKph: 0,
          compound: "UNKNOWN" as const,
          tyreAge: 0,
          pose: { x: m.x, y: m.y, heading: m.heading },
        };
      },
    };
  }, [ghostOn, session, rival, number, file.laps, entries]);
  const tags = useMemo(
    () => entries.map((e) => identities.get(Number(e.number))!.code),
    [entries, identities],
  );
  // Raining now (sky, rain, fog) and how wet the track is (sheen, spray), from OpenF1 rain
  // readings; wetness is rounded to 5% so the memoised 3D scene re-renders only on real change.
  useEngineSound(sound, selected.present ? selected.rpm : 0, selected.throttle, running);
  const wet = rainingAt(file.weather, time * 1000);
  const wetness = Math.round(wetnessAt(file.weather, time * 1000) * 20) / 20;
  const lapRows = file.laps
    .filter((l) => l.d === number && l.t !== null && l.dur && l.t + l.dur * 1000 <= time * 1000)
    .sort((a, b) => b.n - a.n)
    .slice(0, 14);
  // Pick your winner (race only): open until lights out, revealed at the chequered flag.
  const lightsOut = markers.find((m) => m.kind === "start")?.t ?? null;
  const chequered = markers.find((m) => m.kind === "chequered")?.t ?? null;
  const locked = pickLocked(time * 1000, lightsOut);
  const pickedCar = pick === null ? undefined : cars.find((c) => Number(c.number) === pick);
  const outcome =
    race && pick !== null && chequered !== null && time * 1000 >= chequered
      ? pickOutcome(file.result ?? [], pick)
      : null;
  const pickDrivers = useMemo(
    () =>
      [...identities.entries()]
        .map(([n, d]) => ({ ...d, number: n }))
        .sort((a, b) => a.code.localeCompare(b.code)),
    [identities],
  );
  const hud = cameraMode === "chase" || cameraMode === "onboard";
  const utcClock = (ms: number) => new Date(Date.parse(file.t0) + ms).toISOString().slice(11, 19);
  return (
    <div className="sv-app">
      <header className="sv-header glass">
        <div className="sv-brand">
          <div className="svl-logo" aria-hidden="true">
            <img src="/assets/brands/svl-concept.png" alt="" />
          </div>
          <div className="sv-title">
            <strong>Sepang 2026</strong>
            <span>{file.sessionName}</span>
          </div>
        </div>
        {picker}
        <div className="sv-header-end">
          {race && (
            <PickWinner
              drivers={pickDrivers}
              pick={pick}
              onPick={setPick}
              locked={locked}
              position={pickedCar?.position ?? null}
            />
          )}
          <span className="sv-status" title={RECORDED_LABEL}>
            <i aria-hidden="true" /> Recorded · OpenF1
          </span>
          <span className="sv-clock" data-testid="session-clock">
            {clockText(time * 1000)}
            <small>{utcClock(time * 1000)} UTC</small>
          </span>
          <button
            className="sv-button"
            aria-pressed={panelOpen}
            aria-controls="sv-panel"
            onClick={() => setPanelOpen((o) => !o)}
          >
            <Icon name="list" /> <span>Laps</span>
          </button>
          <Popover label="App menu" button={<Icon name="menu" />} closeOnAction>
            <div className="sv-menu-section">
              <h3>Theme</h3>
              <ThemeToggle />
            </div>
            <div className="sv-menu-section">
              <button className="sv-chip" aria-pressed={handsOpen} onClick={onHands} data-closes>
                <Icon name="hand" /> Hand tracking
              </button>
            </div>
            <div className="sv-menu-section">
              <h3>Sound</h3>
              <label className="sv-switch">
                <input type="checkbox" checked={sound} onChange={(e) => setSound(e.target.checked)} />
                <span>Engine sound for the followed car</span>
              </label>
              <p className="sv-menu-note">Synthesised from the recorded revs and throttle.</p>
            </div>
            <div className="sv-menu-section">
              <h3>Share</h3>
              <button className="sv-chip" onClick={copyLink}>
                <Icon name="list" /> {copied ? "Link copied" : "Copy link to this moment"}
              </button>
              <p className="sv-menu-note">Opens at this time, driver and camera.</p>
            </div>
            <div className="sv-menu-section">
              <button className="sv-chip" onClick={() => setGuideOpen(true)} data-closes>
                <Icon name="info" /> Guided tour
              </button>
            </div>
            <div className="sv-menu-section">
              <h3>About</h3>
              <p className="sv-menu-note">
                {RECORDED_LABEL}. {ATTRIBUTION} Driver and team names are shown for identification only;
                no team, series or sponsor logos are used.
              </p>
            </div>
          </Popover>
        </div>
      </header>
      <main id="race-view" tabIndex={-1} className="sv-stage">
        <section
          className={"sv-viewport" + (hud ? " has-hud" : "")}
          aria-label="Sepang circuit with recorded car positions"
        >
          <CircuitScene
            clock={replay.clock}
            session={scene}
            sessionLabel={RECORDED_LABEL}
            selectedId={selectedId}
            onSelect={setSelectedId}
            tags={tags}
            wet={wet}
            wetness={wetness}
            onModeChange={setCameraMode}
            initialMode={sharedCamera}
            ghost={ghost}
          />
          <Standings
            cars={cars}
            definitions={entries}
            selectedId={selectedId}
            onSelect={setSelectedId}
            previous={previous}
            lap={leaderLap}
            totalLaps={totalLaps}
            label="Classification"
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
                picked: race && pick !== null && Number(c.number) === pick,
              };
            }}
            footer={
              sessionBest !== null && bestHolder ? (
                <p className="sv-session-best">
                  <span>Session best</span>
                  <strong>
                    {identities.get(Number(bestHolder.number))!.code} {formatLap(sessionBest)}
                  </strong>
                </p>
              ) : null
            }
          />
          <div className="sv-top-right">
            <MiniMap cars={cars} definitions={entries} selectedId={selectedId} onSelect={setSelectedId} />
            <WeatherStrip weather={weather} />
          </div>
          <RaceControlTicker
            latest={status.latest}
            status={status.status}
            yellowSectors={status.yellowSectors}
            clock={utcClock}
          />
          {/* Chase and onboard show a game-style gauge in the card's corner on wide screens (the
              card is hidden by CSS there); phones keep the card and hide the gauge. */}
          <RecordedTelemetryCard car={selected} driver={identity} color={identity.color} />
          {hud && <DriveHud car={selected} code={identity.code} color={identity.color} laps={totalLaps} />}
          {outcome && !resultClosed && pick !== null && identities.get(pick) && (
            <PickResult driver={identities.get(pick)!} outcome={outcome} onClose={() => setResultClosed(true)} />
          )}
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
          <aside
            id="sv-panel"
            className={"sv-panel glass" + (panelOpen ? " is-open" : "")}
            aria-label="Driver laps and session details"
            aria-hidden={!panelOpen}
          >
            <header className="sv-panel-head">
              <div className="sv-segmented is-small" role="tablist">
                <button role="tab" aria-selected={drawer === "laps"} onClick={() => setDrawer("laps")}>
                  Laps
                </button>
                <button role="tab" aria-selected={drawer === "compare"} onClick={() => setDrawer("compare")}>
                  Compare
                </button>
                <button role="tab" aria-selected={drawer === "info"} onClick={() => setDrawer("info")}>
                  Session
                </button>
              </div>
              <button className="sv-icon-button" aria-label="Close panel" onClick={() => setPanelOpen(false)}>
                <Icon name="close" />
              </button>
            </header>
            {drawer === "laps" ? (
              <section className="sv-laps inspector" aria-label={"Laps for " + identity.name}>
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
                          {l.pitOut ? <small> out</small> : null}
                        </td>
                        <td>{formatLap(l.dur)}</td>
                        <td>{l.s1?.toFixed(3) ?? "—"}</td>
                        <td>{l.s2?.toFixed(3) ?? "—"}</td>
                        <td>{l.s3?.toFixed(3) ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {lapRows.length === 0 && <p className="sv-muted">No completed laps yet at this time.</p>}
              </section>
            ) : drawer === "compare" ? (
              <CompareTab
                session={session}
                me={number}
                rival={rival}
                onRival={setRival}
                ghost={ghostOn}
                onGhost={setGhostOn}
                time={time * 1000}
                identities={identities}
              />
            ) : (
              <section className="sv-info" aria-label="Session information">
                <dl>
                  <div>
                    <dt>Session</dt>
                    <dd>{file.sessionName}</dd>
                  </div>
                  <div>
                    <dt>Date (UTC)</dt>
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
                <p className="sv-muted">
                  Positions are OpenF1 samples (about 4 Hz) aligned to the track (DERIVED, RMS 3.1 m) and
                  interpolated along the circuit; in the pit lane the aligned raw position is shown. A gap in
                  the data holds the last sample for 2 s, then the car is marked stale.
                </p>
              </section>
            )}
          </aside>
        </section>
      </main>
      {guideOpen && <QuickGuide onClose={closeGuide} />}
      <footer className="sv-footer">
        <span>{ATTRIBUTION}</span>
        <span>Elevation derived from OpenF1 · illustrative surroundings</span>
      </footer>
    </div>
  );
}
