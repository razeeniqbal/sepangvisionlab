/**
 * Friction circle: the dot is the force on the car (from its recorded motion), right = turning
 * right, up = braking, rings at 2 g and 4 g, scaled to 6 g at the edge.
 */
export default function GMeter({ long, lat, size = 64 }: { long: number; lat: number; size?: number }) {
  const r = size / 2 - 3,
    k = r / 6;
  const x = size / 2 - lat * k,
    y = size / 2 - long * k;
  const total = Math.hypot(long, lat);
  return (
    <figure className="sv-gmeter" style={{ width: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} className="sv-gmeter-ring" />
        <circle cx={size / 2} cy={size / 2} r={4 * k} className="sv-gmeter-ring is-inner" />
        <circle cx={size / 2} cy={size / 2} r={2 * k} className="sv-gmeter-ring is-inner" />
        <line x1={size / 2} y1={3} x2={size / 2} y2={size - 3} className="sv-gmeter-axis" />
        <line x1={3} y1={size / 2} x2={size - 3} y2={size / 2} className="sv-gmeter-axis" />
        <circle cx={x} cy={y} r={4.5} className={"sv-gmeter-dot" + (long < -1.5 ? " is-braking" : "")} />
      </svg>
      <figcaption>{total.toFixed(1)} g</figcaption>
    </figure>
  );
}
