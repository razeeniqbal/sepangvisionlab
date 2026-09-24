import { useEffect, useRef, useState } from "react";
import {
  GestureDetector,
  gestureActions,
  type GestureAction,
} from "../../domain/gestures";
import type { TrackedHand } from "../../domain/hands";
import { useGestureCommands } from "./GestureContext";
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
      `${gestureActions.find((a) => a.action === action)!.label}${handled ? "" : " — unavailable in this workspace"}`,
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
    <div className="gesture-controls">
      <h3>Gesture controls · experimental rules</h3>
      <label>
        <input
          type="checkbox"
          checked={armed && live}
          disabled={!live}
          onChange={(e) => {
            detector.current.reset();
            setArmed(e.target.checked);
          }}
        />{" "}
        Enable gesture actions
      </label>
      <p>
        {armed && live
          ? "ARMED · show a neutral pose between actions."
          : "DISARMED · camera tracking alone cannot operate the app."}
      </p>
      <p role="status" data-testid="gesture-feedback">
        {last}
      </p>
      <div className="strategy-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Gesture</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {gestureActions.map((a) => (
              <tr key={a.action}>
                <td>{a.pose}</td>
                <td>{a.label}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        Pinch cycles through the driver list; point reveals the currently
        selected inspector. Swipe direction follows the mirrored preview. Poses
        need a 0.5-second hold; two still palms need 0.9 seconds. Each action
        fires once, then needs a neutral pose or hand release. Fist pauses
        replay and disarms actions. Camera stays on until Stop or Escape.
      </p>
      <details>
        <summary>Test actions without camera</summary>
        <p>
          These buttons operate the current workspace through the same command
          path. They test action wiring, not gesture recognition.
        </p>
        <div className="hand-actions">
          {gestureActions.map((a) => (
            <button key={a.action} onClick={() => fire(a.action)}>
              {a.label}
            </button>
          ))}
        </div>
      </details>
    </div>
  );
}
