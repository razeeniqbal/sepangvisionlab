import type { CarDefinition, CarState } from "../../domain/field";
import { estimatedGap } from "../../domain/inspection";

interface Props {
  cars: CarState[];
  definitions: readonly CarDefinition[];
  selectedId: string;
  onSelect: (id: string) => void;
}
export default function Standings({
  cars,
  definitions,
  selectedId,
  onSelect,
}: Props) {
  const ordered = [...cars].sort((a, b) => a.position - b.position);
  const leader = ordered[0];
  const leaderDefinition = definitions.find((d) => d.id === leader.id)!;
  return (
    <section className="standings-panel" aria-label="Live synthetic standings">
      <div className="panel-heading">
        STANDINGS <span>{cars.length} CARS</span>
      </div>
      <div className="standings-columns">
        <span>POS</span>
        <span>CAR</span>
        <span>GAP EST.</span>
        <span>TYRE</span>
      </div>
      <ol className="standings-list">
        {ordered.map((car) => {
          const definition = definitions.find((d) => d.id === car.id)!;
          return (
            <li key={car.id}>
              <button
                type="button"
                className="standing-row"
                aria-label={"Select car " + car.number + " from standings"}
                aria-pressed={car.id === selectedId}
                onClick={() => onSelect(car.id)}
                style={{ borderLeftColor: definition.color }}
              >
                <span className="standing-position">
                  {String(car.position).padStart(2, "0")}
                </span>
                <strong>#{car.number}</strong>
                <span className="standing-gap">
                  {car.id === leader.id
                    ? "LEADER"
                    : "+" +
                      estimatedGap(car, leader, leaderDefinition).toFixed(1)}
                </span>
                <span
                  className={"compound compound-" + car.compound.toLowerCase()}
                  title={car.compound}
                >
                  {car.compound[0]}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      <p className="standings-note">
        Synthetic session replay
        <br />
        Estimated gap to leader in seconds.
      </p>
    </section>
  );
}
