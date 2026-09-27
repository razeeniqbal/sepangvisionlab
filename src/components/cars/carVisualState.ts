// Visual vocabulary is deliberately broader than today's dry synthetic fixture.
// Unknown/unavailable data must never be presented as a confirmed compound.
export const TYRE_COLOURS = Object.freeze({
  SOFT: "#b54e52",
  MEDIUM: "#c9b35d",
  HARD: "#c6cdca",
  INTERMEDIATE: "#4a996d",
  WET: "#4387bb",
  UNKNOWN: "#191b1c",
});
export type VisualTyreCompound = keyof typeof TYRE_COLOURS;
export function visualTyreCompound(
  value: unknown,
  known = true,
): VisualTyreCompound {
  return known &&
    typeof value === "string" &&
    Object.hasOwn(TYRE_COLOURS, value)
    ? (value as VisualTyreCompound)
    : "UNKNOWN";
}
export interface CarVisualIdentity {
  readonly number: string;
  readonly driverId: string;
  readonly shortDriverId?: string;
  readonly teamId?: string;
  readonly liveryId?: string;
}
// Labels stay authoritative. Identity never generates geometry or material keys.
export function carIdentityText(identity: CarVisualIdentity) {
  return [identity.number, identity.shortDriverId, identity.teamId]
    .filter(Boolean)
    .join(" · ");
}
