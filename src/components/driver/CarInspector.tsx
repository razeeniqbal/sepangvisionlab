import type { CarDefinition, CarState } from "../../domain/field";
import { SIMULATION_RATE } from "../../domain/field";
import {
  estimatedGap,
  lastFullLapSeconds,
  formatLap,
} from "../../domain/inspection";
import { brand } from "../../data/brand";
interface Props {
  car: CarState;
  definition: CarDefinition;
  leader: CarState;
  leaderDefinition: CarDefinition;
  running: boolean;
  onToggle: () => void;
  onReset: () => void;
}
export default function CarInspector({
  car,
  definition,
  leader,
  leaderDefinition,
  running,
  onToggle,
  onReset,
}: Props) {
  const petronas = car.number === "07";
  return (
    <aside
      className="inspector"
      aria-label={"Inspector for car " + car.number}
      data-testid="inspector"
    >
      <div className="panel-heading">
        CAR INSPECTOR <span className="live-dot" />
      </div>
      <div className="vehicle">
        <div className="car-number" style={{ color: definition.color }}>
          {car.number}
        </div>
        <div>
          <span className="eyebrow">SELECTED VEHICLE</span>
          <h3>{petronas ? brand.name : "CAR " + car.number}</h3>
          <span className="muted">
            {petronas
              ? "Turquoise / Silver / Carbon"
              : "Fictional development entry"}
          </span>
        </div>
      </div>
      {petronas ? (
        <div className="brand-block">
          <img
            src={brand.logo}
            alt="PETRONAS"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
          <span>
            CAR 07
            <br />
            <b>DEVELOPMENT LIVERY</b>
          </span>
        </div>
      ) : (
        <div
          className="entry-block"
          style={{ borderLeftColor: definition.color }}
        >
          <span>SYNTHETIC ENTRY</span>
          <b>Independent test vehicle</b>
        </div>
      )}
      <div className="inspector-primary">
        <div>
          <span>POSITION</span>
          <strong data-testid="position">P{car.position}</strong>
        </div>
        <div>
          <span>CURRENT LAP</span>
          <strong data-testid="lap">
            {String(car.completedLaps + 1).padStart(2, "0")}
          </strong>
        </div>
      </div>
      <div className="progress-section">
        <div>
          <span>TRACK PROGRESS</span>
          <b data-testid="progress">{(car.progress * 100).toFixed(1)}%</b>
        </div>
        <progress
          max={1}
          value={car.progress}
          aria-label="Selected car track progress"
        />
      </div>
      <dl className="inspector-values">
        <div>
          <dt>Speed · synthetic</dt>
          <dd data-testid="speed">{car.speedKph.toFixed(1)} km/h</dd>
        </div>
        <div>
          <dt>Tyre compound</dt>
          <dd className={"tyre-text tyre-" + car.compound.toLowerCase()}>
            {car.compound}
          </dd>
        </div>
        <div>
          <dt>Tyre age</dt>
          <dd>{car.tyreAge} laps</dd>
        </div>
        <div>
          <dt>Gap to leader · est.</dt>
          <dd>
            {car.id === leader.id
              ? "LEADER"
              : "+" +
                estimatedGap(car, leader, leaderDefinition).toFixed(2) +
                " s"}
          </dd>
        </div>
        <div>
          <dt>Last full lap</dt>
          <dd data-testid="last-lap">
            {formatLap(lastFullLapSeconds(car, definition))}
          </dd>
        </div>
        <div>
          <dt>Target lap · simulated</dt>
          <dd>{formatLap(definition.lapSeconds * SIMULATION_RATE)}</dd>
        </div>
      </dl>
      <div className="controls">
        <button className="primary" onClick={onToggle}>
          {running ? "Ⅱ  Pause session" : "▶  Resume session"}
        </button>
        <button onClick={onReset}>Reset</button>
      </div>
      <p className="note">
        Synthetic replay. Constant pace; gaps are estimated from distance to the
        leader. Last lap appears after a full lap.
      </p>
    </aside>
  );
}
