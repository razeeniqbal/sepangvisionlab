import { Line, Html } from "@react-three/drei";
import { trackCurve } from "./trackCurve";
const points = trackCurve.getSpacedPoints(2000);
const start = trackCurve.getPointAt(0);
const tangent = trackCurve.getTangentAt(0);
export default function Circuit() {
  return (
    <>
      <Line points={points} color="#53605f" lineWidth={13} />
      <Line points={points} color="#232e2e" lineWidth={10} />
      <Line
        points={points}
        color="#60706e"
        lineWidth={1}
        dashed
        dashSize={0.18}
        gapSize={0.22}
      />
      <group
        position={[start.x, start.y, 0.05]}
        rotation={[0, 0, Math.atan2(tangent.y, tangent.x)]}
      >
        {Array.from({ length: 8 }, (_, i) => (
          <mesh
            key={i}
            position={[
              (i % 2) * 0.12 - 0.06,
              Math.floor(i / 2) * 0.14 - 0.21,
              0,
            ]}
          >
            <planeGeometry args={[0.12, 0.14]} />
            <meshBasicMaterial color={i % 3 === 0 ? "#182020" : "#e4eeee"} />
          </mesh>
        ))}
      </group>
      <Html position={[start.x, start.y + 0.8, 0]} center>
        <span className="track-label">START / FINISH</span>
      </Html>
    </>
  );
}
