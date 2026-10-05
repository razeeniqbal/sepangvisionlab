import { useState, type ReactNode } from "react";
import type { CarDefinition, CarState } from "../../domain/field";
import { estimatedGap } from "../../domain/inspection";
import {
  fictionalDriver,
  type FictionalDriver,
} from "../../data/fictionalGrid";
import TeamGlyph from "../broadcast/TeamGlyph";
import { Chevron } from "../broadcast/Chevron";

interface Props {
  cars: CarState[];
  definitions: readonly CarDefinition[];
  selectedId: string;
  onSelect: (id: string) => void;
  /** Positions a few seconds earlier, for the TV-style gain/loss arrows. */
  previous?: ReadonlyMap<string, number>;
  lap?: number;
  totalLaps?: number;
  /** Real identities (recorded mode); defaults to the fictional grid by entry index. */
  identity?: (car: CarState, index: number) => FictionalDriver;
  /** Gap text from timing data (recorded mode); defaults to a distance estimate. */
  gap?: (
    car: CarState,
    ahead: CarState | undefined,
    leader: CarState,
    mode: "interval" | "leader",
  ) => string | null;
  /** Per-row extras: best lap, pit lane, stale data, session-best marker. */
  extras?: (car: CarState) => {
    best?: string;
    pit?: boolean;
    stale?: boolean;
    sessionBest?: boolean;
  };
  note?: ReactNode;
  footer?: ReactNode;
  label?: string;
}
// Broadcast timing tower. Simulated: fictional entries, gaps estimated from distance.
// Recorded: real identities and timing passed in through the optional props.
export default function Standings({
  cars,
  definitions,
  selectedId,
  onSelect,
  previous,
  lap,
  totalLaps,
  identity,
  gap: gapText,
  extras,
  note = "Fictional entries · gaps estimated from distance",
  footer,
  label = "Simulated standings",
}: Props) {
  const [mode, setMode] = useState<"interval" | "leader">("interval");
  const [collapsed, setCollapsed] = useState(false);
  const ordered = [...cars].sort((a, b) => a.position - b.position);
  const leader = ordered[0];
  const byId = new Map(definitions.map((d, i) => [d.id, { d, i }]));
  return (
    <section
      className={
        "standings-panel bc-tower" +
        (collapsed ? " is-collapsed" : "") +
        (extras ? " has-extras" : "")
      }
      aria-label={label}
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
        <Chevron
          collapsed={collapsed}
          label="timing tower"
          onToggle={() => setCollapsed((c) => !c)}
        />
      </div>
      <ol className="standings-list">
        {ordered.map((car, index) => {
          const { d: definition, i } = byId.get(car.id)!;
          const driver = identity
            ? identity(car, i)
            : fictionalDriver(i, car.number);
          const reference = mode === "interval" ? ordered[index - 1] : leader;
          const gap = gapText
            ? gapText(car, ordered[index - 1], leader, mode)
            : index === 0
              ? null
              : "+" +
                estimatedGap(car, reference, byId.get(reference.id)!.d).toFixed(
                  1,
                );
          const extra = extras?.(car);
          const before = previous?.get(car.id);
          const change = before === undefined ? 0 : before - car.position;
          return (
            <li key={car.id}>
              <button
                type="button"
                className={
                  "standing-row" +
                  (extra?.stale ? " is-stale" : "") +
                  (extra?.pit ? " is-pit" : "")
                }
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
                {extras && (
                  <span
                    className={
                      "bc-best" + (extra?.sessionBest ? " is-session-best" : "")
                    }
                  >
                    {extra?.best ?? ""}
                  </span>
                )}
                <span className="standing-gap">
                  {gap ?? (index === 0 ? "Leader" : "")}
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
      {footer}
      <p className="standings-note">{note}</p>
    </section>
  );
}
