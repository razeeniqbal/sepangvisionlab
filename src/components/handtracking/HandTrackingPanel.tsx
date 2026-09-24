import { useState } from "react";
import GestureRecorder from "./GestureRecorder";
import GestureControls from "./GestureControls";
import useHandTracking from "../../hooks/useHandTracking";
import {
  fingerTips,
  handAngle,
  handConnections,
  previewPoint,
} from "../../domain/hands";
export default function HandTrackingPanel() {
  const tracking = useHandTracking();
  const [collecting, setCollecting] = useState(false);
  const active = ["loading", "checking", "requesting", "live"].includes(
    tracking.status,
  );
  return (
    <section
      id="hand-lab"
      tabIndex={-1}
      className="hand-panel"
      aria-label="Hand tracking lab"
    >
      <div className="telemetry-heading">
        <h2>
          HAND TRACKING <span>/ OPTIONAL CAMERA INPUT</span>
        </h2>
        <span>{tracking.status.toUpperCase()}</span>
      </div>
      <p>
        Track up to two hands with 21 landmarks each. Camera frames are
        processed in this browser, never uploaded or recorded. No microphone is
        requested. Model files load from this local app.
      </p>
      <div className="hand-actions">
        <button onClick={() => void tracking.start(true)} disabled={active}>
          Enable camera
        </button>
        <button onClick={() => tracking.stop()} disabled={!active}>
          Stop camera
        </button>
        <button onClick={() => void tracking.start(false)} disabled={active}>
          Check tracking engine without camera
        </button>
      </div>
      <p role={tracking.status === "error" ? "alert" : "status"}>
        {tracking.message}
      </p>
      <GestureControls
        hands={tracking.hands}
        live={tracking.status === "live" && !collecting}
        latency={tracking.latency}
        aspect={tracking.size.width / tracking.size.height}
      />
      <div className="hand-layout">
        <div
          className="hand-preview"
          style={{
            aspectRatio: `${tracking.size.width} / ${tracking.size.height}`,
          }}
        >
          <video
            ref={tracking.video}
            muted
            playsInline
            aria-label="Local mirrored camera preview"
          />
          {tracking.status !== "live" && (
            <div className="hand-placeholder">CAMERA OFF</div>
          )}
          <svg
            viewBox={`0 0 ${tracking.size.width} ${tracking.size.height}`}
            role="img"
            aria-label={`${tracking.hands.length} detected hands; mirrored landmark overlay`}
          >
            {tracking.hands.map((h, i) => (
              <g
                key={i}
                stroke={i === 0 ? "#00e0c2" : "#ffc578"}
                fill={i === 0 ? "#00e0c2" : "#ffc578"}
              >
                {handConnections.map(([a, b]) => {
                  const p = previewPoint(
                      h.points[a],
                      tracking.size.width,
                      tracking.size.height,
                    ),
                    q = previewPoint(
                      h.points[b],
                      tracking.size.width,
                      tracking.size.height,
                    );
                  return (
                    <line
                      key={`${a}-${b}`}
                      x1={p.x}
                      y1={p.y}
                      x2={q.x}
                      y2={q.y}
                      strokeWidth="2"
                    />
                  );
                })}
                {h.points.map((p, j) => {
                  const q = previewPoint(
                    p,
                    tracking.size.width,
                    tracking.size.height,
                  );
                  return (
                    <g key={j}>
                      <circle cx={q.x} cy={q.y} r="3" />
                      <text x={q.x + 5} y={q.y - 5} stroke="none" fontSize="10">
                        {j}
                      </text>
                    </g>
                  );
                })}
              </g>
            ))}
          </svg>
        </div>
        <div className="hand-readout">
          <GestureRecorder
            hands={tracking.hands}
            live={tracking.status === "live"}
            latency={tracking.latency}
            aspect={tracking.size.width / tracking.size.height}
            enabled={collecting}
            onEnabled={setCollecting}
          />

          <h3>{tracking.hands.length} / 2 hands detected</h3>
          <p>
            Inference:{" "}
            {tracking.latency === null
              ? "—"
              : `${tracking.latency.toFixed(1)} ms`}{" "}
            · capped at 15 frames/s
          </p>
          {!tracking.hands.length && (
            <p>
              {tracking.status === "live"
                ? "Show your hands inside the preview in good light."
                : "Enable the camera to see live landmarks and finger positions."}
            </p>
          )}
          {tracking.hands.map((h, i) => (
            <div className="hand-details" key={i}>
              <h3>
                Hand {i + 1} · {h.label} estimate · {(h.score * 100).toFixed(0)}
                %
              </h3>
              <p>
                Screen orientation:{" "}
                {handAngle(
                  h.points,
                  tracking.size.width,
                  tracking.size.height,
                )?.toFixed(0) ?? "—"}
                °
              </p>
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
        </div>
      </div>
      <p>
        Preview is mirrored; table coordinates refer to the original camera
        image. Orientation is the mirrored wrist-to-middle-knuckle direction,
        clockwise from up, not full 3D palm rotation. Left/right labels are
        model estimates; hand numbers are not persistent identities. Relative Z
        is model depth, not a measured distance.
      </p>
      <p>
        Stop camera, Escape, hiding this tab, switching session, or leaving the
        page releases the camera and disarms gestures. Gesture actions require a
        separate enable switch. Mouse and keyboard remain available.
      </p>
    </section>
  );
}
