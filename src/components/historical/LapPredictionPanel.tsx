import { useEffect, useState } from "react";
import type { HistoricalDriver } from "../../services/historical";
import { formatLap } from "../../domain/inspection";
import { historicalTime } from "../../services/historical";
interface Metrics {
  mae: number;
  rmse: number;
  r2: number;
}
interface Forecast {
  driverId: string;
  lap: number;
  issuedAt: number;
  prediction: number;
  baseline: number;
  previousLaps: number[];
}
interface Report {
  schemaVersion: 1;
  sessionId: string;
  selectedModel: string;
  trainEnd: number;
  validationEnd: number;
  counts: Record<string, number>;
  models: { name: string; validation: Metrics; test: Metrics }[];
  forecasts: Forecast[];
  limitations: string;
}
const object = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null;
const finite = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);
function parseReport(v: unknown): Report {
  if (
    !object(v) ||
    v.schemaVersion !== 1 ||
    v.sessionId !== "malaysia-2017" ||
    typeof v.selectedModel !== "string" ||
    !finite(v.trainEnd) ||
    !finite(v.validationEnd) ||
    !object(v.counts) ||
    !Object.values(v.counts).every((n) => finite(n) && n >= 0) ||
    !Array.isArray(v.models) ||
    v.models.length !== 4 ||
    !Array.isArray(v.forecasts) ||
    typeof v.limitations !== "string"
  )
    throw Error("Invalid ML report");
  for (const m of v.models)
    if (
      !object(m) ||
      typeof m.name !== "string" ||
      ![m.validation, m.test].every(
        (x) =>
          object(x) &&
          finite(x.mae) &&
          x.mae >= 0 &&
          finite(x.rmse) &&
          x.rmse >= 0 &&
          finite(x.r2),
      )
    )
      throw Error("Invalid metrics");
  if (!v.models.some((m) => m.name === v.selectedModel))
    throw Error("Unknown selected model");
  for (const f of v.forecasts)
    if (
      !object(f) ||
      typeof f.driverId !== "string" ||
      !finite(f.lap) ||
      !Number.isInteger(f.lap) ||
      !finite(f.issuedAt) ||
      f.issuedAt < v.validationEnd ||
      !finite(f.prediction) ||
      f.prediction <= 0 ||
      !finite(f.baseline) ||
      f.baseline <= 0 ||
      !Array.isArray(f.previousLaps) ||
      f.previousLaps.length !== 3 ||
      !f.previousLaps.every((n) => finite(n) && n > 0)
    )
      throw Error("Invalid forecast");
  return v as unknown as Report;
}
export default function LapPredictionPanel({
  driver,
  time,
  completed,
  onSeek,
}: {
  driver: HistoricalDriver;
  time: number;
  completed: number;
  onSeek: (time: number) => void;
}) {
  const [report, setReport] = useState<Report | null>(null),
    [failed, setFailed] = useState(false),
    [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setFailed(false);
    const timer = setTimeout(() => controller.abort(), 15000);
    fetch("/api/v1/ml/lap-times/report", { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw Error();
        return r.json();
      })
      .then(parseReport)
      .then((r) => {
        if (active) setReport(r);
      })
      .catch(() => {
        if (active) setFailed(true);
      })
      .finally(() => clearTimeout(timer));
    return () => {
      active = false;
      controller.abort();
      clearTimeout(timer);
    };
  }, [attempt]);
  if (!report)
    return (
      <section className="ml-panel">
        <h2>LAP-TIME EXPERIMENT</h2>
        <p>
          {failed
            ? "The trained experiment is unavailable."
            : "Loading lap-time experiment…"}
        </p>
        {failed && (
          <button onClick={() => setAttempt((a) => a + 1)}>
            Retry lap-time experiment
          </button>
        )}
      </section>
    );
  const forecast = report.forecasts.find(
    (f) =>
      f.driverId === driver.id &&
      f.lap === completed + 1 &&
      f.issuedAt <= time + 1e-9,
  );
  const first = report.forecasts.find((f) => f.driverId === driver.id);
  const selectedScore = report.models.find(
    (m) => m.name === report.selectedModel,
  )!;
  const baselineScore = report.models.find(
    (m) => m.name === "Previous-lap baseline",
  );
  const previous = report.forecasts.find(
    (f) => f.driverId === driver.id && f.lap === completed,
  );
  const actual = driver.timing[completed - 1];
  return (
    <section
      className="ml-panel"
      aria-label="Lap-time machine learning experiment"
    >
      <div className="telemetry-heading">
        <h2>
          LAP-TIME ML <span>/ SINGLE-RACE EXPERIMENT</span>
        </h2>
        <span>{report.selectedModel.toUpperCase()} · VALIDATION SELECTED</span>
      </div>
      <div className="ml-forecast">
        <div>
          <span className="eyebrow">
            {driver.name} ·{" "}
            {forecast
              ? `LAP ${forecast.lap} FORECAST`
              : "FORECAST AVAILABILITY"}
          </span>
          <strong data-testid="lap-prediction">
            {forecast ? formatLap(forecast.prediction) : "—"}
          </strong>
          <p>
            {forecast
              ? `Issued at ${historicalTime(forecast.issuedAt)} from the previous three completed laps. Previous-lap baseline: ${formatLap(forecast.baseline)}.`
              : !driver.laps
                ? "No recorded laps for this driver."
                : completed >= driver.laps
                  ? "No further recorded lap to forecast."
                  : "Forecasts begin after the 01:05:00 model-selection cutoff and the next completed lap."}
          </p>
          {!forecast && first && time < first.issuedAt && (
            <button onClick={() => onSeek(first.issuedAt)}>
              Jump to first evaluated forecast
            </button>
          )}
        </div>
        <div>
          <span className="eyebrow">LAST COMPLETED FORECAST ERROR</span>
          <strong>
            {previous && actual
              ? `${previous.prediction - actual.seconds >= 0 ? "+" : ""}${(previous.prediction - actual.seconds).toFixed(3)}s`
              : "—"}
          </strong>
          <p>
            Predicted minus recorded lap time. Actual outcomes appear only after
            the lap completes.
          </p>
        </div>
      </div>
      {baselineScore && selectedScore.test.mae > baselineScore.test.mae && (
        <p className="ml-caution">
          The validation-selected model does not beat the previous-lap baseline
          on test MAE. This experiment has not demonstrated an improvement in
          average error.
        </p>
      )}
      <h3>Model comparison · held-out later laps</h3>
      <div className="ml-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Model</th>
              <th>Validation MAE</th>
              <th>Test MAE</th>
              <th>Test RMSE</th>
              <th>Test R²</th>
            </tr>
          </thead>
          <tbody>
            {report.models.map((m) => (
              <tr
                key={m.name}
                className={m.name === report.selectedModel ? "ml-selected" : ""}
              >
                <th>
                  {m.name}
                  {m.name === report.selectedModel ? " · selected" : ""}
                </th>
                <td>{m.validation.mae.toFixed(3)}s</td>
                <td>{m.test.mae.toFixed(3)}s</td>
                <td>{m.test.rmse.toFixed(3)}s</td>
                <td>{m.test.r2.toFixed(3)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        Train: laps completed by 00:45:00 ({report.counts.train}). Select: laps
        starting after 00:45:00 and completed by 01:05:00 (
        {report.counts.validation}). Test: laps starting after 01:05:00 (
        {report.counts.test}). Boundary-crossing laps excluded:{" "}
        {report.counts.excludedBoundary}. No random split or test-based model
        selection.
      </p>
      <p>
        MAE is average absolute error; RMSE emphasizes larger misses. Lower is
        better for both. R² can be negative when predictions are worse than
        predicting the test mean. Scores summarize the whole held-out period,
        not live confidence.
      </p>
      <p>{report.limitations}</p>
    </section>
  );
}
