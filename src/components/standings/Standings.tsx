import { useState } from "react";
import type { CarDefinition, CarState } from "../../domain/field";
import { estimatedGap } from "../../domain/inspection";
import { fictionalDriver } from "../../data/fictionalGrid";
import TeamGlyph from "../broadcast/TeamGlyph";

interface Props {
  cars: CarState[];
  definitions: readonly CarDefinition[];
  selectedId: string;
  onSelect: (id: string) => void;
  /** Positions a few seconds earlier, for the TV-style gain/loss arrows. */
  previous?: ReadonlyMap<string, number>;
  lap?: number;
  totalLaps?: number;
}
// Broadcast timing tower. Gaps are estimates from distance; entries are fictional.
export default function Standings({
  cars,
  definitions,
  selectedId,
  onSelect,
  previous,
  lap,
  totalLaps,
}: Props) {
  const [mode, setMode] = useState<"interval" | "leader">("interval");
  const ordered = [...cars].sort((a, b) => a.position - b.position);
  const leader = ordered[0];
  const byId = new Map(definitions.map((d, i) => [d.id, { d, i }]));
  return (
    <section
      className="standings-panel bc-tower"
      aria-label="Simulated standings"
    >
      <div className="bc-tower-head">
        <span className="bc-tower-lap">
          {lap !== undefined ? (
            <>
              Lap <strong>{lap}</strong>
              {totalLaps ? <> / {totalLaps}</> : null}
            </>
          ) : (
            <>Standings</>
          )}
        </span>
        <button
          type="button"
          className="bc-tower-mode"
          onClick={() =>
            setMode((m) => (m === "interval" ? "leader" : "interval"))
          }
          aria-label={
            "Showing " +
            (mode === "interval" ? "interval to car ahead" : "gap to leader") +
            "; switch"
          }
        >
          {mode === "interval" ? "Interval" : "Leader"}
        </button>
      </div>
      <ol className="standings-list">
        {ordered.map((car, index) => {
          const { d: definition, i } = byId.get(car.id)!;
          const driver = fictionalDriver(i, car.number);
          const reference = mode === "interval" ? ordered[index - 1] : leader;
          const gap =
            index === 0
              ? null
              : estimatedGap(car, reference, byId.get(reference.id)!.d);
          const before = previous?.get(car.id);
          const change = before === undefined ? 0 : before - car.position;
          return (
            <li key={car.id}>
              <button
                type="button"
                className="standing-row"
                aria-label={`Select ${driver.name}, car ${car.number}, position ${car.position}`}
                aria-pressed={car.id === selectedId}
                onClick={() => onSelect(car.id)}
                style={{ ["--team" as string]: definition.color }}
              >
                <span className="standing-position">{car.position}</span>
                <span
                  className={
                    "bc-change " +
                    (change > 0 ? "is-up" : change < 0 ? "is-down" : "")
                  }
                  aria-label={
                    change > 0
                      ? `up ${change}`
                      : change < 0
                        ? `down ${-change}`
                        : undefined
                  }
                >
                  {change > 0 ? "▲" : change < 0 ? "▼" : ""}
                </span>
                <TeamGlyph team={driver.team} color={definition.color} />
                <strong
                  className="bc-code"
                  title={driver.name + " · " + driver.team.name}
                >
                  {driver.code}
                </strong>
                <span className="standing-gap">
                  {gap === null ? "Leader" : "+" + gap.toFixed(1)}
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
        Fictional entries · gaps estimated from distance
      </p>
    </section>
  );
}
