import { useState } from "react";
import type { RecordedCarState } from "../../domain/recordedSession";
import { formatLap } from "../../domain/inspection";
import TeamGlyph, { type DriverIdentity } from "../broadcast/TeamGlyph";
import { Chevron } from "../broadcast/Chevron";
import GMeter from "./GMeter";

const LEDS = 15,
  RPM_MAX = 12500;
// OpenF1 DRS codes: 10, 12, 14 open; 8 eligible; others closed; -1 unknown (null in source).
const drsLabel = (code: number) =>
  code < 0 ? "—" : code >= 10 ? "Open" : code === 8 ? "Ready" : "Off";

/** Recorded telemetry: real channels from OpenF1 car_data, held up to 2 s, never invented. */
export default function RecordedTelemetryCard({
  car,
  driver,
  color,
}: {
  car: RecordedCarState;
  driver: DriverIdentity;
  color: string;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const lit = Math.round((Math.min(car.rpm, RPM_MAX) / RPM_MAX) * LEDS);
  const status = !car.present
    ? "Not running"
    : car.stale
      ? "Stale data"
      : car.inPit
        ? "In pit lane"
        : "On track";
  return (
    <section
      className={"sv-card sv-telemetry glass" + (collapsed ? " is-collapsed" : "")}
      aria-label={"Telemetry for " + driver.name}
      style={{ ["--team" as string]: color }}
    >
      <header className="sv-card-head">
        <span className="sv-number">{car.number}</span>
        <span className="sv-driver">
          <strong>{driver.name}</strong>
          <span>
            <TeamGlyph team={driver.team} color={color} size={10} /> {driver.team.name}
          </span>
        </span>
        <span className="sv-position">P{car.position}</span>
        <Chevron collapsed={collapsed} label="driver telemetry" onToggle={() => setCollapsed((c) => !c)} />
      </header>
      {!collapsed && (
        <>
          <div className="sv-leds" aria-label={`${Math.round(car.rpm)} rpm`}>
            {Array.from({ length: LEDS }, (_, i) => (
              <i key={i} className={i < lit ? (i < 5 ? "is-green" : i < 10 ? "is-red" : "is-blue") : ""} />
            ))}
          </div>
          <div className="sv-gauges">
            <div className="sv-speed-readout">
              <strong>{Math.round(car.speedKph)}</strong>
              <small>km/h</small>
            </div>
            <div className="sv-gear" aria-label={"Gear " + car.gear}>
              <strong>{car.gear || "N"}</strong>
              <small>Gear</small>
            </div>
            <div className="sv-stat">
              <strong>{Math.round(car.rpm).toLocaleString("en-GB")}</strong>
              <small>RPM</small>
            </div>
          </div>
          <div className="sv-bars-row">
          <div className="sv-bars">
            <div>
              <span>Throttle</span>
              <i style={{ ["--level" as string]: car.throttle / 100 }} className="is-throttle" />
              <b>{Math.round(car.throttle)}%</b>
            </div>
            <div>
              <span>Brake</span>
              <i style={{ ["--level" as string]: car.brake / 100 }} className="is-brake" />
              <b>{car.brake > 0 ? "On" : "Off"}</b>
            </div>
          </div>
          <GMeter long={car.gLong} lat={car.gLat} size={56} />
          </div>
          <dl className="sv-facts">
            <div>
              <dt>Lap</dt>
              <dd>{car.lap || "—"}</dd>
            </div>
            <div>
              <dt>Last</dt>
              <dd>{formatLap(car.lastLap)}</dd>
            </div>
            <div>
              <dt>Best</dt>
              <dd className="is-best">{formatLap(car.bestLap)}</dd>
            </div>
            <div>
              <dt>Tyre</dt>
              <dd>
                <span className={"compound compound-" + car.compound.toLowerCase()}>
                  {car.compound === "UNKNOWN" ? "?" : car.compound[0]}
                </span>{" "}
                {car.tyreAge} laps
              </dd>
            </div>
            <div>
              <dt>DRS</dt>
              <dd>{drsLabel(car.drs)}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd className={"sv-status-text is-" + status.split(" ")[0].toLowerCase()}>{status}</dd>
            </div>
          </dl>
        </>
      )}
    </section>
  );
}
