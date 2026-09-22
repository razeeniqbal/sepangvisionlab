import WeatherPanel from "./WeatherPanel";
import MonteCarloPanel from "./MonteCarloPanel";
import { useEffect, useRef, useState } from "react";
import type { HistoricalDriver } from "../../services/historical";
import { historicalTime } from "../../services/historical";
import { formatLap } from "../../domain/inspection";
import {
  compareStrategy,
  defaultAssumptions,
  type StrategyAssumptions,
  type StrategyResult,
} from "../../services/strategy";
const fields = [
  {
    key: "currentDegradation",
    label: "Existing-tyre pace loss (s/lap)",
    min: 0,
    max: 2,
    step: 0.01,
  },
  {
    key: "freshDegradation",
    label: "New-tyre pace loss (s/lap)",
    min: 0,
    max: 2,
    step: 0.01,
  },
  {
    key: "freshPaceDelta",
    label: "New-tyre initial pace delta (s)",
    min: -10,
    max: 10,
    step: 0.1,
  },
  {
    key: "pitLoss",
    label: "Total pit time loss (s)",
    min: 0,
    max: 120,
    step: 0.1,
  },
  {
    key: "trafficPenalty",
    label: "Post-pit traffic cost each lap (s)",
    min: 0,
    max: 10,
    step: 0.1,
  },
] as const;
function DeltaChart({ result }: { result: StrategyResult }) {
  const stay = result.plans[0];
  const deltas = result.plans.flatMap((p) =>
    p.laps.map((l, i) => l.cumulative - stay.laps[i].cumulative),
  );
  const low = Math.min(0, ...deltas) - 1,
    high = Math.max(0, ...deltas) + 1;
  const x = (i: number) => 50 + (i / Math.max(1, stay.laps.length - 1)) * 660;
  const y = (d: number) => 180 - ((d - low) / (high - low)) * 150;
  return (
    <svg
      className="strategy-chart"
      viewBox="0 0 750 225"
      role="img"
      aria-label="Projected cumulative time difference from staying out; negative values are faster. Hypothetical scenarios."
    >
      <line x1="50" x2="710" y1={y(0)} y2={y(0)} stroke="#63736a" />
      {[low, 0, high].map((v, i) => (
        <text key={i} x="42" y={y(v) + 4} textAnchor="end">
          {v.toFixed(1)}s
        </text>
      ))}
      {result.plans.map((plan, i) => (
        <polyline
          key={plan.id}
          points={plan.laps
            .map(
              (l, j) => `${x(j)},${y(l.cumulative - stay.laps[j].cumulative)}`,
            )
            .join(" ")}
          fill="none"
          stroke={["#9bafa4", "#00c4b4", "#e3ac66"][i]}
          strokeWidth="2.5"
        />
      ))}
      <text x="50" y="211">
        Lap {result.branchLap + 1}
      </text>
      <text x="710" y="211" textAnchor="end">
        Lap 56
      </text>
      <text x="50" y="17">
        Cumulative difference from stay out
      </text>
    </svg>
  );
}
export default function StrategyLab({
  driver,
  completed,
}: {
  driver: HistoricalDriver;
  completed: number;
}) {
  const [branch, setBranch] = useState<{
    driverId: string;
    name: string;
    lap: number;
    time: number;
  } | null>(null);
  const [assumptions, setAssumptions] = useState<StrategyAssumptions>({
    ...defaultAssumptions,
  });
  const [pitLap, setPitLap] = useState<number | null>(null);
  const [result, setResult] = useState<StrategyResult | null>(null),
    [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const currentRequest = useRef<AbortController | null>(null);
  useEffect(() => () => currentRequest.current?.abort(), []);
  const knownPits = new Set(
    driver.pits.filter((p) => p.lap <= completed).map((p) => p.lap),
  );
  const clean = driver.timing
    .slice(0, completed)
    .filter(
      (l) => l.lap > 1 && !knownPits.has(l.lap) && !knownPits.has(l.lap - 1),
    );
  const available =
    clean.length >= 3 && completed < driver.laps && completed < 56;
  function invalidate() {
    currentRequest.current?.abort();
    currentRequest.current = null;
    setResult(null);
    setError("");
    setPending(false);
  }
  function capture() {
    invalidate();
    setBranch({
      driverId: driver.id,
      name: driver.name,
      lap: completed,
      time: driver.timing[completed - 1].endTime,
    });
    setPitLap(completed < 55 ? Math.min(55, completed + 3) : null);
  }
  function change<K extends keyof StrategyAssumptions>(
    key: K,
    value: StrategyAssumptions[K],
  ) {
    invalidate();
    setAssumptions((a) => ({
      ...a,
      [key]: value,
      ...(key === "weather" && value === "dry" ? { weatherPenalty: 0 } : {}),
    }));
  }
  async function simulate() {
    if (!branch) return;
    invalidate();
    const controller = new AbortController();
    currentRequest.current = controller;
    setPending(true);
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const data = await compareStrategy(
        {
          driverId: branch.driverId,
          completedLaps: branch.lap,
          delayedPitLap: pitLap,
          assumptions,
        },
        controller.signal,
      );
      if (currentRequest.current === controller && !controller.signal.aborted)
        setResult(data);
    } catch {
      if (currentRequest.current === controller)
        setError(
          "Comparison unavailable. Check the values and local service, then try again.",
        );
    } finally {
      clearTimeout(timer);
      if (currentRequest.current === controller) setPending(false);
    }
  }
  return (
    <section className="strategy-panel" aria-label="Strategy Lab">
      <div className="telemetry-heading">
        <h2>
          STRATEGY LAB <span>/ HYPOTHETICAL BRANCH</span>
        </h2>
        <span>STRATEGY COMPARISON · ASSUMPTIONS ONLY</span>
      </div>
      <p>
        Branch at the selected driver’s last completed timing line. The replay
        stays unchanged. No actual tyre compound or degradation is inferred.
      </p>
      <button onClick={capture} disabled={!available}>
        Branch from {driver.name} · lap {completed}
      </button>
      {!available && (
        <p>
          Branching needs three completed non-pit laps after the opening lap,
          with timing coverage remaining.
        </p>
      )}
      {branch && (
        <>
          <p className="strategy-anchor">
            Frozen branch: {branch.name}, end of lap {branch.lap} at{" "}
            {historicalTime(branch.time)}. Finish target: lap 56. Changing
            replay position does not move this branch.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void simulate();
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
                    value={
                      Number.isNaN(assumptions[f.key]) ? "" : assumptions[f.key]
                    }
                    onChange={(e) => change(f.key, e.target.valueAsNumber)}
                  />
                </label>
              ))}
              <label>
                New compound label
                <select
                  value={assumptions.compound}
                  onChange={(e) =>
                    change(
                      "compound",
                      e.target.value as StrategyAssumptions["compound"],
                    )
                  }
                >
                  {["SOFT", "MEDIUM", "HARD"].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
              {pitLap !== null && (
                <label>
                  Delayed stop after lap
                  <input
                    type="number"
                    required
                    min={branch.lap + 1}
                    max="55"
                    step="1"
                    value={Number.isNaN(pitLap) ? "" : pitLap}
                    onChange={(e) => {
                      invalidate();
                      setPitLap(e.target.valueAsNumber);
                    }}
                  />
                </label>
              )}
              <label>
                Weather assumption
                <select
                  value={assumptions.weather}
                  onChange={(e) =>
                    change(
                      "weather",
                      e.target.value as StrategyAssumptions["weather"],
                    )
                  }
                >
                  <option value="dry">Dry</option>
                  <option value="custom">Custom uniform slowdown</option>
                </select>
              </label>
              {assumptions.weather === "custom" && (
                <label>
                  Weather time cost each lap (s)
                  <input
                    required
                    type="number"
                    min="0"
                    max="60"
                    step=".1"
                    value={
                      Number.isNaN(assumptions.weatherPenalty)
                        ? ""
                        : assumptions.weatherPenalty
                    }
                    onChange={(e) =>
                      change("weatherPenalty", e.target.valueAsNumber)
                    }
                  />
                </label>
              )}
            </div>
            <p>
              Defaults are illustrative. Compound labels do not supply
              calibrated pace: use the pace fields above. Negative new-tyre pace
              delta means faster. Pit loss includes the whole stop and pit-lane
              loss, not just stationary service time.
            </p>
            <button className="strategy-run" type="submit" disabled={pending}>
              {pending ? "Comparing…" : "Compare strategies"}
            </button>
          </form>
        </>
      )}
      {error && <p role="alert">{error}</p>}
      {result && (
        <div className="strategy-results">
          <h3>
            Projected remaining time · {result.driverName}, lap{" "}
            {result.branchLap} → 56
          </h3>
          <p>
            Starting pace {formatLap(result.baselineSeconds)}: median of
            completed laps {result.baselineLaps.join(", ")}. No later historical
            laps are used.
          </p>
          <div className="strategy-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Plan</th>
                  <th>Tyres after stop</th>
                  <th>Remaining time</th>
                  <th>Versus stay out</th>
                </tr>
              </thead>
              <tbody>
                {result.plans.map((plan) => (
                  <tr
                    key={plan.id}
                    className={
                      plan.id === result.fastestPlan ? "strategy-fastest" : ""
                    }
                  >
                    <th>
                      {plan.label}
                      {plan.id === result.fastestPlan
                        ? " · fastest in this model"
                        : ""}
                    </th>
                    <td>{plan.compound}</td>
                    <td>{formatLap(plan.remainingSeconds)}</td>
                    <td data-testid={`strategy-delta-${plan.id}`}>
                      {plan.deltaToStay >= 0 ? "+" : ""}
                      {plan.deltaToStay.toFixed(3)}s
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <DeltaChart result={result} />
          <p>
            Gray: stay out · Turquoise: pit at branch · Amber: delayed pit.
            Negative differences are faster. Each stop is charged once at the
            boundary before the first new-tyre lap.
          </p>
        </div>
      )}
      {result && (
        <MonteCarloPanel key={JSON.stringify(result)} strategy={result} />
      )}
      {result && (
        <WeatherPanel key={"weather:" + JSON.stringify(result)} strategy={result} />
      )}
      <p className="strategy-limit">
        The original strategy comparison and Monte Carlo use single-driver,
        one-stop scenarios only. Linear pace change, fixed pit loss and a
        user-set traffic cost; no overtaking, finish-position prediction,
        incidents, safety cars or weather transitions. Results depend on the
        assumptions and are not a race recommendation.
      </p>
    </section>
  );
}
