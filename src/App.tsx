import HandTrackingPanel from "./components/handtracking/HandTrackingPanel";
import { Component, useState, type ReactNode } from "react";
import HistoricalWorkspace from "./components/historical/HistoricalWorkspace";
import CircuitScene from "./components/circuit/CircuitScene";
import Standings from "./components/standings/Standings";
import CarInspector from "./components/driver/CarInspector";
import TelemetryPanel from "./components/telemetry/TelemetryPanel";
import {
  sampleRace,
  sampleTelemetry,
  type ReplayData,
} from "./services/raceState";
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
      {mode === "historical" ? <HistoricalWorkspace /> : <SyntheticApp />}
      <HandTrackingPanel key={mode} />
    </>
  );
}
function SyntheticApp() {
  return (
    <SessionLoader>{(data) => <RaceWorkspace data={data} />}</SessionLoader>
  );
}
function RaceWorkspace({ data }: { data: ReplayData }) {
  const syntheticCars = data.entries;
  const replay = useReplay();
  const { time, running, speed } = replay;
  const cars = sampleRace(data, time);
  const [selectedId, setSelectedId] = useState("car-07");
  const selected = cars.find((car) => car.id === selectedId)!;
  const definition = syntheticCars.find((car) => car.id === selectedId)!;
  const leader = cars.find((car) => car.position === 1)!;
  const leaderDefinition = syntheticCars.find((car) => car.id === leader.id)!;
  return (
    <div className="app">
      <header>
        <div className="identity">
          <div className="svl-logo">
            <img src="/assets/brands/svl-concept.png" alt="Sepang Vision Lab" />
          </div>
          <div className="system-subtitle">RACE INTELLIGENCE SYSTEM</div>
        </div>
        <div className="session">
          <span className="live-dot" /> SYNTHETIC REPLAY <b>{speed}×</b>
        </div>
      </header>
      <div className="workspace-heading">
        <div>
          <span className="eyebrow">RACE WORKSPACE</span>
          <h1 className="circuit-title">
            Sepang International Circuit <span>/ REPLAY FIELD</span>
          </h1>
        </div>
        <span className="tag">SYNTHETIC</span>
      </div>
      <main className="race-workspace">
        <Standings
          cars={cars}
          definitions={syntheticCars}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
        <section
          className="viewport"
          aria-label="Sepang circuit with 20 selectable synthetic cars"
        >
          <div className="view-top">
            <span>{cars.length} CARS / CIRCUIT VIEW</span>
            <span>NORTH UP</span>
          </div>
          <SceneBoundary>
            <CircuitScene
              clock={replay.clock}
              data={data}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          </SceneBoundary>
          <div className="view-bottom">
            <span>
              <i className="live-dot" />
              {running ? "RUNNING" : "PAUSED"}
            </span>
            <span>5.543 KM · 15 TURNS</span>
          </div>
        </section>
        <CarInspector
          car={selected}
          definition={definition}
          leader={leader}
          leaderDefinition={leaderDefinition}
          running={running}
          onToggle={replay.toggle}
          onReset={() => replay.seek(0)}
        />
      </main>
      <TelemetryPanel
        number={selected.number}
        samples={sampleTelemetry(data, selectedId, time)}
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
      <footer>
        <span>
          <i className="live-dot" /> MILESTONE 07{" "}
          <b>LOCAL SESSION / NORMALIZED RACE STATE</b>
        </span>
        <a
          href="https://github.com/bacinger/f1-circuits/blob/master/circuits/my-1999.geojson"
          target="_blank"
          rel="noreferrer"
        >
          GEOMETRY: BACINGER / MIT
        </a>
      </footer>
      <div className="disclaimer">
        Sepang Vision Lab is an independent project. PETRONAS branding belongs
        to its owner. No official affiliation or endorsement is implied.
      </div>
    </div>
  );
}
