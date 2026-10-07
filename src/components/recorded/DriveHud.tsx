import type { RecordedCarState } from "../../domain/recordedSession";
import GMeter from "./GMeter";

const RPM_MAX = 12500;
// 240° gauge arc, open at the bottom.
const START = 150,
  SWEEP = 240,
  R = 74;
const point = (deg: number, r = R) => {
  const a = (deg * Math.PI) / 180;
  return [100 + Math.cos(a) * r, 100 + Math.sin(a) * r];
};
const arc = (from: number, to: number, r = R) => {
  const [x1, y1] = point(from, r),
    [x2, y2] = point(to, r);
  return `M${x1} ${y1}A${r} ${r} 0 ${to - from > 180 ? 1 : 0} 1 ${x2} ${y2}`;
};

/** Racing-game style HUD for the chase and onboard cameras: real recorded channels only. */
export default function DriveHud({
  car,
  code,
  color,
  laps,
}: {
  car: RecordedCarState;
  code: string;
  color: string;
  laps?: number;
}) {
  const rpm = Math.max(0, Math.min(1, car.rpm / RPM_MAX));
  const shift = rpm > 0.92;
  const throttle = Math.max(0, Math.min(1, car.throttle / 100));
  const braking = car.brake > 0;
  return (
    <section
      className={"sv-hud" + (shift ? " is-shift" : "")}
      aria-label={`${code}: ${Math.round(car.speedKph)} km/h, gear ${car.gear || "neutral"}`}
      style={{ ["--team" as string]: color }}
    >
      <svg viewBox="0 0 200 200" aria-hidden="true">
        <path className="sv-hud-track" d={arc(START, START + SWEEP)} />
        <path className="sv-hud-red" d={arc(START + SWEEP * 0.88, START + SWEEP)} />
        {rpm > 0.005 && <path className="sv-hud-rpm" d={arc(START, START + SWEEP * rpm)} />}
        <path className="sv-hud-throttle" d={arc(START + 6, START + 6 + 52 * throttle, 88)} />
        {braking && <path className="sv-hud-brake" d={arc(START + SWEEP - 58, START + SWEEP - 6, 88)} />}
        {Array.from({ length: 13 }, (_, i) => {
          const [x1, y1] = point(START + (SWEEP * i) / 12, 62),
            [x2, y2] = point(START + (SWEEP * i) / 12, i % 2 ? 58 : 54);
          return <line key={i} className="sv-hud-tick" x1={x1} y1={y1} x2={x2} y2={y2} />;
        })}
      </svg>
      <div className="sv-hud-core">
        <strong>{Math.round(car.speedKph)}</strong>
        <small>km/h</small>
        <b className="sv-hud-gear">{car.gear || "N"}</b>
      </div>
      <div className="sv-hud-g">
        <GMeter long={car.gLong} lat={car.gLat} size={58} />
      </div>
      <div className="sv-hud-meta">
        <span className="sv-hud-pos">P{car.position}</span>
        <span>
          Lap {car.lap || "—"}
          {laps ? <small>/{laps}</small> : null}
        </span>
        <span className={"compound compound-" + car.compound.toLowerCase()} title={car.compound}>
          {car.compound === "UNKNOWN" ? "?" : car.compound[0]}
        </span>
        <span>{car.tyreAge}L</span>
        {car.drs >= 10 && <span className="sv-hud-drs">DRS</span>}
      </div>
    </section>
  );
}
