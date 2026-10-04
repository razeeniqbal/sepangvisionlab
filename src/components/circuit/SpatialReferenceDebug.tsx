import { Html } from "@react-three/drei";
import { SPATIAL_ANCHORS } from "../../data/circuits/sepangSpatialReferences";
import {
  createCircuitReferenceProjector,
  nearestTrackReference,
} from "../../domain/spatialProjection";
import sepang from "../../data/circuits/sepang.json";
import { trackCurve } from "./trackCurve";
const project = createCircuitReferenceProjector(
  sepang.features[0].geometry.coordinates,
);
const anchors = SPATIAL_ANCHORS.map((reference) => {
  const point = project(reference.longitude!, reference.latitude!);
  return {
    reference,
    point,
    alignment: nearestTrackReference(trackCurve, point),
  };
});
// Imported only behind the Vite development flag + explicit query opt-in. No production markers.
export default function SpatialReferenceDebug() {
  return (
    <group>
      {anchors.map(({ reference: r, point: p, alignment: a }, i) => (
        <Html
          key={r.id}
          position={[p.x, p.y, p.z + 0.08]}
          center
          zIndexRange={[220, 210]}
          style={{ pointerEvents: "none" }}
        >
          <div style={{ position: "relative", width: 0, height: 0 }}>
            <i
              aria-hidden="true"
              style={{
                position: "absolute",
                left: -2,
                top: -2,
                width: 4,
                height: 4,
                background: "#ead6a0",
              }}
            />
            <span
              data-spatial-reference={r.id}
              data-world-x={p.x}
              data-world-y={p.y}
              data-world-z={p.z}
              data-accuracy={r.accuracyClass}
              title={`${r.notes} Nearest track separation: ${a.distanceMetres.toFixed(2)} m (derived).`}
              style={{
                position: "absolute",
                left: 7,
                top: -8,
                display: "block",
                font: "9px monospace",
                whiteSpace: "nowrap",
                color: "#ead6a0",
                background: "#17211ee8",
                border: "1px solid #8e825e",
                padding: "3px 5px",
                transform: `translateY(${((i % 3) - 1) * 15}px)`,
              }}
            >
              {r.label} · {a.distanceMetres.toFixed(1)} m
            </span>
          </div>
        </Html>
      ))}
    </group>
  );
}
