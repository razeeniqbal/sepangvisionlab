import Icon from "../ui/Icon";
import Popover from "../ui/Popover";
import TeamGlyph, { type DriverIdentity } from "../broadcast/TeamGlyph";
import type { PickOutcome } from "../../domain/pick";

interface Props {
  drivers: readonly (DriverIdentity & { number: number; color: string })[];
  pick: number | null;
  onPick: (driver: number | null) => void;
  locked: boolean;
  /** Live position of the picked driver at the replay time. */
  position: number | null;
}

/** Header control: choose who wins before lights out, then follow them live. */
export default function PickWinner({ drivers, pick, onPick, locked, position }: Props) {
  const picked = drivers.find((d) => d.number === pick);
  const button = picked ? (
    <span className="sv-pick-chip" style={{ ["--team" as string]: picked.color }}>
      <Icon name="trophy" />
      <b>{picked.code}</b>
      {position !== null && locked && <span>P{position}</span>}
    </span>
  ) : (
    <span className="sv-pick-chip is-empty">
      <Icon name="trophy" />
      <b>Pick winner</b>
    </span>
  );
  return (
    <Popover label="Pick your race winner" button={button} className="sv-pick">
      <div className="sv-menu-section">
        <h3>Who wins the race?</h3>
        <p className="sv-menu-note">
          {locked
            ? "Picks are locked: the lights are out. Rewind before the start to change it."
            : "Choose before lights out. The result shows at the chequered flag."}
        </p>
        <div className="sv-pick-grid" role="group" aria-label="Drivers">
          {drivers.map((d) => (
            <button
              key={d.number}
              className="sv-pick-driver"
              aria-pressed={d.number === pick}
              disabled={locked}
              onClick={() => onPick(d.number === pick ? null : d.number)}
              style={{ ["--team" as string]: d.color }}
              title={d.name + " · " + d.team.name}
            >
              <TeamGlyph team={d.team} color={d.color} size={10} />
              <b>{d.code}</b>
              <small>{d.number}</small>
            </button>
          ))}
        </div>
      </div>
    </Popover>
  );
}

const VERDICT: Record<PickOutcome["kind"], string> = {
  won: "won the race!",
  podium: "made the podium",
  points: "scored points",
  finished: "finished",
  out: "did not finish",
};

/** Shown once the replay passes the chequered flag. */
export function PickResult({
  driver,
  outcome,
  onClose,
}: {
  driver: DriverIdentity & { color: string };
  outcome: PickOutcome;
  onClose: () => void;
}) {
  const detail =
    outcome.kind === "out" ? outcome.reason : outcome.kind === "won" ? "Winner" : "P" + outcome.position;
  return (
    <section
      className={"sv-pick-result glass is-" + outcome.kind}
      role="status"
      aria-live="polite"
      style={{ ["--team" as string]: driver.color }}
    >
      <Icon name="trophy" size={28} />
      <div>
        <small>Your pick</small>
        <strong>
          {driver.name} {VERDICT[outcome.kind]}
        </strong>
        <span>{detail}</span>
      </div>
      <button className="sv-icon-button" aria-label="Close" onClick={onClose}>
        <Icon name="close" />
      </button>
    </section>
  );
}
