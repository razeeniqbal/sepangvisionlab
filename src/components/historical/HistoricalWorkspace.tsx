import { useGestureReceiver } from "../handtracking/GestureContext";
import { useEffect, useState } from "react";
import StrategyLab from "./StrategyLab";
import StintAnalysisPanel from "./StintAnalysisPanel";
import LapPredictionPanel from "./LapPredictionPanel";
import CircuitScene from "../circuit/CircuitViewport";
import useReplay from "../../hooks/useReplay";
import {
  parseHistorical,
  historicalState,
  historicalTime,
  markerEntries,
  markerStates,
  type HistoricalReplay,
} from "../../services/historical";
import { formatLap } from "../../domain/inspection";
export default function HistoricalWorkspace() {
  const [data, setData] = useState<HistoricalReplay | null>(null),
    [error, setError] = useState(false),
    [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setError(false);
    const timer = setTimeout(() => controller.abort(), 15000);
    fetch("/api/v2/sessions/malaysia-2017/replay", {
      signal: controller.signal,
    })
      .then((r) => {
        if (!r.ok) throw Error();
        return r.json();
      })
      .then(parseHistorical)
      .then((d) => {
        if (active) setData(d);
      })
      .catch(() => {
        if (active) setError(true);
      })
      .finally(() => clearTimeout(timer));
    return () => {
      active = false;
      controller.abort();
      clearTimeout(timer);
    };
  }, [attempt]);
  if (!data)
    return (
      <div className="session-loading">
        <h1>
          {error ? "Historical session unavailable" : "Loading historical race"}
        </h1>
        <p>2017 Malaysian Grand Prix · local timing archive</p>
        {error && (
          <button onClick={() => setAttempt((a) => a + 1)}>
            Retry historical session
          </button>
        )}
      </div>
    );
  return <HistoricalRace data={data} />;
}
function HistoricalRace({ data }: { data: HistoricalReplay }) {
  const replay = useReplay(data.duration, false);
  const [selectedId, setSelectedId] = useState("max_verstappen");
  useGestureReceiver((action) => {
    if (action === "select") {
      const ordered = [...data.drivers].sort((a, b) => a.grid - b.grid);
      setSelectedId(
        (id) =>
          ordered[(ordered.findIndex((d) => d.id === id) + 1) % ordered.length]
            .id,
      );
      return true;
    }
    if (action === "inspect") {
      document.querySelector(".inspector")?.scrollIntoView({ block: "center" });
      return true;
    }
    if (action === "strategy") {
      document
        .querySelector(".strategy-panel")
        ?.scrollIntoView({ block: "start" });
      return true;
    }
    return false;
  });
  const selected = data.drivers.find((d) => d.id === selectedId)!;
  const state = historicalState(selected, replay.time);
  const entries = markerEntries(data);
  const activeIds = data.drivers
    .filter((d) => historicalState(d, replay.time).active)
    .map((d) => d.id);
  return (
    <div className="app historical-app">
      <header>
        <div className="svl-logo">
          <img src="/assets/brands/svl-concept.png" alt="Sepang Vision Lab" />
        </div>
        <div className="session">
          HISTORICAL LAP TIMING <b>{replay.speed}×</b>
        </div>
      </header>
      <div className="workspace-heading">
        <div>
          <span className="eyebrow">{data.date} · SEPANG</span>
          <h1>{data.title}</h1>
        </div>
        <span className="tag">RECONSTRUCTED MOVEMENT</span>
      </div>
      <p className="historical-note">
        Recorded lap times and pit-stop records from Jolpica. Movement is
        interpolated between timing lines, not GPS. Cars disappear after their
        last recorded lap; their stopping locations are unknown.
      </p>
      <main id="race-view" tabIndex={-1} className="race-workspace">
        <section
          className="standings-panel"
          aria-label="Historical driver list"
        >
          <div className="panel-heading">
            DRIVERS <span>GRID ORDER</span>
          </div>
          <ol className="standings-list">
            {[...data.drivers]
              .sort((a, b) => a.grid - b.grid)
              .map((d) => (
                <li key={d.id}>
                  <button
                    className="historical-driver"
                    aria-pressed={d.id === selectedId}
                    onClick={() => setSelectedId(d.id)}
                    aria-label={`Select ${d.name}`}
                  >
                    <b>#{d.number}</b>
                    <span>
                      {d.name}
                      <small>{d.team}</small>
                    </span>
                  </button>
                </li>
              ))}
          </ol>
          <p className="standings-note">
            Grid order remains fixed. Final classification is shown only at
            session end.
          </p>
        </section>
        <section
          className="viewport"
          aria-label="Historical Sepang reconstruction"
        >
          <div className="view-top">
            <span>{activeIds.length} CARS WITH TIMING COVERAGE</span>
            <span>ADJUSTABLE CIRCUIT VIEW</span>
          </div>
          <CircuitScene
            clock={replay.clock}
            historical={{
              entries,
              sample: (time) => markerStates(data, time),
              activeIds,
            }}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
          <div className="view-bottom">
            <span>{replay.running ? "PLAYING" : "PAUSED"}</span>
            <span>LINEAR LAP RECONSTRUCTION</span>
          </div>
        </section>
        <aside
          className="inspector"
          aria-label={`Historical inspector for ${selected.name}`}
        >
          <div className="panel-heading">HISTORICAL DRIVER</div>
          <h2>
            #{selected.number} {selected.name}
          </h2>
          <p>{selected.team}</p>
          <dl className="inspector-values">
            <div>
              <dt>Timing coverage</dt>
              <dd>{state.status}</dd>
            </div>
            <div>
              <dt>Completed laps</dt>
              <dd data-testid="historical-laps">{state.completedLaps}</dd>
            </div>
            <div>
              <dt>Last recorded position</dt>
              <dd>
                {state.recordedPosition ? `P${state.recordedPosition}` : "—"}
              </dd>
            </div>
            <div>
              <dt>Last recorded lap</dt>
              <dd>{formatLap(state.lastLap)}</dd>
            </div>
            <div>
              <dt>Lap-average speed · derived</dt>
              <dd>{state.lapAverageKph?.toFixed(1) ?? "—"} km/h</dd>
            </div>
            <div>
              <dt>Throttle / brake / tyres</dt>
              <dd>Unavailable</dd>
            </div>
            {replay.time >= data.duration && (
              <>
                <div>
                  <dt>Final classification</dt>
                  <dd>P{selected.classification}</dd>
                </div>
                <div>
                  <dt>Official result status</dt>
                  <dd>{selected.status}</dd>
                </div>
              </>
            )}
          </dl>
          <p className="note">
            Last recorded positions belong to each driver’s latest timing-line
            crossing, not a simultaneous live classification. Lap-average speed
            includes pit time.
          </p>
        </aside>
      </main>
      <section
        id="race-replay"
        tabIndex={-1}
        className="timeline-panel"
        aria-label="Historical replay controls"
      >
        <div className="timeline-heading">
          <h2>2017 MALAYSIA / RACE REPLAY</h2>
          <strong data-testid="historical-time">
            {historicalTime(replay.time)} / {historicalTime(data.duration)}
          </strong>
        </div>
        <div className="timeline-controls">
          <button onClick={() => replay.seek(0)}>
            Reset historical replay
          </button>
          <button onClick={() => replay.seek(replay.time - 10)}>−10s</button>
          <button className="primary" onClick={replay.toggle}>
            {replay.running
              ? "Pause historical replay"
              : "Play historical replay"}
          </button>
          <button onClick={() => replay.seek(replay.time + 10)}>+10s</button>
          <label>
            Speed{" "}
            <select
              aria-label="Historical playback speed"
              value={replay.speed}
              onChange={(e) => replay.setSpeed(Number(e.target.value))}
            >
              {[0.5, 1, 2, 5, 10].map((s) => (
                <option key={s} value={s}>
                  {s}×
                </option>
              ))}
            </select>
          </label>
          <label>
            Jump to lap{" "}
            <select
              aria-label="Historical lap jump"
              value={Math.min(state.completedLaps + 1, selected.laps) || 0}
              disabled={!selected.laps}
              onChange={(e) =>
                replay.seek(
                  Number(e.target.value) === 1
                    ? 0
                    : selected.timing[Number(e.target.value) - 2].endTime,
                )
              }
            >
              {!selected.laps ? (
                <option value="0">No recorded laps</option>
              ) : (
                selected.timing.map((l) => (
                  <option value={l.lap} key={l.lap}>
                    Lap {l.lap}
                  </option>
                ))
              )}
            </select>
          </label>
        </div>
        <input
          type="range"
          className="replay-slider"
          aria-label="Historical session time"
          min="0"
          max={data.duration}
          step="0.001"
          value={replay.time}
          onChange={(e) => replay.seek(Number(e.target.value))}
        />
        <p>
          Seeking pauses playback. Race-control messages and exact pit
          entry/exit times are unavailable.
        </p>
      </section>
      <section id="race-analysis" tabIndex={-1} className="historical-records">
        <h2>{selected.name} / RECORDED LAPS</h2>
        <p>
          Click a lap to inspect its completion. Future lap records are
          available for analysis.
        </p>
        <div className="lap-records">
          {selected.timing.map((l) => (
            <button
              key={l.lap}
              onClick={() => replay.seek(l.endTime)}
              aria-label={`Inspect ${selected.name} lap ${l.lap}`}
            >
              <b>L{l.lap}</b> {formatLap(l.seconds)}{" "}
              <small>P{l.position}</small>
            </button>
          ))}
        </div>
        <h3>Pit-stop records</h3>
        <p>
          {selected.pits.length
            ? selected.pits
                .map((p) => `Lap ${p.lap}: ${p.duration.toFixed(3)}s`)
                .join(" · ")
            : "No pit stops in the source records."}
        </p>
      </section>
      <StintAnalysisPanel
        key={selected.id}
        driverId={selected.id}
        driverName={selected.name}
        completed={state.completedLaps}
      />
      <LapPredictionPanel
        driver={selected}
        time={replay.time}
        completed={state.completedLaps}
        onSeek={replay.seek}
      />
      <StrategyLab driver={selected} completed={state.completedLaps} />
      <footer>
        <span>SEPANG VISION LAB · HISTORICAL WORKSPACE</span>
        <a
          href="https://github.com/jolpica/jolpica-f1"
          target="_blank"
          rel="noreferrer"
        >
          SOURCE: JOLPICA F1
        </a>
      </footer>
      <p className="disclaimer">
        Independent project. Driver and team identities follow the historical
        source. Circuit geometry: Bacinger / MIT. No official affiliation.
      </p>
    </div>
  );
}
