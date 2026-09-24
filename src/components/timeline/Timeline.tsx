import type { CarDefinition } from "../../domain/field";
import {
  formatTime,
  lapMarkers,
  PLAYBACK_SPEEDS,
  SESSION_DURATION,
} from "../../domain/replay";
interface Props {
  time: number;
  running: boolean;
  speed: number;
  car: CarDefinition;
  lap: number;
  onSeek: (time: number) => void;
  onToggle: () => void;
  onSpeed: (speed: number) => void;
}
export default function Timeline({
  time,
  running,
  speed,
  car,
  lap,
  onSeek,
  onToggle,
  onSpeed,
}: Props) {
  const markers = lapMarkers(car);
  return (
    <section
      id="race-replay"
      tabIndex={-1}
      className="timeline-panel"
      aria-label="Synthetic session replay"
    >
      <div className="timeline-heading">
        <h2>
          SESSION REPLAY <span>/ SYNTHETIC · 10 MIN</span>
        </h2>
        <strong data-testid="replay-time">{formatTime(time)} / 10:00</strong>
      </div>
      <div className="timeline-controls">
        <button
          onClick={() => onSeek(time - 10)}
          aria-label="Rewind 10 seconds"
        >
          −10s
        </button>
        <button className="primary" onClick={onToggle}>
          {running
            ? "Pause replay"
            : time === SESSION_DURATION
              ? "Replay from start"
              : "Play replay"}
        </button>
        <button
          onClick={() => onSeek(time + 10)}
          aria-label="Forward 10 seconds"
        >
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
        <label>
          CAR {car.number} · LAP {lap}{" "}
          <select
            aria-label="Jump to selected car lap"
            value={lap}
            onChange={(event) =>
              onSeek(
                markers.find(
                  (marker) => marker.lap === Number(event.target.value),
                )!.time,
              )
            }
          >
            {markers.map((marker) => (
              <option key={marker.lap} value={marker.lap}>
                Lap {marker.lap}
              </option>
            ))}
          </select>
        </label>
      </div>
      <input
        className="replay-slider"
        type="range"
        min="0"
        max={SESSION_DURATION}
        step="0.1"
        value={time}
        aria-label="Session time"
        aria-valuetext={formatTime(time)}
        onChange={(event) => onSeek(Number(event.target.value))}
      />
      <div className="lap-markers">
        {markers.map((marker) => (
          <button
            key={marker.lap}
            style={{ left: `${(marker.time / SESSION_DURATION) * 100}%` }}
            onClick={() => onSeek(marker.time)}
            aria-label={`Jump to car ${car.number} lap ${marker.lap}`}
          >
            L{marker.lap}
          </button>
        ))}
      </div>
      <p>
        Lap markers follow CAR {car.number}. Seeking pauses playback. Pit
        events: none · Race-control events: none in this synthetic session.
      </p>
    </section>
  );
}
