import type { WeatherRow } from "../../domain/recordedSession";

const fmt = (v: number | null | undefined, unit: string) =>
  v === null || v === undefined ? "—" : v.toFixed(1) + unit;

/** Weather from OpenF1 `weather` (about one reading a minute), latest at the replay time. */
export default function WeatherStrip({ weather }: { weather: WeatherRow | null }) {
  const rain = (weather?.rain ?? 0) > 0;
  return (
    <section className="rec-weather" aria-label="Weather">
      <span>
        Air <b>{fmt(weather?.air, "°C")}</b>
      </span>
      <span>
        Track <b>{fmt(weather?.track, "°C")}</b>
      </span>
      <span className={rain ? "is-rain" : ""}>
        Rain <b>{weather ? (rain ? "Yes" : "No") : "—"}</b>
      </span>
      <span>
        Humidity <b>{fmt(weather?.humidity, "%")}</b>
      </span>
    </section>
  );
}
