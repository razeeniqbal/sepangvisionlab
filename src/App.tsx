import {
  GestureProvider,
  useGestureReceiver,
} from "./components/handtracking/GestureContext";
import HandTrackingPanel from "./components/handtracking/HandTrackingPanel";
import { Component, useMemo, useState, type ReactNode } from "react";
import HistoricalWorkspace from "./components/historical/HistoricalWorkspace";
import CircuitScene from "./components/circuit/CircuitViewport";
import WorkspaceNav from "./components/WorkspaceNav";
import Standings from "./components/standings/Standings";
import CarInspector from "./components/driver/CarInspector";
import TelemetryPanel from "./components/telemetry/TelemetryPanel";
import type { ReplayData } from "./services/raceState";
import {
  ghostCarAtTime,
  ghostGap,
  physicsFieldAtTime,
  physicsTelemetryAtTime,
  withPhysicsSetups,
} from "./domain/physicsField";
import type { CarSetup } from "./domain/lapPhysics";
import { formatTime, lapMarkers } from "./domain/replay";
import { formatLap, lastFullLapSeconds } from "./domain/inspection";
import { fictionalDriver } from "./data/fictionalGrid";
import MiniMap from "./components/broadcast/MiniMap";
import LowerThird from "./components/broadcast/LowerThird";
import SetupDrawer from "./components/broadcast/SetupDrawer";
import { sepangPace } from "./data/sepangPace";
import SessionLoader from "./components/session/SessionLoader";
import useReplay from "./hooks/useReplay";
import Timeline from "./components/timeline/Timeline";

class SceneBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="fallback">
        The 3D scene could not start. Please reload with WebGL enabled.
      </div>
    ) : (
      this.props.children
    );
  }
}
export default function App() {
  const [mode, setMode] = useState("historical");
  return (
    <>
      <nav className="session-switch" aria-label="Session selection">
        <button
          aria-pressed={mode === "historical"}
          onClick={() => setMode("historical")}
        >
          2017 Malaysian Grand Prix
        </button>
        <button
          aria-pressed={mode === "synthetic"}
          onClick={() => setMode("synthetic")}
        >
          Synthetic development session
        </button>
      </nav>
      <WorkspaceNav historical={mode === "historical"} />
      <GestureProvider key={mode}>
        {mode === "historical" ? <HistoricalWorkspace /> : <SyntheticApp />}
        <HandTrackingPanel />
      </GestureProvider>
    </>
  );
}
function SyntheticApp() {
  return (
    <SessionLoader>{(data) => <RaceWorkspace data={data} />}</SessionLoader>
  );
}
function RaceWorkspace({ data }: { data: ReplayData }) {
  // The service supplies the entries; motion comes from the lap physics model.
  const baseline = useMemo(
    () => withPhysicsSetups(data.entries, sepangPace),
    [data],
  );
  // Setup drawer edits, keyed by car id. Applying one re-solves only that car's lap.
  const [overrides, setOverrides] = useState<Record<string, CarSetup>>({});
  const [ghost, setGhost] = useState<{ carId: string; setup: CarSetup } | null>(
    null,
  );
  const [drawer, setDrawer] = useState<"inspector" | "setup">("inspector");
  const syntheticCars = useMemo(
    () =>
      withPhysicsSetups(
        baseline.map((entry) => {
          const setup = overrides[entry.id];
          return setup ? { ...entry, setup, compound: setup.compound } : entry;
        }),
        sepangPace,
      ),
    [baseline, overrides],
  );
  const sample = useMemo(
    () => (t: number) => physicsFieldAtTime(syntheticCars, sepangPace, t),
    [syntheticCars],
  );
  const replay = useReplay();
  const { time, running, speed } = replay;
  const cars = sample(time);
  const previous = new Map(
    sample(Math.max(0, time - 10)).map((car) => [car.id, car.position]),
  );
  const [selectedId, setSelectedId] = useState("car-07");
  useGestureReceiver((action) => {
    if (action === "select") {
      setSelectedId(
        (id) =>
          syntheticCars[
            (syntheticCars.findIndex((c) => c.id === id) + 1) %
              syntheticCars.length
          ].id,
      );
      return true;
    }
    if (action === "inspect") {
      setDrawer("inspector");
      document.querySelector(".inspector")?.scrollIntoView({ block: "center" });
      // The viewport switches to the Inspect orbit; slow the replay to look closely.
      replay.setSpeed(0.5);
      return true;
    }
    return false;
  });
  const selected = cars.find((car) => car.id === selectedId)!;
  const index = syntheticCars.findIndex((car) => car.id === selectedId);
  const definition = syntheticCars[index];
  const driver = fictionalDriver(index, definition.number);
  const leader = cars.find((car) => car.position === 1)!;
  const leaderDefinition = syntheticCars.find((car) => car.id === leader.id)!;
  const ghostDefinition = ghost
    ? syntheticCars.find((car) => car.id === ghost.carId)
    : undefined;
  const ghostSample = useMemo(
    () =>
      ghost && ghostDefinition
        ? {
            id: ghost.carId,
            sample: (t: number) =>
              ghostCarAtTime(ghostDefinition, ghost.setup, sepangPace, t),
          }
        : undefined,
    [ghost, ghostDefinition],
  );
  const gap =
    ghost && ghost.carId === selectedId
      ? ghostGap(definition, ghost.setup, sepangPace, time)
      : null;
  const last = lastFullLapSeconds(selected, definition);
  const totalLaps = lapMarkers(leaderDefinition).length;
  return (
    <div className="app bc">
      <header className="bc-header">
        <div className="identity">
          <div className="svl-logo">
            <img src="/assets/brands/svl-concept.png" alt="Sepang Vision Lab" />
          </div>
        </div>
        <div className="bc-header-session">
          <span className="bc-circuit">Sepang International Circuit</span>
          <span className="bc-session-pill">
            <span className="live-dot" /> Simulated session · physics pace
          </span>
          <span className="bc-clock" data-testid="session-clock">
            {formatTime(time)}
          </span>
          <b className="bc-speed">{speed}×</b>
        </div>
      </header>
      <main id="race-view" tabIndex={-1} className="race-workspace bc-stage">
        <section
          className="viewport bc-viewport"
          aria-label="Sepang circuit with 20 selectable simulated cars"
        >
          <SceneBoundary>
            <CircuitScene
              clock={replay.clock}
              synthetic={{ entries: syntheticCars, sample, ghost: ghostSample }}
              sessionLabel="Simulated session · physics pace"
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          </SceneBoundary>
          <Standings
            cars={cars}
            definitions={syntheticCars}
            selectedId={selectedId}
            onSelect={setSelectedId}
            previous={previous}
            lap={Math.min(totalLaps, leader.completedLaps + 1)}
            totalLaps={totalLaps}
          />
          <MiniMap
            cars={cars}
            definitions={syntheticCars}
            selectedId={selectedId}
            ghost={ghostSample?.sample(time)}
            onSelect={setSelectedId}
          />
          <LowerThird
            car={selected}
            driver={driver}
            color={definition.color}
            lastLap={formatLap(last)}
            ghostGap={gap}
          />
        </section>
        <aside className="bc-drawer" aria-label="Selected car details">
          <div className="bc-drawer-tabs" role="tablist">
            <button
              role="tab"
              aria-selected={drawer === "inspector"}
              onClick={() => setDrawer("inspector")}
            >
              Inspector
            </button>
            <button
              role="tab"
              aria-selected={drawer === "setup"}
              onClick={() => setDrawer("setup")}
            >
              Car setup
            </button>
          </div>
          {drawer === "inspector" ? (
            <CarInspector
              car={selected}
              definition={definition}
              leader={leader}
              leaderDefinition={leaderDefinition}
              running={running}
              onToggle={replay.toggle}
              onReset={() => replay.seek(0)}
              driver={driver}
            />
          ) : (
            <SetupDrawer
              number={definition.number}
              setup={definition.setup!}
              baseline={baseline[index].setup!}
              ghost={ghost?.carId === selectedId ? ghost.setup : null}
              ghostGap={gap}
              onChange={(setup) =>
                setOverrides((o) => ({ ...o, [selectedId]: setup }))
              }
              onReset={() =>
                setOverrides((o) => {
                  const next = { ...o };
                  delete next[selectedId];
                  return next;
                })
              }
              onSaveGhost={() =>
                setGhost({ carId: selectedId, setup: definition.setup! })
              }
              onClearGhost={() => setGhost(null)}
            />
          )}
        </aside>
      </main>
      <div className="bc-dash">
        <TelemetryPanel
          number={selected.number}
          samples={physicsTelemetryAtTime(definition, sepangPace, time)}
          running={running}
        />
        <Timeline
          time={time}
          running={running}
          speed={speed}
          car={definition}
          lap={selected.completedLaps + 1}
          onSeek={replay.seek}
          onToggle={replay.toggle}
          onSpeed={replay.setSpeed}
        />
      </div>
      <footer>
        <span>
          <i className="live-dot" /> Milestone 18{" "}
          <b>Local session · physics pace</b>
        </span>
        <a
          href="https://github.com/bacinger/f1-circuits/blob/master/circuits/my-1999.geojson"
          target="_blank"
          rel="noreferrer"
        >
          Geometry: Bacinger / MIT
        </a>
      </footer>
      <div className="disclaimer">
        Sepang Vision Lab is an independent project. PETRONAS branding belongs
        to its owner. No official affiliation or endorsement is implied. Driver
        names and teams in the simulated session are fictional.
      </div>
    </div>
  );
}
