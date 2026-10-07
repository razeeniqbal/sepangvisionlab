import { useState } from "react";
import GestureRecorder from "./GestureRecorder";
import GestureControls from "./GestureControls";
import useHandTracking, { type HandStatus } from "../../hooks/useHandTracking";
import Icon from "../ui/Icon";
import {
  fingerTips,
  handAngle,
  handConnections,
  previewPoint,
} from "../../domain/hands";
const STATUS: Record<HandStatus, string> = {
  off: "Off",
  loading: "Starting",
  checking: "Checking",
  ready: "Engine ready",
  requesting: "Waiting for permission",
  live: "Live",
  error: "Problem",
};

/**
 * Hand tracking sheet: camera preview beside the controls, the gesture list, and an Advanced
 * section with landmark readouts, the dataset recorder and technical notes. Frames are processed
 * in this browser only.
 */
export default function HandTrackingPanel({ onClose }: { onClose?: () => void }) {
  const tracking = useHandTracking();
  const [collecting, setCollecting] = useState(false);
  const active = ["loading", "checking", "requesting", "live"].includes(tracking.status);
  const live = tracking.status === "live";
  return (
    <section id="hand-lab" tabIndex={-1} className="sv-hands" aria-labelledby="sv-hands-title">
      <header className="sv-hands-head">
        <div>
          <h2 id="sv-hands-title">Hand tracking</h2>
          <p>Control the replay with hand gestures. Optional, and everything runs in this browser.</p>
        </div>
        <span className={"sv-hands-pill is-" + tracking.status}>{STATUS[tracking.status]}</span>
        {onClose && (
          <button className="sv-icon-button" aria-label="Close hand tracking" onClick={onClose}>
            <Icon name="close" />
          </button>
        )}
      </header>
      <div className="sv-hands-main">
        <div
          className="sv-hands-preview"
          style={{ aspectRatio: `${tracking.size.width} / ${tracking.size.height}` }}
        >
          <video ref={tracking.video} muted playsInline aria-label="Local mirrored camera preview" />
          {!live && (
            <div className="sv-hands-placeholder">
              <Icon name="hand" size={34} />
              <span>Camera is off</span>
            </div>
          )}
          <svg
            viewBox={`0 0 ${tracking.size.width} ${tracking.size.height}`}
            role="img"
            aria-label={`${tracking.hands.length} detected hands; mirrored landmark overlay`}
          >
            {tracking.hands.map((h, i) => (
              <g key={i} stroke={i === 0 ? "#00e0c2" : "#ffc578"} fill={i === 0 ? "#00e0c2" : "#ffc578"}>
                {handConnections.map(([a, b]) => {
                  const p = previewPoint(h.points[a], tracking.size.width, tracking.size.height),
                    q = previewPoint(h.points[b], tracking.size.width, tracking.size.height);
                  return <line key={`${a}-${b}`} x1={p.x} y1={p.y} x2={q.x} y2={q.y} strokeWidth="2.5" />;
                })}
                {h.points.map((p, j) => {
                  const q = previewPoint(p, tracking.size.width, tracking.size.height);
                  return <circle key={j} cx={q.x} cy={q.y} r="3.5" />;
                })}
              </g>
            ))}
          </svg>
          {live && (
            <span className="sv-hands-count">
              {tracking.hands.length} / 2 hands
              {tracking.latency !== null && ` · ${tracking.latency.toFixed(0)} ms`}
            </span>
          )}
        </div>
        <div className="sv-hands-side">
          <div className="sv-hands-camera">
            {active ? (
              <button className="sv-hands-primary is-stop" onClick={() => tracking.stop()}>
                Turn off camera
              </button>
            ) : (
              <button className="sv-hands-primary" onClick={() => void tracking.start(true)}>
                <Icon name="hand" /> Turn on camera
              </button>
            )}
            <p className="sv-hands-note" role={tracking.status === "error" ? "alert" : "status"}>
              {tracking.message}
            </p>
            <p className="sv-hands-privacy">
              Frames never leave this device and nothing is recorded. No microphone is used. Escape or
              switching tabs turns the camera off.
            </p>
          </div>
          <GestureControls
            hands={tracking.hands}
            live={live && !collecting}
            latency={tracking.latency}
            aspect={tracking.size.width / tracking.size.height}
          />
        </div>
      </div>
      <details className="sv-hands-more sv-hands-advanced">
        <summary>Advanced: landmarks, dataset recorder and notes</summary>
        <div className="sv-row">
          <button className="sv-chip" onClick={() => void tracking.start(false)} disabled={active}>
            Check the tracking engine without a camera
          </button>
        </div>
        <GestureRecorder
          hands={tracking.hands}
          live={live}
          latency={tracking.latency}
          aspect={tracking.size.width / tracking.size.height}
          enabled={collecting}
          onEnabled={setCollecting}
        />
        {tracking.hands.map((h, i) => (
          <div className="sv-hands-detail" key={i}>
            <h3>
              Hand {i + 1} · {h.label} estimate · {(h.score * 100).toFixed(0)}% · orientation{" "}
              {handAngle(h.points, tracking.size.width, tracking.size.height)?.toFixed(0) ?? "—"}°
            </h3>
            <table>
              <thead>
                <tr>
                  <th>Fingertip</th>
                  <th>X</th>
                  <th>Y</th>
                  <th>Relative Z</th>
                </tr>
              </thead>
              <tbody>
                {fingerTips.map((t) => (
                  <tr key={t.name}>
                    <th>{t.name}</th>
                    <td>{h.points[t.index].x.toFixed(3)}</td>
                    <td>{h.points[t.index].y.toFixed(3)}</td>
                    <td>{h.points[t.index].z.toFixed(3)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
        <p className="sv-hands-note">
          Up to two hands with 21 landmarks each, capped at 15 frames a second. The preview is mirrored;
          table coordinates refer to the original camera image. Orientation is the wrist-to-middle-knuckle
          direction, clockwise from up. Left/right labels are model estimates, hand numbers are not
          persistent, and relative Z is model depth, not a measured distance. Model files load from this
          app.
        </p>
      </details>
    </section>
  );
}
