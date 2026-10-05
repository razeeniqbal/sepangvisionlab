import { useState } from "react";

import type { RecordedCarState } from "../../domain/recordedSession";
import { formatLap } from "../../domain/inspection";
import TeamGlyph, { type DriverIdentity } from "../broadcast/TeamGlyph";
import { Chevron } from "../broadcast/Chevron";

const LEDS = 15,
  RPM_MAX = 12500;
// OpenF1 DRS codes: 10, 12, 14 open; 8 eligible; others closed; -1 unknown (null in source).
const drsLabel = (code: number) =>
  code < 0 ? "DRS —" : code >= 10 ? "DRS open" : code === 8 ? "DRS ready" : "DRS off";

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
      className={"rec-card" + (collapsed ? " is-collapsed" : "")}
      aria-label={"Telemetry for " + driver.name}
    >
      <header className="rec-card-head" style={{ borderTopColor: color }}>
        <span className="rec-card-number" style={{ color }}>
          {car.number}
        </span>
        <span className="rec-card-name">
          <small>Driver telemetry</small>
          <strong>{driver.name}</strong>
          <span>
            <TeamGlyph team={driver.team} color={color} size={11} /> {driver.code}{" "}
            · {driver.team.name}
          </span>
        </span>
        <span className="rec-card-pos">
          <small>Pos</small>P{car.position}
        </span>
        <Chevron
          collapsed={collapsed}
          label="driver telemetry"
          onToggle={() => setCollapsed((c) => !c)}
        />
      </header>
      {!collapsed && (
        <>
          <div className="rec-leds" aria-label={`${Math.round(car.rpm)} rpm`}>
            {Array.from({ length: LEDS }, (_, i) => (
              <i
                key={i}
                className={
                  i < lit ? (i < 5 ? "is-green" : i < 10 ? "is-red" : "is-blue") : ""
                }
              />
            ))}
            <span>{Math.round(car.rpm).toLocaleString("en-GB")} rpm</span>
          </div>
          <div className="rec-main">
            <div className="rec-speed">
              <strong>{Math.round(car.speedKph)}</strong>
              <small>km/h</small>
            </div>
            <div className="rec-gear" aria-label={"Gear " + car.gear}>
              <strong>{car.gear || "N"}</strong>
              <small>Gear</small>
            </div>
            <div className="rec-lap">
              <strong>{car.lap || "—"}</strong>
              <small>Lap</small>
            </div>
          </div>
          <div className="rec-pedals">
            <label>
              Throttle <b>{Math.round(car.throttle)}%</b>
              <meter min={0} max={100} value={car.throttle} className="is-throttle" />
            </label>
            <label>
              Brake <b>{car.brake > 0 ? "On" : "Off"}</b>
              <meter min={0} max={100} value={car.brake} className="is-brake" />
            </label>
          </div>
          <div className="rec-laps">
            <div>
              <small>Last lap</small>
              <strong>{formatLap(car.lastLap)}</strong>
            </div>
            <div>
              <small>Best lap</small>
              <strong className="is-best">{formatLap(car.bestLap)}</strong>
            </div>
          </div>
          <footer className="rec-card-foot">
            <span className={"compound compound-" + car.compound.toLowerCase()}>
              {car.compound === "UNKNOWN" ? "?" : car.compound[0]}
            </span>
            <span>
              {car.compound === "UNKNOWN" ? "Tyre unknown" : car.compound.toLowerCase()} ·{" "}
              {car.tyreAge} laps
            </span>
            <span className="rec-drs">{drsLabel(car.drs)}</span>
            <span className={"rec-status is-" + status.split(" ")[0].toLowerCase()}>
              {status}
            </span>
          </footer>
        </>
      )}
    </section>
  );
}
