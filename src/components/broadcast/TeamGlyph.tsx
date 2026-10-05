import type { FictionalTeam } from "../../data/fictionalGrid";

// Plain geometric team marks in the entry colour; no team or sponsor logos.
const shapes = {
  circle: <circle cx="6" cy="6" r="4.6" />,
  square: <rect x="1.6" y="1.6" width="8.8" height="8.8" />,
  triangle: <path d="M6 1.2 11 10.4H1z" />,
  diamond: <path d="M6 .8 11.2 6 6 11.2.8 6z" />,
  hexagon: <path d="M3.3 1.4h5.4L11.4 6 8.7 10.6H3.3L.6 6z" />,
};

export default function TeamGlyph({
  team,
  color,
  size = 12,
}: {
  team: FictionalTeam;
  color: string;
  size?: number;
}) {
  return (
    <svg
      className="team-glyph"
      width={size}
      height={size}
      viewBox="0 0 12 12"
      aria-hidden="true"
      fill={team.filled ? color : "none"}
      stroke={color}
      strokeWidth={team.filled ? 0 : 1.6}
    >
      {shapes[team.glyph]}
    </svg>
  );
}
