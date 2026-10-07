import type { CarVisualIdentity, VisualTyreCompound } from "./carVisualState";
import {
  BoxGeometry,
  Color,
  MeshBasicMaterial,
  MeshStandardMaterial,
  RingGeometry,
} from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import FormulaCar from "./FormulaCar";
import { CAR_LOD_SLOT, type CarDetail } from "./carDetail";
import { themedAccent } from "../../themeRuntime";

// Lightweight geometry and materials are owned by this module, shared by all cars.
const boxes = [
  [0.78, 0.22, 0.1, 0, 0, 0.09],
  [0.55, 0.1, 0.08, 0.2, 0, 0.13],
  [0.1, 0.56, 0.05, -0.43, 0, 0.055],
  [0.1, 0.56, 0.05, 0.48, 0, 0.055],
  ...[-0.28, 0.29].flatMap((x) =>
    [-0.22, 0.22].map((y) => [0.21, 0.13, 0.16, x, y, 0.08]),
  ),
];
const parts = boxes.map(([x, y, z, px, py, pz]) =>
  new BoxGeometry(x, y, z).translate(px, py, pz),
);
const silhouette = mergeGeometries(parts)!;
parts.forEach((part) => part.dispose());
const graphite = new MeshStandardMaterial({
  color: "#414b4d",
  roughness: 0.85,
  metalness: 0.1,
});
const markerGeometry = new RingGeometry(0.55, 1, 4);
const neutral = new MeshBasicMaterial({ color: "#94a9a5", depthTest: false });
// Selected-car identifier in the theme accent (teal in SVL, red in Broadcast).
const turquoise = new MeshBasicMaterial({
  color: themedAccent(new Color()),
  depthTest: false,
});
export function CarIdentifier({
  selected,
  radius,
}: {
  selected: boolean;
  radius: number;
}) {
  return (
    <mesh
      geometry={markerGeometry}
      material={selected ? turquoise : neutral}
      scale={radius}
      position={[0, 0, 0.22]}
      renderOrder={5}
      dispose={null}
    />
  );
}
export function SimplifiedCar() {
  return <mesh geometry={silhouette} material={graphite} dispose={null} />;
}
export default function CarRepresentation({
  detail,
  identity,
  compound = "UNKNOWN",
}: {
  detail: CarDetail;
  identity?: CarVisualIdentity;
  compound?: VisualTyreCompound;
}) {
  if (detail === "far") return null;
  if (CAR_LOD_SLOT[detail] === "LOD2") return <SimplifiedCar />;
  return (
    <FormulaCar
      livery={identity?.liveryId}
      compound={compound}
      fallback={<SimplifiedCar />}
    />
  );
}
