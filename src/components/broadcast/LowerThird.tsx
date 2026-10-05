import type { FictionalDriver } from "../../data/fictionalGrid";
import type { PhysicsCarState } from "../../domain/physicsField";
import { useState } from "react";
import TeamGlyph from "./TeamGlyph";
import { Chevron } from "./Chevron";

export default function LowerThird({
  car,
  driver,
  color,
  lastLap,
  ghostGap,
}: {
  car: PhysicsCarState;
  driver: FictionalDriver;
  color: string;
  lastLap: string;
  ghostGap: number | null;
}) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <section
      className={"bc-lower-third" + (collapsed ? " is-collapsed" : "")}
      aria-label={"Selected driver " + driver.name}
    >
      <div className="bc-lt-position" aria-label={"Position " + car.position}>
        <small>P</small>
        {car.position}
      </div>
      <div className="bc-lt-identity" style={{ borderLeftColor: color }}>
        <span className="bc-lt-team">
          <TeamGlyph team={driver.team} color={color} size={11} />{" "}
          {driver.team.name}
        </span>
        <strong className="bc-lt-name">
          {driver.name}
          <Chevron
            collapsed={collapsed}
            label="driver telemetry"
            onToggle={() => setCollapsed((c) => !c)}
          />
        </strong>
        <span className="bc-lt-meta">
          #{car.number} · Lap {car.completedLaps + 1} · Last {lastLap}
        </span>
      </div>
      <div
        className="bc-lt-speed"
        aria-label={car.speedKph.toFixed(0) + " kilometres per hour"}
      >
        <strong>{car.speedKph.toFixed(0)}</strong>
        <small>km/h</small>
        <small className="bc-lt-modelled">Modelled</small>
      </div>
      <div
        className="bc-lt-pedals"
        aria-label={`Throttle ${car.throttle.toFixed(0)}%, brake ${car.brake.toFixed(0)}%`}
      >
        <span
          className="bc-pedal bc-pedal-throttle"
          style={{ ["--level" as string]: car.throttle / 100 }}
        />
        <span
          className="bc-pedal bc-pedal-brake"
          style={{ ["--level" as string]: car.brake / 100 }}
        />
      </div>
      {ghostGap !== null && (
        <div
          className={"bc-lt-ghost " + (ghostGap > 0 ? "is-behind" : "is-ahead")}
          aria-label={"Gap to ghost " + ghostGap.toFixed(2) + " seconds"}
        >
          <small>Ghost</small>
          <strong>
            {ghostGap > 0 ? "+" : "−"}
            {Math.abs(ghostGap).toFixed(2)}
          </strong>
        </div>
      )}
    </section>
  );
}
