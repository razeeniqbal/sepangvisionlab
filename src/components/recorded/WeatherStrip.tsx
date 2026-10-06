import type { WeatherRow } from "../../domain/recordedSession";

const fmt = (v: number | null | undefined, unit: string, digits = 1) =>
  v === null || v === undefined ? "—" : v.toFixed(digits) + unit;

/** Weather chips from OpenF1 `weather` (about one reading a minute) at the replay time. */
export default function WeatherStrip({ weather }: { weather: WeatherRow | null }) {
  const rain = (weather?.rain ?? 0) > 0;
  return (
    <section className="sv-weather" aria-label="Weather">
      <span className="sv-pill glass">
        Air <b>{fmt(weather?.air, "°")}</b>
      </span>
      <span className="sv-pill glass">
        Track <b>{fmt(weather?.track, "°")}</b>
      </span>
      <span className={"sv-pill glass" + (rain ? " is-rain" : "")}>
        {rain ? "Raining" : "Dry"}
      </span>
      <span className="sv-pill glass">
        Humidity <b>{fmt(weather?.humidity, "%", 0)}</b>
      </span>
    </section>
  );
}
