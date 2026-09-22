import { useEffect, useState } from "react";
import {
  loadStints,
  type StintAnalysis,
  type Stint,
} from "../../services/stints";
function StintChart({ stint }: { stint: Stint }) {
  if (!stint.samples.length)
    return (
      <div className="stint-empty">No completed laps in this segment yet.</div>
    );
  const values = stint.samples.map((row) => row.seconds),
    low = Math.floor(Math.min(...values) - 1),
    high = Math.ceil(Math.max(...values) + 1);
  const x = (lap: number) =>
    48 +
    ((lap - stint.startLap) / Math.max(1, stint.endLap - stint.startLap)) * 680;
  const y = (seconds: number) => 188 - ((seconds - low) / (high - low)) * 155;
  return (
    <svg
      className="stint-chart"
      viewBox="0 0 760 230"
      role="img"
      aria-label={`Stint ${stint.number}, recorded lap times from lap ${stint.startLap} to ${stint.endLap}. ${stint.fit ? `Observed pace trend ${stint.fit.secondsPerLap.toFixed(3)} seconds per lap.` : "Insufficient laps for a trend."}`}
    >
      {[0, 0.5, 1].map((f) => (
        <g key={f}>
          <line
            x1="48"
            x2="728"
            y1={188 - f * 155}
            y2={188 - f * 155}
            stroke="#2c3e35"
          />
          <text x="40" y={192 - f * 155} textAnchor="end">
            {(low + f * (high - low)).toFixed(1)}
          </text>
        </g>
      ))}
      {stint.fit && (
        <line
          x1={x(stint.fit.firstLap)}
          x2={x(stint.fit.lastLap)}
          y1={y(
            stint.fit.intercept + stint.fit.secondsPerLap * stint.fit.firstLap,
          )}
          y2={y(
            stint.fit.intercept + stint.fit.secondsPerLap * stint.fit.lastLap,
          )}
          stroke="#00c4b4"
          strokeWidth="2"
        />
      )}
      {stint.samples.map((s) => (
        <circle
          key={s.lap}
          cx={x(s.lap)}
          cy={y(s.seconds)}
          r={s.included ? 3.5 : 5}
          fill={s.included ? "#c9dfd7" : "#dfae6b"}
        >
          <title>
            Lap {s.lap}: {s.seconds.toFixed(3)}s — {s.reason}
          </title>
        </circle>
      ))}
      <text x="48" y="214">
        Lap {stint.startLap}
      </text>
      <text x="728" y="214" textAnchor="end">
        Lap {stint.endLap}
      </text>
      <text x="48" y="18">
        Lap time (seconds)
      </text>
    </svg>
  );
}
export default function StintAnalysisPanel({
  driverId,
  driverName,
  completed,
}: {
  driverId: string;
  driverName: string;
  completed: number;
}) {
  const [result, setResult] = useState<StintAnalysis | null>(null),
    [error, setError] = useState(false),
    [attempt, setAttempt] = useState(0),
    [choice, setChoice] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setError(false);
    const timeout = setTimeout(() => controller.abort(), 15000);
    loadStints(driverId, completed, controller.signal)
      .then((data) => {
        if (active) setResult(data);
      })
      .catch(() => {
        if (active) setError(true);
      })
      .finally(() => clearTimeout(timeout));
    return () => {
      active = false;
      controller.abort();
      clearTimeout(timeout);
    };
  }, [driverId, completed, attempt]);
  const data =
    result?.driverId === driverId && result.completedLaps === completed
      ? result
      : null;
  const stint =
    data?.stints.find((s) => s.number === choice) ?? data?.stints.at(-1);
  const fit = stint?.fit;
  return (
    <section className="stint-panel" aria-label="Tyre and stint analysis">
      <div className="telemetry-heading">
        <h2>
          TYRE & STINT ANALYSIS <span>/ OBSERVED PACE PROXY</span>
        </h2>
        <span>
          {driverName} · THROUGH LAP {completed}
        </span>
      </div>
      {error ? (
        <div role="status">
          <p>Stint analysis could not be loaded.</p>
          <button onClick={() => setAttempt((v) => v + 1)}>
            Retry stint analysis
          </button>
        </div>
      ) : !data ? (
        <p role="status">Updating completed-lap analysis…</p>
      ) : !stint ? (
        <p>
          No lap timing for this driver. Tyre degradation cannot be estimated.
        </p>
      ) : (
        <>
          <div className="stint-controls">
            <label>
              Segment{" "}
              <select
                aria-label="Stint segment"
                value={
                  choice && data.stints.some((s) => s.number === choice)
                    ? choice
                    : 0
                }
                onChange={(e) => setChoice(Number(e.target.value))}
              >
                <option value="0">Follow latest segment</option>
                {data.stints.map((s) => (
                  <option value={s.number} key={s.number}>
                    Segment {s.number} · from lap {s.startLap}
                  </option>
                ))}
              </select>
            </label>
            <span>Compound: unknown · Actual tyre age: unknown</span>
          </div>
          <div className="stint-layout">
            <StintChart stint={stint} />
            <div className="stint-summary">
              <span className="eyebrow">OBSERVED PACE TREND</span>
              <strong data-testid="stint-slope">
                {fit
                  ? `${fit.secondsPerLap >= 0 ? "+" : ""}${fit.secondsPerLap.toFixed(3)}`
                  : "—"}
                <small> s/lap</small>
              </strong>
              <p>
                {fit
                  ? fit.secondsPerLap > 0
                    ? "Lap times trend slower across this segment."
                    : fit.secondsPerLap < 0
                      ? "Lap times trend faster across this segment."
                      : "No fitted pace change across this segment."
                  : `At least ${data.minSamples} usable completed laps are needed.`}
              </p>
              <dl>
                <dt>Usable / recorded laps</dt>
                <dd data-testid="stint-count">
                  {stint.samples.filter((s) => s.included).length} /{" "}
                  {stint.samples.length}
                </dd>
                <dt>Fit residual MAE</dt>
                <dd>{fit ? `${fit.fitMae.toFixed(3)}s` : "—"}</dd>
                <dt>Tyre-only degradation</dt>
                <dd>Not identifiable</dd>
              </dl>
            </div>
          </div>
          <p className="stint-legend">
            Light dots: fitted laps · Amber dots: excluded laps · Turquoise
            line: robust trend. Opening lap, pit laps and the first lap after
            each pit stop are excluded; other slow laps remain. Fit residual MAE
            describes how closely the line matches these laps, not prediction
            accuracy.
          </p>
          <details>
            <summary>Inspect lap inclusion</summary>
            <div className="stint-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Lap</th>
                    <th>Recorded time</th>
                    <th>Regression use</th>
                  </tr>
                </thead>
                <tbody>
                  {stint.samples.map((s) => (
                    <tr key={s.lap}>
                      <td>{s.lap}</td>
                      <td>{s.seconds.toFixed(3)}s</td>
                      <td>{s.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
      <p className="stint-limitation">
        {data?.limitation ??
          "Pit stops identify provisional stint boundaries, not confirmed tyre changes. Fuel burn, traffic and track conditions also affect pace. Tyre-specific degradation is unavailable."}{" "}
        Only completed laps at the replay cursor are analyzed.
      </p>
    </section>
  );
}
