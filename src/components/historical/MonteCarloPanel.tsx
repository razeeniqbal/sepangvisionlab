import { useEffect, useRef, useState } from "react";
import { formatLap } from "../../domain/inspection";
import type { StrategyResult } from "../../services/strategy";
import {
  runMonteCarlo,
  type MonteCarloResult,
  type Uncertainty,
} from "../../services/monteCarlo";
const fields = [
  { key: "paceSd", label: "Lap pace spread (s)", max: 10, step: 0.1 },
  {
    key: "degradationSd",
    label: "Degradation spread (s/lap)",
    max: 0.5,
    step: 0.01,
  },
  { key: "pitSd", label: "Pit-loss spread (s)", max: 30, step: 0.1 },
  { key: "trafficSd", label: "Traffic-cost spread (s/lap)", max: 5, step: 0.1 },
] as const;
export default function MonteCarloPanel({
  strategy,
}: {
  strategy: StrategyResult;
}) {
  const [runs, setRuns] = useState(5000),
    [seed, setSeed] = useState(42),
    [uncertainty, setUncertainty] = useState<Uncertainty>({
      paceSd: 0.5,
      degradationSd: 0.02,
      pitSd: 2,
      trafficSd: 0.2,
    });
  const [result, setResult] = useState<MonteCarloResult | null>(null),
    [pending, setPending] = useState(false),
    [error, setError] = useState(false);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  function clear() {
    request.current?.abort();
    request.current = null;
    setResult(null);
    setPending(false);
    setError(false);
  }
  async function run() {
    clear();
    const controller = new AbortController();
    request.current = controller;
    setPending(true);
    const timer = setTimeout(() => controller.abort(), 30000);
    try {
      const response = await runMonteCarlo(
        {
          strategy: {
            driverId: strategy.driverId,
            completedLaps: strategy.branchLap,
            delayedPitLap:
              strategy.plans.find((p) => p.id === "later")?.pitLap ?? null,
            assumptions: strategy.assumptions,
          },
          runs,
          seed,
          uncertainty,
        },
        controller.signal,
      );
      if (request.current === controller && !controller.signal.aborted)
        setResult(response);
    } catch {
      if (request.current === controller) setError(true);
    } finally {
      clearTimeout(timer);
      if (request.current === controller) setPending(false);
    }
  }
  return (
    <section
      className="monte-carlo"
      aria-label="Monte Carlo strategy simulation"
    >
      <div className="telemetry-heading">
        <h2>
          MONTE CARLO <span>/ HYPOTHETICAL UNCERTAINTY</span>
        </h2>
        <span>
          {strategy.driverName} · FROZEN LAP {strategy.branchLap}
        </span>
      </div>
      <p>
        Run the same plans through paired random scenarios. Spreads below are
        assumed standard deviations, not fitted uncertainty from race data.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void run();
        }}
      >
        <div className="strategy-inputs">
          <label>
            Simulation runs
            <select
              value={runs}
              onChange={(e) => {
                clear();
                setRuns(Number(e.target.value));
              }}
            >
              {[1000, 5000, 10000].map((n) => (
                <option key={n} value={n}>
                  {n.toLocaleString()}
                </option>
              ))}
            </select>
          </label>
          <label>
            Random seed
            <input
              required
              type="number"
              min="0"
              max="4294967295"
              step="1"
              value={Number.isNaN(seed) ? "" : seed}
              onChange={(e) => {
                clear();
                setSeed(e.target.valueAsNumber);
              }}
            />
          </label>
          {fields.map((f) => (
            <label key={f.key}>
              {f.label}
              <input
                required
                type="number"
                min="0"
                max={f.max}
                step={f.step}
                value={
                  Number.isNaN(uncertainty[f.key]) ? "" : uncertainty[f.key]
                }
                onChange={(e) => {
                  const value = e.target.valueAsNumber;
                  clear();
                  setUncertainty((u) => ({ ...u, [f.key]: value }));
                }}
              />
            </label>
          ))}
        </div>
        <button type="submit" disabled={pending}>
          {pending ? "Running scenarios…" : "Run Monte Carlo"}
        </button>
      </form>
      {error && (
        <p role="alert">
          Simulation could not finish. Check the local service and retry.
        </p>
      )}
      {result && (
        <div className="monte-results">
          <h3>
            {result.runs.toLocaleString()} scenarios · seed {result.seed}
          </h3>
          <div className="strategy-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Plan</th>
                  <th>Median remaining</th>
                  <th>P10–P90 remaining</th>
                  <th>Median Δ vs stay</th>
                  <th>P10–P90 Δ</th>
                  <th>Fastest share</th>
                  <th>Beats stay</th>
                </tr>
              </thead>
              <tbody>
                {result.plans.map((p) => (
                  <tr key={p.id}>
                    <th>{p.label}</th>
                    <td>{formatLap(p.remaining.p50)}</td>
                    <td>
                      {formatLap(p.remaining.p10)}–{formatLap(p.remaining.p90)}
                    </td>
                    <td>{p.delta.p50.toFixed(2)}s</td>
                    <td>
                      {p.delta.p10.toFixed(2)} to {p.delta.p90.toFixed(2)}s
                    </td>
                    <td data-testid={`mc-share-${p.id}`}>
                      {(p.fastestShare * 100).toFixed(1)}%
                    </td>
                    <td>{(p.beatsStay * 100).toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mc-histograms">
            {result.plans.map((p, i) => {
              const max = Math.max(1, ...p.histogram.map((b) => b.count));
              return (
                <div key={p.id}>
                  <h3>{p.label} · Δ distribution</h3>
                  <svg
                    viewBox="0 0 320 160"
                    role="img"
                    aria-label={`${p.label}: distribution of simulated remaining-time differences versus staying out. Median ${p.delta.p50.toFixed(2)} seconds.`}
                  >
                    {p.histogram.map((b, j) => (
                      <rect
                        key={j}
                        x={30 + j * 13}
                        y={125 - (b.count / max) * 95}
                        width="11"
                        height={(b.count / max) * 95}
                        fill={["#9bafa4", "#00c4b4", "#e3ac66"][i]}
                      >
                        <title>
                          {b.lower.toFixed(2)} to {b.upper.toFixed(2)}s:{" "}
                          {b.count} scenarios
                        </title>
                      </rect>
                    ))}
                    <text x="30" y="20">
                      {max} scenarios (peak bin)
                    </text>
                    <text x="30" y="148">
                      {p.histogram[0].lower.toFixed(1)}s
                    </text>
                    <text x="290" y="148" textAnchor="end">
                      {p.histogram.at(-1)!.upper.toFixed(1)}s
                    </text>
                  </svg>
                </div>
              );
            })}
          </div>
          <p>
            P10–P90 covers the middle 80% of simulated outcomes, not a
            confidence interval for the real race. Negative deltas mean faster
            than staying out in the same scenario. Fastest share splits ties
            evenly; “beats stay” counts strict improvements.
          </p>
        </div>
      )}
      <p>
        Normal draws; degradation, pit loss and traffic are clipped at zero, so
        their realized means can differ from the inputs near zero. Pace noise
        and traffic vary by lap; degradation and pit loss vary by scenario.
        Paired plans share the same random draws. Common pace noise therefore
        cancels in relative differences unless the one-second lap-time floor is
        reached. No weather transitions, incidents, safety cars or calibrated
        race probabilities.
      </p>
    </section>
  );
}
