import { useGestureReceiver } from "../handtracking/GestureContext";
import {
  Component,
  memo,
  lazy,
  Suspense,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrthographicCamera } from "three";
import Circuit from "./Circuit";
import { engineeringCamera, type EngineeringView } from "./cameraView";
import {
  CAMERA_LABELS,
  CAMERA_MODES,
  applyRigAction,
  createRig,
  nextMode,
  setMode as setRigMode,
  type CameraMode,
  type CameraRigState,
} from "./cameraRig";
import { trackSize, trackCenter, trackCurve } from "./trackCurve";
import CarMarker from "../cars/CarMarker";
import {
  QUALITY,
  QUALITY_LABELS,
  QUALITY_LEVELS,
  readQuality,
  writeQuality,
  type Quality,
} from "./quality";
import { presentKeyAction, type KeyLike } from "../broadcast/presentMode";

const browserStorage = () => {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};
import PerfStats from "./PerfStats";
import { fictionalDriver } from "../../data/fictionalGrid";
import type { CarState, CarDefinition } from "../../domain/field";
import { sampleRace, type ReplayData } from "../../services/raceState";

const DriverScene = lazy(() => import("./DriverScene"));
class DriverBoundary extends Component<
  { children: ReactNode; onBack: () => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="fallback" role="alert">
        The 3D camera view could not start.{" "}
        <button onClick={this.props.onBack}>Back to engineering view</button>
      </div>
    ) : (
      this.props.children
    );
  }
}
const SpatialReferenceDebug = import.meta.env.DEV
  ? lazy(() => import("./SpatialReferenceDebug"))
  : null;
const showSpatialReferences =
  import.meta.env.DEV &&
  new URLSearchParams(window.location.search).get("spatialRefs") === "1";

interface Props {
  clock: RefObject<number>;
  data?: ReplayData;
  synthetic?: {
    entries: CarDefinition[];
    sample: (time: number) => CarState[];
    ghost?: { id: string; sample: (time: number) => CarState };
  };
  historical?: {
    entries: CarDefinition[];
    sample: (time: number) => CarState[];
    activeIds: string[];
  };
  selectedId: string;
  onSelect: (id: string) => void;
  sessionLabel?: string;
  /** Broadcast tags per entry, in entry order (default: fictional codes or car numbers). */
  tags?: readonly string[];
  /** Real rainfall (recorded sessions) drives the wet look in the 3D views. */
  wet?: boolean;
}
function Scene({
  clock,
  data,
  synthetic,
  historical,
  selectedId,
  onSelect,
  view,
}: Props & { view: EngineeringView }) {
  const syntheticCars =
    historical?.entries ?? synthetic?.entries ?? data!.entries;
  const sample =
    historical?.sample ??
    synthetic?.sample ??
    ((time: number) => sampleRace(data!, time));
  const field = useRef<CarState[]>(sample(clock.current));

  const { camera, size } = useThree();
  useEffect(() => {
    if (camera instanceof OrthographicCamera) {
      camera.zoom = Math.min(
        size.width / (trackSize.x + 4),
        size.height / (trackSize.y + 4),
      );
      // Fit the rotated foundation in overview while retaining the original zoom scale ceiling.
      const a = (view.angle * Math.PI) / 180;
      const projectedWidth =
        Math.abs(Math.cos(a)) * (trackSize.x + 4.4) +
        Math.abs(Math.sin(a)) * (trackSize.y + 4.4);
      const projectedHeight =
        (Math.abs(Math.sin(a)) * (trackSize.x + 4.4) +
          Math.abs(Math.cos(a)) * (trackSize.y + 4.4)) *
          Math.cos((view.tilt * Math.PI) / 180) +
        0.15;
      camera.zoom = Math.min(
        camera.zoom,
        size.width / (projectedWidth + 1),
        size.height / (projectedHeight + 1),
      );
      camera.zoom *= view.zoom;
      const pose = engineeringCamera(view);
      camera.up.copy(pose.up);
      camera.position.copy(pose.position);
      camera.lookAt(pose.target);
      camera.updateProjectionMatrix();
    }
  }, [camera, size, view]);
  useFrame(() => {
    field.current = sample(clock.current);
  }, -1);
  return (
    <>
      <hemisphereLight args={["#ffffff", "#60756d", 2.2]} />
      <directionalLight position={[8, -12, 20]} intensity={3} />
      <Circuit />
      {showSpatialReferences && SpatialReferenceDebug && (
        <Suspense fallback={null}>
          <SpatialReferenceDebug />
        </Suspense>
      )}
      {syntheticCars.map(
        (car, index) =>
          (!historical || historical.activeIds.includes(car.id)) && (
            <CarMarker
              key={car.id}
              car={car}
              tyresKnown={!historical}
              index={index}
              field={field}
              selected={selectedId === car.id}
              onSelect={onSelect}
            />
          ),
      )}
    </>
  );
}
// Memoised: the replay clock ticks the workspace 10 times a second for its panels, but the
// 3D scene reads the clock from a ref every frame, so it only re-renders on real changes.
export default memo(CircuitScene);
function CircuitScene(props: Props) {
  const overview = (): EngineeringView => ({
    zoom: 1,
    angle: -20,
    tilt: 48,
    target: [trackCenter.x, trackCenter.y, 0],
  });
  const [view, setView] = useState<EngineeringView>(overview);
  // Ref-based rig read by the frame loop; React state only mirrors the mode for the toolbar.
  const rig = useRef<CameraRigState>(createRig());
  const [mode, setCameraMode] = useState<CameraMode>("engineering");
  const [quality, setQualityState] = useState<Quality>(() =>
    readQuality(browserStorage()),
  );
  const setQuality = (q: Quality) => {
    setQualityState(q);
    writeQuality(browserStorage(), q);
  };
  const [presenting, setPresenting] = useState(false);
  const present = (on: boolean) => {
    setPresenting(on);
    if (on) document.documentElement.dataset.present = "true";
    else delete document.documentElement.dataset.present;
  };
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const action = presentKeyAction(
        event as unknown as KeyLike,
        document.documentElement.dataset.present === "true",
      );
      if (action === "toggle")
        present(document.documentElement.dataset.present !== "true");
      if (action === "exit") present(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      delete document.documentElement.dataset.present;
    };
  }, []);
  const fullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else
      void document
        .querySelector<HTMLElement>(".bc-viewport, .viewport")
        ?.requestFullscreen?.()
        .catch(() => undefined);
  };
  const [labels, setLabels] = useState(true);
  const [trails, setTrails] = useState(false);
  const changeMode = (next: CameraMode) => {
    setRigMode(rig.current, next);
    setCameraMode(next);
  };
  const focusSelected = () => {
    const cars =
      props.historical?.sample(props.clock.current) ??
      props.synthetic?.sample(props.clock.current) ??
      sampleRace(props.data!, props.clock.current);
    const selected = cars.find((c) => c.id === props.selectedId);
    if (
      !selected ||
      (props.historical && !props.historical.activeIds.includes(selected.id))
    )
      return;
    const point = trackCurve.getPointAt(selected.progress);
    setView((v) => ({ ...v, zoom: 2.5, target: [point.x, point.y, point.z] }));
  };
  const pan = (x: number, y: number) =>
    setView((v) => {
      const angle = (v.angle * Math.PI) / 180,
        step = 1.5 / v.zoom;
      return {
        ...v,
        target: [
          v.target[0] + (x * Math.cos(angle) - y * Math.sin(angle)) * step,
          v.target[1] + (x * Math.sin(angle) + y * Math.cos(angle)) * step,
          v.target[2],
        ],
      };
    });
  const zoom = (factor: number) =>
    setView((v) => ({
      ...v,
      zoom: Math.min(2.5, Math.max(0.75, v.zoom * factor)),
    }));
  const rotate = (delta: number) =>
    setView((v) => ({ ...v, angle: ((v.angle + delta + 540) % 360) - 180 }));
  useGestureReceiver((action) => {
    if (action === "cycleCamera") {
      changeMode(nextMode(mode));
      return true;
    }
    // Inspect also opens the inspector and slows the replay (handled by the workspace).
    if (action === "inspect") {
      changeMode("inspect");
      return true;
    }
    const camera =
      action === "zoomIn" ||
      action === "zoomOut" ||
      action === "rotateLeft" ||
      action === "rotateRight";
    if (camera && mode !== "engineering")
      return applyRigAction(rig.current, action);
    if (action === "zoomIn" || action === "zoomOut") {
      zoom(action === "zoomIn" ? 1.2 : 1 / 1.2);
      return true;
    }
    if (action === "rotateLeft" || action === "rotateRight") {
      rotate(action === "rotateLeft" ? -15 : 15);
      return true;
    }
    return false;
  });
  return (
    <div className="circuit-view-controls">
      <div
        className="circuit-camera-toolbar"
        aria-label="Circuit view controls"
      >
        <span role="group" aria-label="Camera mode" className="camera-modes">
          {CAMERA_MODES.map((m) => (
            <button
              key={m}
              aria-pressed={mode === m}
              onClick={() => changeMode(m)}
            >
              {CAMERA_LABELS[m]}
            </button>
          ))}
        </span>
        {mode !== "engineering" && (
          <>
            <button
              onClick={() => applyRigAction(rig.current, "zoomIn")}
              disabled={mode === "onboard"}
            >
              Zoom +
            </button>
            <button
              onClick={() => applyRigAction(rig.current, "zoomOut")}
              disabled={mode === "onboard"}
            >
              Zoom −
            </button>
            <button
              aria-label="Orbit left"
              onClick={() => applyRigAction(rig.current, "rotateLeft")}
              disabled={mode === "tv"}
            >
              ⟲
            </button>
            <button
              aria-label="Orbit right"
              onClick={() => applyRigAction(rig.current, "rotateRight")}
              disabled={mode === "tv"}
            >
              ⟳
            </button>
            <label className="quality-select">
              <span className="visually-hidden">Quality</span>
              <select
                aria-label="Rendering quality"
                value={quality}
                onChange={(e) => setQuality(e.target.value as Quality)}
              >
                {QUALITY_LEVELS.map((q) => (
                  <option key={q} value={q}>
                    {QUALITY_LABELS[q]}
                  </option>
                ))}
              </select>
            </label>
            <button aria-label="Fullscreen viewport" onClick={fullscreen}>
              ⤢
            </button>
            <button
              aria-pressed={presenting}
              onClick={() => present(!presenting)}
              title="Present mode (P)"
            >
              Present <kbd>P</kbd>
            </button>
            <span className="view-toggles" role="group" aria-label="Overlays">
              <button
                className="toggle"
                aria-pressed={labels}
                onClick={() => setLabels((v) => !v)}
              >
                Labels
              </button>
              <button
                className="toggle"
                aria-pressed={trails}
                onClick={() => setTrails((v) => !v)}
              >
                Trails
              </button>
            </span>
          </>
        )}
        {mode === "engineering" && (
          <>
            <button onClick={() => zoom(1.2)}>Zoom +</button>
            <button onClick={() => zoom(1 / 1.2)}>Zoom −</button>
            <button onClick={() => rotate(-15)}>Rotate −15°</button>
            <button onClick={() => rotate(15)}>Rotate +15°</button>
            <button onClick={() => setView(overview())}>Reset view</button>
            <button
              aria-pressed={view.tilt === 48}
              onClick={() => setView((v) => ({ ...v, tilt: 48 }))}
            >
              3D view
            </button>
            <button
              aria-pressed={view.tilt === 0}
              onClick={() => setView((v) => ({ ...v, tilt: 0 }))}
            >
              Top view
            </button>
            <button onClick={focusSelected}>Focus selected</button>
            <button aria-label="Pan left" onClick={() => pan(-1, 0)}>
              ←
            </button>
            <button aria-label="Pan right" onClick={() => pan(1, 0)}>
              →
            </button>
            <button aria-label="Pan up" onClick={() => pan(0, 1)}>
              ↑
            </button>
            <button aria-label="Pan down" onClick={() => pan(0, -1)}>
              ↓
            </button>
            <span data-testid="circuit-view-state">
              {view.zoom.toFixed(2)}× / {view.angle}° /{" "}
              {view.tilt === 0 ? "TOP" : "3D"}
            </span>
          </>
        )}
      </div>
      <span className="circuit-accuracy-note">
        {props.sessionLabel && <>{props.sessionLabel} · </>}
        Flat elevation · illustrative track surroundings
      </span>
      {mode !== "engineering" ? (
        <DriverBoundary onBack={() => changeMode("engineering")}>
          <Suspense
            fallback={
              <div className="fallback" role="status">
                Loading driver view…
              </div>
            }
          >
            <DriverScene
              clock={props.clock}
              entries={
                props.historical?.entries ??
                props.synthetic?.entries ??
                props.data!.entries
              }
              sample={
                props.historical?.sample ??
                props.synthetic?.sample ??
                ((time: number) => sampleRace(props.data!, time))
              }
              activeIds={props.historical?.activeIds}
              tags={props.tags ?? (
                props.historical?.entries ??
                props.synthetic?.entries ??
                props.data!.entries
              ).map((car, i) =>
                props.synthetic
                  ? fictionalDriver(i, car.number).code
                  : "#" + car.number,
              )}
              ghost={props.synthetic?.ghost}
              wet={props.wet}
              tyresKnown={!props.historical}
              selectedId={props.selectedId}
              onSelect={props.onSelect}
              rig={rig}
              mode={mode}
              labels={labels}
              trails={trails}
              quality={QUALITY[quality]}
            />
          </Suspense>
        </DriverBoundary>
      ) : (
        <Canvas
          orthographic
          camera={{ position: [0, 0, 30], zoom: 35, near: 0.1, far: 100 }}
          dpr={[1, 2]}
          fallback={
            <div className="fallback">
              WebGL is unavailable. Enable browser hardware acceleration to view
              the circuit.
            </div>
          }
        >
          <Scene {...props} view={view} />
        <PerfStats />
        </Canvas>
      )}
    </div>
  );
}
