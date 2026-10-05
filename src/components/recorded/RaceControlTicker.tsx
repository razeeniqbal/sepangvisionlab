import type { RaceControlRow, TrackStatus } from "../../domain/recordedSession";

const CHIP: Record<TrackStatus, string> = {
  GREEN: "Green",
  YELLOW: "Yellow",
  SC: "Safety car",
  VSC: "Virtual safety car",
  RED: "Red flag",
  CHEQUERED: "Chequered",
  NONE: "No status",
};

export default function RaceControlTicker({
  latest,
  status,
  yellowSectors,
  clock,
}: {
  latest: RaceControlRow | null;
  status: TrackStatus;
  yellowSectors: readonly number[];
  clock: (t: number) => string;
}) {
  return (
    <section className="rec-ticker" aria-label="Race control" aria-live="polite">
      <strong className="rec-ticker-title">Race control</strong>
      {latest ? (
        <>
          <time>{clock(latest.t)}</time>
          <span className="rec-ticker-message">{latest.message}</span>
        </>
      ) : (
        <span className="rec-ticker-message">No messages yet</span>
      )}
      <span className={"rec-flag is-" + status.toLowerCase()}>
        {CHIP[status]}
        {status === "YELLOW" && yellowSectors.length > 0 && (
          <> · S{yellowSectors.join(", S")}</>
        )}
      </span>
    </section>
  );
}
