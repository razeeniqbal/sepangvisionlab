import { useEffect, useRef, useState } from "react";
import {
  GestureDetector,
  gestureActions,
  type GestureAction,
} from "../../domain/gestures";
import type { TrackedHand } from "../../domain/hands";
import { useGestureCommands } from "./GestureContext";
import Icon, { type IconName } from "../ui/Icon";

const ACTION_ICON: Record<GestureAction, IconName> = {
  rewind: "back",
  forward: "forward",
  select: "list",
  inspect: "inspect",
  playPause: "play",
  cancel: "close",
  zoomIn: "plus",
  zoomOut: "minus",
  rotateLeft: "rotateLeft",
  rotateRight: "rotateRight",
  cycleCamera: "tv",
};
export default function GestureControls({
  hands,
  live,
  latency,
  aspect,
}: {
  hands: TrackedHand[];
  live: boolean;
  latency: number | null;
  aspect: number;
}) {
  const [armed, setArmed] = useState(false),
    [last, setLast] = useState("No gesture action yet.");
  const detector = useRef(new GestureDetector());
  const { send } = useGestureCommands();
  const fire = (action: GestureAction) => {
    const handled = send(action);
    setLast(
      `${gestureActions.find((a) => a.action === action)!.label}${handled ? "" : " (not available here)"}`,
    );
    if (action === "cancel") {
      setArmed(false);
      detector.current.reset();
    }
  };
  const fireRef = useRef(fire);
  fireRef.current = fire;
  useEffect(() => {
    if (!live) {
      setArmed(false);
      detector.current.reset();
    }
  }, [live]);
  useEffect(() => {
    if (
      !armed ||
      !live ||
      document.hidden ||
      latency === null ||
      latency > 350
    ) {
      detector.current.reset();
      return;
    }
    const action = detector.current.update(hands, performance.now(), aspect);
    if (action) fireRef.current(action);
  }, [hands, armed, live, latency, aspect]);
  useEffect(() => {
    const reset = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setArmed(false);
        detector.current.reset();
      }
    };
    document.addEventListener("keydown", reset);
    return () => document.removeEventListener("keydown", reset);
  }, []);
  return (
    <div className="sv-hands-gestures">
      <div className="sv-hands-arm">
        <label className="sv-switch">
          <input
            type="checkbox"
            checked={armed && live}
            disabled={!live}
            onChange={(e) => {
              detector.current.reset();
              setArmed(e.target.checked);
            }}
          />
          <span>Gesture control</span>
        </label>
        <span className={"sv-hands-pill" + (armed && live ? " is-on" : "")}>
          {armed && live ? "Armed" : live ? "Off" : "Camera off"}
        </span>
      </div>
      <p className="sv-hands-note">
        {armed && live
          ? "Hold each pose for half a second, then relax your hand before the next one. A fist pauses and switches gestures off."
          : "Turn the camera on, then switch gestures on. The camera alone never controls the app."}
      </p>
      <p className="sv-hands-last" role="status" data-testid="gesture-feedback">
        <Icon name="hand" /> {last}
      </p>
      <h3>Gestures</h3>
      <ul className="sv-hands-grid">
        {gestureActions.map((a) => (
          <li key={a.action}>
            <span className="sv-hands-icon">
              <Icon name={ACTION_ICON[a.action]} />
            </span>
            <div>
              <strong>{a.label}</strong>
              <span>{a.pose}</span>
            </div>
          </li>
        ))}
      </ul>
      <details className="sv-hands-more">
        <summary>Try the actions without a camera</summary>
        <div className="sv-row">
          {gestureActions.map((a) => (
            <button key={a.action} className="sv-chip" onClick={() => fire(a.action)}>
              {a.label}
            </button>
          ))}
        </div>
      </details>
    </div>
  );
}
