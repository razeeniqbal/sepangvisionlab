import { useMemo, useState } from "react";
import { Chevron } from "./Chevron";
import type { CarDefinition, CarState } from "../../domain/field";
import { poseAtDistance } from "../../domain/lapPhysics";
import { sepangTrack } from "../../data/sepangPace";

const W = 200,
  H = 160,
  PAD = 10;

// Fit the metric profile into the SVG box once; y is flipped because SVG y runs down.
const frame = (() => {
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity;
  for (let i = 0; i < sepangTrack.count; i++) {
    minX = Math.min(minX, sepangTrack.x[i]);
    maxX = Math.max(maxX, sepangTrack.x[i]);
    minY = Math.min(minY, sepangTrack.y[i]);
    maxY = Math.max(maxY, sepangTrack.y[i]);
  }
  const s = Math.min(
    (W - 2 * PAD) / (maxX - minX),
    (H - 2 * PAD) / (maxY - minY),
  );
  const ox = (W - (maxX - minX) * s) / 2,
    oy = (H - (maxY - minY) * s) / 2;
  return (x: number, y: number) =>
    [ox + (x - minX) * s, H - (oy + (y - minY) * s)] as const;
})();

function point(car: CarState) {
  const p = poseAtDistance(sepangTrack, car.progress * sepangTrack.length);
  return frame(p.x, p.y);
}

export default function MiniMap({
  cars,
  definitions,
  selectedId,
  ghost,
  onSelect,
}: {
  cars: readonly CarState[];
  definitions: readonly CarDefinition[];
  selectedId: string;
  ghost?: CarState | null;
  onSelect: (id: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const path = useMemo(() => {
    let d = "";
    for (let i = 0; i < sepangTrack.count; i += 6) {
      const [x, y] = frame(sepangTrack.x[i], sepangTrack.y[i]);
      d += (i ? "L" : "M") + x.toFixed(1) + " " + y.toFixed(1);
    }
    return d + "Z";
  }, []);
  const [sx, sy] = frame(sepangTrack.x[0], sepangTrack.y[0]);
  const colour = new Map(definitions.map((d) => [d.id, d.color]));
  const ordered = [...cars].sort((a, b) =>
    a.id === selectedId
      ? 1
      : b.id === selectedId
        ? -1
        : b.position - a.position,
  );
  return (
    <figure
      className={"bc-minimap" + (collapsed ? " is-collapsed" : "")}
      aria-label="Track map with car positions"
    >
      <figcaption className="bc-overlay-head">
        Track position
        <Chevron
          collapsed={collapsed}
          label="track map"
          onToggle={() => setCollapsed((c) => !c)}
        />
      </figcaption>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="Sepang outline with simulated car positions"
      >
        <path d={path} className="bc-minimap-track" />
        <path d={path} className="bc-minimap-line" />
        <rect
          x={sx - 1}
          y={sy - 5}
          width="2"
          height="10"
          className="bc-minimap-start"
        />
        {ghost &&
          (() => {
            const [x, y] = point(ghost);
            return (
              <circle cx={x} cy={y} r="4.5" className="bc-minimap-ghost" />
            );
          })()}
        {ordered.map((car) => {
          const [x, y] = point(car),
            selected = car.id === selectedId;
          return (
            <circle
              key={car.id}
              cx={x}
              cy={y}
              r={selected ? 5 : 3.2}
              fill={selected ? "var(--accent)" : colour.get(car.id)}
              stroke={selected ? "#fff" : "#0b1213"}
              strokeWidth={selected ? 1.6 : 0.8}
              onClick={() => onSelect(car.id)}
            >
              <title>{"Car " + car.number + ", P" + car.position}</title>
            </circle>
          );
        })}
      </svg>
    </figure>
  );
}
