// Visual vocabulary is deliberately broader than today's dry synthetic fixture.
// Unknown/unavailable data must never be presented as a confirmed compound.
export const TYRE_COLOURS = Object.freeze({
  // The compound colours used on the real sidewall bands (colours only, no lettering).
  SOFT: "#e8303a",
  MEDIUM: "#f3c623",
  HARD: "#eef0ec",
  INTERMEDIATE: "#3fae4a",
  WET: "#1f74c4",
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
