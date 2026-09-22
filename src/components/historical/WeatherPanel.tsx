import { useState } from "react";
import type { StrategyResult } from "../../services/strategy";
import { formatLap } from "../../domain/inspection";
import {
  defaultWeather,
  simulateWeather,
  validateWeather,
  weatherAt,
  weatherLabels,
  weatherStates,
  weatherTyres,
  type WeatherConfig,
  type WeatherResult,
} from "../../domain/weather";
const colors = ["#9bafa4", "#00c4b4", "#e3ac66", "#72a7ef", "#c9a6e9"];
export default function WeatherPanel({
  strategy,
}: {
  strategy: StrategyResult;
}) {
  const [config, setConfig] = useState(() =>
    defaultWeather(strategy, strategy.assumptions.pitLoss),
  );
  const [result, setResult] = useState<WeatherResult | null>(null);
  const [selected, setSelected] = useState("slick");
  const invalid = validateWeather(strategy, config);
  function change(next: WeatherConfig) {
    setConfig(next);
    setResult(null);
  }
  const fields = [
    {
      key: "lightRainLap",
      label: "Light rain starts on lap",
      min: strategy.branchLap + 2,
      max: 54,
      step: 1,
    },
    {
      key: "wetLap",
      label: "Wet starts on lap",
      min: strategy.branchLap + 3,
      max: 55,
      step: 1,
    },
    {
      key: "dryingLap",
      label: "Drying starts on lap",
      min: strategy.branchLap + 4,
      max: 56,
      step: 1,
    },
    {
      key: "delay",
      label: "Delayed switch (laps after rain begins)",
      min: 1,
      max: 53,
      step: 1,
    },
    {
      key: "pitLoss",
      label: "Weather scenario pit loss per stop (s)",
      min: 0,
      max: 120,
      step: 0.1,
    },
    {
      key: "degradation",
      label: "Weather scenario pace loss (s/lap)",
      min: 0,
      max: 2,
      step: 0.01,
    },
  ] as const;
  const inspected =
    result?.plans.find((p) => p.id === selected) ?? result?.plans[0];
  return (
    <section className="weather-panel" aria-label="Weather scenario lab">
      <div className="telemetry-heading">
        <h2>
          WEATHER LAB <span>/ SIMULATED ASSUMPTIONS</span>
        </h2>
        <span>
          {strategy.driverName} · FROZEN LAP {strategy.branchLap}
        </span>
      </div>
      <p>
        Explore a hypothetical Dry → Light rain → Wet → Drying sequence. This is
        not the recorded weather of the 2017 race. Baseline pace{" "}
        {formatLap(strategy.baselineSeconds)} comes from completed laps{" "}
        {strategy.baselineLaps.join(", ")}.
      </p>
      {strategy.branchLap > 52 ? (
        <p>
          Capture a branch at lap 52 or earlier to leave room for all four
          weather states.
        </p>
      ) : (
        <>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!invalid) {
                setResult(simulateWeather(strategy, config));
                setSelected("slick");
              }
            }}
          >
            <div className="strategy-inputs">
              {fields.map((f) => (
                <label key={f.key}>
                  {f.label}
                  <input
                    required
                    type="number"
                    min={f.min}
                    max={f.max}
                    step={f.step}
                    value={Number.isNaN(config[f.key]) ? "" : config[f.key]}
                    onChange={(e) =>
                      change({ ...config, [f.key]: e.target.valueAsNumber })
                    }
                  />
                </label>
              ))}
            </div>
            <h3>Assumed tyre time penalties · seconds per lap</h3>
            <p>
              Illustrative values, not calibrated tyre performance. Each value
              is added to baseline pace. Edit these costs to explore where the
              faster tyre changes.
            </p>
            <div className="strategy-table-wrap">
              <table className="weather-matrix">
                <thead>
                  <tr>
                    <th>Weather</th>
                    {weatherTyres.map((t) => (
                      <th key={t}>{t}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {weatherStates.map((s) => (
                    <tr key={s}>
                      <th>{weatherLabels[s]}</th>
                      {weatherTyres.map((t) => (
                        <td key={t}>
                          <input
                            aria-label={`${weatherLabels[s]} ${t} penalty (s)`}
                            type="number"
                            required
                            min="0"
                            max="120"
                            step=".1"
                            value={
                              Number.isNaN(config.penalties[s][t])
                                ? ""
                                : config.penalties[s][t]
                            }
                            onChange={(e) =>
                              change({
                                ...config,
                                penalties: {
                                  ...config.penalties,
                                  [s]: {
                                    ...config.penalties[s],
                                    [t]: e.target.valueAsNumber,
                                  },
                                },
                              })
                            }
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p>
              All plans start on assumed slicks. Early switches happen just
              before the first light-rain lap; delayed switches happen the
              chosen number of laps later. Both return to slicks just before the
              first drying lap. Each switch costs one pit loss.
            </p>
            {invalid && <p role="status">{invalid}</p>}
            <button type="submit" disabled={!!invalid}>
              Compare weather strategies
            </button>
            <button
              className="weather-reset"
              type="button"
              onClick={() =>
                change(defaultWeather(strategy, strategy.assumptions.pitLoss))
              }
            >
              Reset weather assumptions
            </button>
          </form>
          {result && (
            <div className="weather-results">
              <h3>
                Weather comparison · {strategy.driverName}, lap{" "}
                {strategy.branchLap + 1}–56
              </h3>
              <div
                className="weather-timeline"
                aria-label="Simulated weather by lap"
              >
                {result.plans[0].laps.map((l) => (
                  <div
                    key={l.lap}
                    className={`weather-phase weather-${l.state}`}
                    title={`Lap ${l.lap}: ${weatherLabels[l.state]}`}
                  >
                    <strong>{l.lap}</strong>
                    <span>{weatherLabels[l.state]}</span>
                  </div>
                ))}
              </div>
              <div className="strategy-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Plan</th>
                      <th>Switches before lap</th>
                      <th>Remaining time</th>
                      <th>Δ vs slicks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.plans.map((p, i) => (
                      <tr
                        key={p.id}
                        className={
                          result.fastest.includes(p.id)
                            ? "strategy-fastest"
                            : ""
                        }
                      >
                        <th>
                          <span style={{ color: colors[i] }}>{p.label}</span>
                          {result.fastest.includes(p.id)
                            ? " · fastest in this model"
                            : ""}
                        </th>
                        <td>
                          {p.stops
                            .map((s) => `${s.beforeLap}: ${s.tyre}`)
                            .join(" → ") || "No stops"}
                        </td>
                        <td>{formatLap(p.remaining)}</td>
                        <td data-testid={`weather-delta-${p.id}`}>
                          {p.delta >= 0 ? "+" : ""}
                          {p.delta.toFixed(3)}s
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <WeatherChart result={result} />
              <p>
                Negative differences are faster than staying on slicks. All tied
                fastest plans are highlighted. Plans use the same known, assumed
                weather sequence; this is a comparison of five candidates, not
                an optimized or probabilistic forecast.
              </p>
              <details>
                <summary>Inspect weather and tyre costs lap by lap</summary>
                <div className="strategy-inputs">
                  <label>
                    Weather plan to inspect
                    <select
                      value={selected}
                      onChange={(e) => setSelected(e.target.value)}
                    >
                      {result.plans.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="weather-lap-table strategy-table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Lap</th>
                        <th>Weather</th>
                        <th>Tyre</th>
                        <th>Weather cost</th>
                        <th>Pit cost</th>
                        <th>Lap time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inspected?.laps.map((l) => (
                        <tr key={l.lap}>
                          <th>{l.lap}</th>
                          <td>{weatherLabels[l.state]}</td>
                          <td>{l.tyre}</td>
                          <td>{l.penalty.toFixed(1)}s</td>
                          <td>
                            {l.pit ? result.config.pitLoss.toFixed(1) : "0.0"}s
                          </td>
                          <td>{formatLap(l.seconds)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            </div>
          )}
        </>
      )}
      <p className="strategy-limit">
        This separate deterministic experiment uses the frozen branch’s baseline
        pace. Only pit-loss defaults are copied from Strategy Lab; its other
        assumptions and Monte Carlo spreads do not apply here. Added wear starts
        at zero at the branch and resets on each stop, with one shared rate for
        all tyres. Historical tyre age and compound are unknown. No grip
        physics, aquaplaning, incidents, weather forecasts or race-control
        decisions are modeled.
      </p>
    </section>
  );
}
function WeatherChart({ result }: { result: WeatherResult }) {
  const stay = result.plans[0].laps;
  const values = result.plans.flatMap((p) =>
    p.laps.map((l, i) => l.cumulative - stay[i].cumulative),
  );
  const low = Math.min(0, ...values) - 1,
    high = Math.max(0, ...values) + 1;
  const x = (i: number) => 65 + (i / Math.max(1, stay.length - 1)) * 635;
  const y = (v: number) => 180 - ((v - low) / (high - low)) * 145;
  return (
    <svg
      className="strategy-chart"
      viewBox="0 0 750 235"
      role="img"
      aria-label="Cumulative time difference versus staying on slicks in the simulated weather. Negative is faster."
    >
      <text x="65" y="16">
        Cumulative difference from slicks (seconds)
      </text>
      <line x1="65" x2="700" y1={y(0)} y2={y(0)} stroke="#63736a" />
      {[low, 0, high].map((v, i) => (
        <text key={i} x="59" y={y(v) + 4} textAnchor="end">
          {v.toFixed(0)}s
        </text>
      ))}
      {[
        result.config.lightRainLap,
        result.config.wetLap,
        result.config.dryingLap,
      ].map((lap) => (
        <g key={lap}>
          <line
            x1={x(lap - stay[0].lap)}
            x2={x(lap - stay[0].lap)}
            y1="30"
            y2="185"
            stroke="#536c60"
            strokeDasharray="3 4"
          />
          <text x={x(lap - stay[0].lap)} y="207" textAnchor="middle">
            L{lap} {weatherLabels[weatherAt(lap, result.config)]}
          </text>
        </g>
      ))}
      {result.plans.map((p, i) => (
        <polyline
          key={p.id}
          points={p.laps
            .map((l, j) => `${x(j)},${y(l.cumulative - stay[j].cumulative)}`)
            .join(" ")}
          fill="none"
          stroke={colors[i]}
          strokeWidth="2"
        />
      ))}
      <text x="65" y="229">
        Lap {stay[0].lap}
      </text>
      <text x="700" y="229" textAnchor="end">
        Lap 56
      </text>
    </svg>
  );
}
