import type { Marker } from "../../domain/recordedSession";
import { PLAYBACK_SPEEDS } from "../../domain/replay";
import Icon from "../ui/Icon";

const LABEL: Record<Marker["kind"], string> = {
  start: "Start",
  yellow: "Yellow flag",
  sc: "Safety car",
  vsc: "Virtual safety car",
  red: "Red flag",
  chequered: "Chequered flag",
  trackLimits: "Track limits",
};

export function clockText(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600),
    m = Math.floor((s % 3600) / 60),
    sec = s % 60;
  const mm = String(m).padStart(2, "0") + ":" + String(sec).padStart(2, "0");
  return h ? h + ":" + mm : mm;
}

/** Floating replay bar on the real session timeline (UTC shown), with race-control markers. */
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
  const pct = (t: number) => `${(t / duration) * 100}%`;
  return (
    <section
      id="race-replay"
      tabIndex={-1}
      className="sv-replay glass"
      aria-label="Recorded session replay"
    >
      <div className="sv-replay-buttons">
        <button className="sv-icon-button" onClick={() => onSeek(start)} aria-label="Jump to session start" title="Session start">
          <Icon name="start" />
        </button>
        <button className="sv-icon-button" onClick={() => onSeek(time - 10)} aria-label="Rewind 10 seconds" title="−10 s">
          <Icon name="back" />
        </button>
        <button className="sv-play" onClick={onToggle} aria-label={running ? "Pause replay" : "Play replay"}>
          <Icon name={running ? "pause" : "play"} size={20} />
        </button>
        <button className="sv-icon-button" onClick={() => onSeek(time + 10)} aria-label="Forward 10 seconds" title="+10 s">
          <Icon name="forward" />
        </button>
      </div>
      <div className="sv-time" data-testid="replay-time">
        <strong>{clockText(time * 1000)}</strong>
        <span>
          / {clockText(duration * 1000)} · {utc} UTC
        </span>
      </div>
      <div className="sv-scrub">
        <div className="sv-scrub-markers" aria-label="Race control events">
          {markers.map((m, i) => (
            <button
              key={i}
              className={"sv-marker is-" + m.kind}
              style={{ left: pct(m.t / 1000) }}
              onClick={() => onSeek(m.t / 1000)}
              title={clockText(m.t) + " · " + m.label}
              aria-label={`${LABEL[m.kind]} at ${clockText(m.t)}: jump`}
            />
          ))}
        </div>
        <input
          className="sv-range replay-slider"
          type="range"
          min="0"
          max={duration}
          step="0.1"
          value={time}
          style={{ ["--fill" as string]: pct(time) }}
          aria-label="Session time"
          aria-valuetext={clockText(time * 1000)}
          onChange={(event) => onSeek(Number(event.target.value))}
        />
      </div>
      <label className="sv-speed">
        <span className="visually-hidden">Playback speed</span>
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
    </section>
  );
}
