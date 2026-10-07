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
import Icon, { type IconName } from "../ui/Icon";
import Popover from "../ui/Popover";

const MODE_ICON: Record<CameraMode, IconName> = {
  chase: "chase",
  onboard: "onboard",
  tv: "tv",
  heli: "heli",
  inspect: "inspect",
};
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
import type { CarState, CarDefinition } from "../../domain/field";

const DriverScene = lazy(() => import("./DriverScene"));
import type { DriverSceneProps } from "./DriverScene";
class DriverBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="fallback" role="alert">
        The 3D view could not start.{" "}
        <button onClick={() => window.location.reload()}>Reload</button>
      </div>
    ) : (
      this.props.children
    );
  }
}
interface Props {
  clock: RefObject<number>;
  /** The recorded field: entries and a deterministic sampler for any replay time. */
  session: {
    entries: CarDefinition[];
    sample: (time: number) => CarState[];
  };
  selectedId: string;
  onSelect: (id: string) => void;
  sessionLabel?: string;
  /** Broadcast tags per entry (driver codes), in entry order. */
  tags: readonly string[];
  /** Real rainfall (recorded sessions) drives the wet look in the 3D views. */
  wet?: boolean;
  /** Told when the camera mode changes (the workspace shows a driving HUD in chase/onboard). */
  onModeChange?: (mode: CameraMode) => void;
  /** Camera to open with (shared links); later changes come from the dock. */
  initialMode?: CameraMode;
  /** Compare: a translucent rival car (stable identity; see DriverScene). */
  ghost?: DriverSceneProps["ghost"];
}
// Memoised: the replay clock ticks the workspace 10 times a second for its panels, but the
// 3D scene reads the clock from a ref every frame, so it only re-renders on real changes.
export default memo(CircuitScene);
function CircuitScene(props: Props) {
  // Ref-based rig read by the frame loop; React state only mirrors the mode for the toolbar.
  const rig = useRef<CameraRigState>(createRig(props.initialMode ?? "tv"));
  const [mode, setCameraMode] = useState<CameraMode>(props.initialMode ?? "tv");
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
        .querySelector<HTMLElement>(".sv-viewport")
        ?.requestFullscreen?.()
        .catch(() => undefined);
  };
  const [labels, setLabels] = useState(true);
  const [trails, setTrails] = useState(false);
  const changeMode = (next: CameraMode) => {
    setRigMode(rig.current, next);
    setCameraMode(next);
    props.onModeChange?.(next);
  };
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
    if (
      action === "zoomIn" ||
      action === "zoomOut" ||
      action === "rotateLeft" ||
      action === "rotateRight"
    )
      return applyRigAction(rig.current, action);
    return false;
  });
  return (
    <div className="circuit-view-controls">
      {/* Camera dock: one tap per view; everything else lives in the Display popover. */}
      <div className="sv-dock glass" role="toolbar" aria-label="Camera">
        <div
          role="group"
          aria-label="Camera mode"
          className="sv-segmented camera-modes"
        >
          {CAMERA_MODES.map((m) => (
            <button
              key={m}
              aria-pressed={mode === m}
              onClick={() => changeMode(m)}
              title={CAMERA_LABELS[m]}
            >
              <Icon name={MODE_ICON[m]} />
              <span>{CAMERA_LABELS[m]}</span>
            </button>
          ))}
        </div>
        <Popover
          label="Display and camera options"
          button={<Icon name="sliders" />}
          placement="top"
          className="sv-display"
        >
          <div className="sv-menu-section">
            <h3>Camera</h3>
            <div className="sv-row">
              <button
                className="sv-chip"
                onClick={() => applyRigAction(rig.current, "zoomOut")}
                disabled={mode === "onboard"}
                aria-label="Zoom out"
              >
                <Icon name="minus" />
              </button>
              <button
                className="sv-chip"
                onClick={() => applyRigAction(rig.current, "zoomIn")}
                disabled={mode === "onboard"}
                aria-label="Zoom in"
              >
                <Icon name="plus" />
              </button>
              <button
                className="sv-chip"
                onClick={() => applyRigAction(rig.current, "rotateLeft")}
                disabled={mode === "tv"}
                aria-label="Orbit left"
              >
                <Icon name="rotateLeft" />
              </button>
              <button
                className="sv-chip"
                onClick={() => applyRigAction(rig.current, "rotateRight")}
                disabled={mode === "tv"}
                aria-label="Orbit right"
              >
                <Icon name="rotateRight" />
              </button>
            </div>
          </div>
          <div className="sv-menu-section">
            <h3>Overlays</h3>
            <label className="sv-switch">
              <input
                type="checkbox"
                checked={labels}
                onChange={(e) => setLabels(e.target.checked)}
              />
              <span>Driver labels</span>
            </label>
            <label className="sv-switch">
              <input
                type="checkbox"
                checked={trails}
                onChange={(e) => setTrails(e.target.checked)}
              />
              <span>Trails</span>
            </label>
          </div>
          <div className="sv-menu-section">
            <h3>Quality</h3>
            <div
              className="sv-segmented is-small"
              role="group"
              aria-label="Rendering quality"
            >
              {QUALITY_LEVELS.map((q) => (
                <button
                  key={q}
                  aria-pressed={quality === q}
                  onClick={() => setQuality(q)}
                >
                  {QUALITY_LABELS[q]}
                </button>
              ))}
            </div>
          </div>
          <div className="sv-menu-section sv-row">
            <button className="sv-chip" onClick={fullscreen}>
              <Icon name="fullscreen" /> Fullscreen
            </button>
            <button
              className="sv-chip"
              aria-pressed={presenting}
              onClick={() => present(!presenting)}
              title="Present mode (P)"
            >
              <Icon name="present" /> Present <kbd>P</kbd>
            </button>
          </div>
          <p className="sv-menu-note">
            Elevation derived from OpenF1 · illustrative surroundings
          </p>
        </Popover>
      </div>
      <DriverBoundary>
        <Suspense
          fallback={
            <div className="fallback" role="status">
              Loading driver view…
            </div>
          }
        >
          <DriverScene
            clock={props.clock}
            entries={props.session.entries}
            sample={props.session.sample}
            tags={props.tags}
            wet={props.wet}
            tyresKnown
            selectedId={props.selectedId}
            onSelect={props.onSelect}
            rig={rig}
            mode={mode}
            labels={labels}
            trails={trails}
            quality={QUALITY[quality]}
            ghost={props.ghost}
          />
        </Suspense>
      </DriverBoundary>
    </div>
  );
}
