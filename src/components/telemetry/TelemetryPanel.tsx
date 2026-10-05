import type { TelemetrySample } from "../../domain/telemetry";
import { TELEMETRY_WINDOW } from "../../domain/telemetry";
interface Props {
  number: string;
  samples: readonly TelemetrySample[];
  running: boolean;
}
const channels = [
  { key: "speed", label: "Speed", unit: "km/h", max: 360, color: "#00a19c" },
  { key: "throttle", label: "Throttle", unit: "%", max: 100, color: "#3fc18a" },
  { key: "brake", label: "Brake", unit: "%", max: 100, color: "#d1243a" },
] as const;
export default function TelemetryPanel({ number, samples, running }: Props) {
  const latest = samples.at(-1);
  const end = latest?.time ?? 0;
  const start = Math.max(0, end - TELEMETRY_WINDOW);
  return (
    <section
      id="race-analysis"
      tabIndex={-1}
      className="telemetry-panel"
      aria-label={`Telemetry for car ${number}`}
    >
      <div className="telemetry-heading">
        <h2>
          Car {number} <span>/ Telemetry</span>
        </h2>
        <span>{running ? "Playing" : "Paused"} · Simulated session</span>
      </div>
      <div className="telemetry-charts">
        {channels.map((channel) => {
          const value = latest?.[channel.key];
          const points = samples
            .map(
              (sample) =>
                `${40 + ((sample.time - start) / TELEMETRY_WINDOW) * 430},${110 - (sample[channel.key] / channel.max) * 90}`,
            )
            .join(" ");
          return (
            <div className="telemetry-channel" key={channel.key}>
              <div className="telemetry-value">
                <span>{channel.label}</span>
                <strong data-testid={`telemetry-${channel.key}`}>
                  {value === undefined
                    ? "—"
                    : value.toFixed(channel.key === "speed" ? 1 : 0)}{" "}
                  <small>{channel.unit}</small>
                </strong>
              </div>
              <svg
                viewBox="0 0 490 140"
                role="img"
                aria-label={`${channel.label}: ${value ?? "No samples"} ${channel.unit}; synthetic session seconds ${start.toFixed(1)} to ${(start + 60).toFixed(1)}`}
              >
                {[0, 0.5, 1].map((fraction) => (
                  <g key={fraction}>
                    <line
                      x1="40"
                      x2="470"
                      y1={110 - fraction * 90}
                      y2={110 - fraction * 90}
                      stroke="#293332"
                    />
                    <text x="31" y={114 - fraction * 90} textAnchor="end">
                      {fraction * channel.max}
                    </text>
                  </g>
                ))}
                <polyline
                  data-testid={`trace-${channel.key}`}
                  points={points}
                  fill="none"
                  stroke={channel.color}
                  strokeWidth="2"
                />
                {latest && (
                  <circle
                    cx={40 + ((end - start) / 60) * 430}
                    cy={110 - (latest[channel.key] / channel.max) * 90}
                    r="3"
                    fill={channel.color}
                  />
                )}
                <text x="40" y="132">
                  {start.toFixed(0)}s
                </text>
                <text x="255" y="132" textAnchor="middle">
                  {(start + 30).toFixed(0)}s
                </text>
                <text x="470" y="132" textAnchor="end">
                  {(start + 60).toFixed(0)}s
                </text>
              </svg>
            </div>
          );
        })}
      </div>
      <p>
        Last 60 session seconds · quasi steady state lap model · throttle and
        brake are modeled from the physics speed trace. These are demonstration
        signals, not measured race telemetry. Traces are reconstructed from the
        synthetic session at the replay time.
      </p>
    </section>
  );
}
