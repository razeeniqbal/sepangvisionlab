import { Html } from "@react-three/drei";
import { BoxGeometry, type BufferGeometry } from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { trackCurve, trackCenter, trackSize } from "./trackCurve";
import { surfaceRibbon } from "./surfaceGeometry";
import {
  FOUNDATION,
  KERB_ZONES,
  GRAVEL_ZONES,
  BARRIER_ZONES,
} from "./foundationConfig";
import { foundationMaterials as materials } from "./foundationMaterials";
const w = FOUNDATION.halfWidth;
function merged(parts: BufferGeometry[]) {
  const geometry = mergeGeometries(parts)!;
  parts.forEach((p) => p.dispose());
  return geometry;
}
const road = surfaceRibbon(trackCurve, [
  [-w, -FOUNDATION.roadDepth],
  [-w, 0],
  [w, 0],
  [w, -FOUNDATION.roadDepth],
]);
const edges = merged(
  [-1, 1].map((side) =>
    surfaceRibbon(trackCurve, [
      [side * w - 0.006, 0.002],
      [side * w + 0.006, 0.002],
    ]),
  ),
);
const shoulders = merged(
  [-1, 1].map((side) => {
    const a = side * w,
      b = side * (w + 0.055);
    return surfaceRibbon(trackCurve, [
      [Math.min(a, b), -0.004],
      [Math.max(a, b), -0.004],
    ]);
  }),
);
const kerbs = merged(
  KERB_ZONES.map((zone) => {
    const a = zone.side * (w + 0.014),
      b = zone.side * (w + 0.06),
      lo = Math.min(a, b),
      hi = Math.max(a, b);
    return surfaceRibbon(
      trackCurve,
      [
        [lo, 0],
        [lo + 0.007, 0.012],
        [hi - 0.007, 0.012],
        [hi, 0],
      ],
      zone.from,
      zone.to,
      Math.ceil((zone.to - zone.from) * 900),
      true,
    );
  }),
);
const gravel = merged(
  GRAVEL_ZONES.map((zone) => {
    const a = zone.side * (w + 0.085),
      b = zone.side * (w + 0.25);
    return surfaceRibbon(
      trackCurve,
      [
        [Math.min(a, b), -0.028],
        [Math.max(a, b), -0.028],
      ],
      zone.from,
      zone.to,
      60,
    );
  }),
);
// A few merged concrete barrier runs; no thousands of prop objects or fence transparency.
const barriers = merged(
  BARRIER_ZONES.map((zone) => {
    const c = zone.side * (w + 0.36);
    return surfaceRibbon(
      trackCurve,
      [
        [c - 0.009, -0.03],
        [c - 0.009, 0.035],
        [c + 0.009, 0.035],
        [c + 0.009, -0.03],
      ],
      zone.from,
      zone.to,
      80,
    );
  }),
);
const ground = new BoxGeometry(
  trackSize.x + FOUNDATION.margin * 2,
  trackSize.y + FOUNDATION.margin * 2,
  0.1,
);
const start = trackCurve.getPointAt(0),
  tangent = trackCurve.getTangentAt(0);
export default function Circuit() {
  return (
    <group>
      <mesh
        geometry={ground}
        material={materials.terrain}
        position={[trackCenter.x, trackCenter.y, FOUNDATION.groundZ - 0.052]}
        dispose={null}
      />
      <mesh
        rotation={[0, 0, 0]}
        position={[trackCenter.x, trackCenter.y, FOUNDATION.groundZ]}
      >
        <planeGeometry
          args={[
            trackSize.x + FOUNDATION.margin * 2,
            trackSize.y + FOUNDATION.margin * 2,
          ]}
        />
        <primitive object={materials.grass} attach="material" dispose={null} />
      </mesh>
      <mesh geometry={road} material={materials.asphalt} dispose={null} />
      <mesh geometry={shoulders} material={materials.concrete} dispose={null} />
      <mesh geometry={edges} material={materials.edge} dispose={null} />
      <mesh geometry={gravel} material={materials.gravel} dispose={null} />
      <mesh geometry={kerbs} material={materials.kerb} dispose={null} />
      <mesh geometry={barriers} material={materials.barrier} dispose={null} />
      <group
        position={[start.x, start.y, 0.004]}
        rotation={[0, 0, Math.atan2(tangent.y, tangent.x)]}
      >
        {Array.from({ length: 8 }, (_, i) => (
          <mesh
            key={i}
            position={[
              (i % 2) * 0.025 - 0.0125,
              Math.floor(i / 2) * 0.075 - 0.1125,
              0,
            ]}
          >
            <planeGeometry args={[0.025, 0.075]} />
            <meshBasicMaterial color={i % 3 === 0 ? "#182020" : "#d2d6ce"} />
          </mesh>
        ))}
      </group>
      <Html
        position={[start.x, start.y + 0.8, 0.05]}
        center
        zIndexRange={[50, 40]}
      >
        <span className="track-label">START / FINISH</span>
      </Html>
    </group>
  );
}
