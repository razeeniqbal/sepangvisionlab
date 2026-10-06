import type { RaceControlRow, TrackStatus } from "../../domain/recordedSession";

const CHIP: Record<TrackStatus, string> = {
  GREEN: "Green",
  YELLOW: "Yellow",
  SC: "Safety car",
  VSC: "VSC",
  RED: "Red flag",
  CHEQUERED: "Chequered",
  NONE: "—",
};

/** Race-control toast: track status chip and the latest message at the replay time. */
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
  const sectors =
    status === "YELLOW" && yellowSectors.length
      ? yellowSectors.length > 3
        ? ` · ${yellowSectors.length} sectors`
        : ` · S${yellowSectors.join(", S")}`
      : "";
  return (
    <section className="sv-toast glass" aria-label="Race control" aria-live="polite">
      <span className={"sv-flag is-" + status.toLowerCase()}>
        <i aria-hidden="true" />
        {CHIP[status]}
        {sectors}
      </span>
      <span className="sv-toast-message" title={latest?.message ?? undefined}>
        {latest ? latest.message : "No race control messages yet"}
      </span>
      {latest && <time className="sv-muted">{clock(latest.t)}</time>}
    </section>
  );
}
