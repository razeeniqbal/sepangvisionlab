// "Pick your winner" for the recorded race. Pure; storage is injected (same pattern as the theme).

export interface ResultRow {
  position: number | null;
  driver_number: number;
  dnf?: boolean;
  dns?: boolean;
  dsq?: boolean;
}

export type PickOutcome =
  | { kind: "won"; position: 1 }
  | { kind: "podium" | "points" | "finished"; position: number }
  | { kind: "out"; reason: "DNF" | "DNS" | "DSQ" };

export const PICK_KEY = (sessionKey: number) => "svl-pick-" + sessionKey;

/** How the picked driver did, from the official classification. Null if not classified. */
export function pickOutcome(result: readonly ResultRow[], driver: number): PickOutcome | null {
  const row = result.find((r) => r.driver_number === driver);
  if (!row) return null;
  if (row.dsq) return { kind: "out", reason: "DSQ" };
  if (row.dns) return { kind: "out", reason: "DNS" };
  if (row.dnf || row.position === null) return { kind: "out", reason: "DNF" };
  if (row.position === 1) return { kind: "won", position: 1 };
  return {
    kind: row.position <= 3 ? "podium" : row.position <= 10 ? "points" : "finished",
    position: row.position,
  };
}

/** Picks are open until lights out, so the replay cannot be scrubbed to the answer first. */
export const pickLocked = (timeMs: number, lightsOutMs: number | null) =>
  lightsOutMs !== null && timeMs >= lightsOutMs;

export function readPick(storage: Pick<Storage, "getItem"> | null | undefined, sessionKey: number) {
  try {
    const v = Number(storage?.getItem(PICK_KEY(sessionKey)));
    return Number.isInteger(v) && v > 0 ? v : null;
  } catch {
    return null;
  }
}

export function writePick(
  storage: Pick<Storage, "setItem" | "removeItem"> | null | undefined,
  sessionKey: number,
  driver: number | null,
) {
  try {
    if (!storage) return false;
    if (driver === null) storage.removeItem(PICK_KEY(sessionKey));
    else storage.setItem(PICK_KEY(sessionKey), String(driver));
    return true;
  } catch {
    return false;
  }
}
