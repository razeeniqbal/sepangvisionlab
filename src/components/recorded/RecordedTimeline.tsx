import type { Marker } from "../../domain/recordedSession";
import { PLAYBACK_SPEEDS } from "../../domain/replay";

const LABEL: Record<Marker["kind"], string> = {
  start: "Start",
  yellow: "Y",
  sc: "SC",
  vsc: "VSC",
  red: "Red",
  chequered: "Fin",
  trackLimits: "TL",
};

export function clockText(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600),
    m = Math.floor((s % 3600) / 60),
    sec = s % 60;
  const mm = String(m).padStart(2, "0") + ":" + String(sec).padStart(2, "0");
  return h ? h + ":" + mm : mm;
}

/** Replay on the real session timeline (UTC shown), with race-control markers. */
export default function RecordedTimeline({
  time,
  duration,
  t0,
  running,
  speed,
  markers,
  start,
  onSeek,
  onToggle,
  onSpeed,
}: {
  time: number; // seconds since t0
  duration: number; // seconds
  t0: string;
  running: boolean;
  speed: number;
  markers: readonly Marker[];
  start: number; // seconds
  onSeek: (seconds: number) => void;
  onToggle: () => void;
  onSpeed: (speed: number) => void;
}) {
  const utc = new Date(Date.parse(t0) + time * 1000).toISOString().slice(11, 19);
  // Track-limit notes are frequent; show them only as thin ticks.
  return (
    <section
      id="race-replay"
      tabIndex={-1}
      className="timeline-panel rec-timeline"
      aria-label="Recorded session replay"
    >
      <div className="timeline-heading">
        <h2>
          Replay <span>/ recorded</span>
        </h2>
        <strong data-testid="replay-time">
          {clockText(time * 1000)} / {clockText(duration * 1000)}
        </strong>
        <span className="rec-utc">{utc} UTC</span>
      </div>
      <div className="timeline-controls">
        <button onClick={() => onSeek(start)} aria-label="Jump to session start">
          Session start
        </button>
        <button onClick={() => onSeek(time - 10)} aria-label="Rewind 10 seconds">
          −10s
        </button>
        <button className="primary" onClick={onToggle}>
          {running ? "Pause replay" : "Play replay"}
        </button>
        <button onClick={() => onSeek(time + 10)} aria-label="Forward 10 seconds">
          +10s
        </button>
        <label>
          Speed{" "}
          <select
            aria-label="Playback speed"
            value={speed}
            onChange={(event) => onSpeed(Number(event.target.value))}
          >
            {PLAYBACK_SPEEDS.map((value) => (
              <option key={value} value={value}>
                {value}×
              </option>
            ))}
          </select>
        </label>
      </div>
      <input
        className="replay-slider"
        type="range"
        min="0"
        max={duration}
        step="0.1"
        value={time}
        aria-label="Session time"
        aria-valuetext={clockText(time * 1000)}
        onChange={(event) => onSeek(Number(event.target.value))}
      />
      <div className="lap-markers rec-markers">
        {markers.map((m, i) => (
          <button
            key={i}
            className={"rec-marker is-" + m.kind}
            style={{ left: `${(m.t / 1000 / duration) * 100}%` }}
            onClick={() => onSeek(m.t / 1000)}
            title={clockText(m.t) + " · " + m.label}
            aria-label={`Jump to ${m.label} at ${clockText(m.t)}`}
          >
            {m.kind === "trackLimits" ? "" : LABEL[m.kind]}
          </button>
        ))}
      </div>
    </section>
  );
}
