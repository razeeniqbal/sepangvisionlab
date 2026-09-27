import {
  visualTyreCompound,
  carIdentityText,
  type CarVisualIdentity,
} from "./carVisualState";
import CarRepresentation, { CarIdentifier } from "./CarRepresentation";
import { carDetail, type CarDetail } from "./carDetail";
import { useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { Group, OrthographicCamera, Vector3 } from "three";
import { trackCurve } from "../circuit/trackCurve";
import type { CarDefinition, CarState } from "../../domain/field";
interface Props {
  car: CarDefinition;
  tyresKnown?: boolean;
  identity?: CarVisualIdentity;
  index: number;
  field: React.RefObject<CarState[]>;
  selected: boolean;
  onSelect: (id: string) => void;
}
export default function CarMarker({
  car,
  tyresKnown = true,
  identity,
  index,
  field,
  selected,
  onSelect,
}: Props) {
  const visualIdentity = identity ?? { number: car.number, driverId: car.id };
  const [compound, setCompound] = useState(() =>
    visualTyreCompound(field.current[index].compound, tyresKnown),
  );
  const compoundRef = useRef(compound);
  const group = useRef<Group>(null);
  const body = useRef<Group>(null);
  const [hovered, setHovered] = useState(false);
  const active = selected || hovered;
  const [detail, setDetail] = useState<CarDetail>("far");
  const detailRef = useRef<CarDetail>("far");
  const marker = useRef<Group>(null);
  const cameraPoint = useRef(new Vector3());
  const labelOffset = selected ? 0 : [-12, 0, 12][index % 3];
  useFrame(({ camera, size }) => {
    const nextCompound = visualTyreCompound(
      field.current[index].compound,
      tyresKnown,
    );
    if (nextCompound !== compoundRef.current) {
      compoundRef.current = nextCompound;
      setCompound(nextCompound);
    }
    const p = trackCurve.getPointAt(field.current[index].progress);
    const t = trackCurve.getTangentAt(field.current[index].progress);
    group.current?.position.set(p.x, p.y, 0.015 + index * 0.0001);
    if (body.current) body.current.rotation.z = Math.atan2(t.y, t.x);
    cameraPoint.current
      .set(p.x, p.y, 0.015)
      .applyMatrix4(camera.matrixWorldInverse);
    const depth =
      camera instanceof OrthographicCamera
        ? 1
        : Math.max(0.01, -cameraPoint.current.z);
    const pixelsPerUnit =
      (Math.abs(camera.projectionMatrix.elements[5]) * size.height) /
      (2 * depth);
    const next = carDetail(0.504 * pixelsPerUnit, detailRef.current);
    if (next !== detailRef.current) {
      detailRef.current = next;
      setDetail(next);
    }
    // Constant screen-size identification, without moving the camera or race anchor.
    marker.current?.scale.setScalar(1 / Math.max(1, pixelsPerUnit));
  });
  return (
    <group
      ref={group}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(car.id);
      }}
      onPointerOver={(event) => {
        event.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={() => setHovered(false)}
    >
      <mesh>
        <circleGeometry args={[0.4, 16]} />
        <meshBasicMaterial visible={false} />
      </mesh>
      {(detail !== "near" || selected) && (
        <group ref={marker}>
          <CarIdentifier
            selected={selected}
            radius={selected ? 6 : detail === "far" ? 4 : 3}
          />
        </group>
      )}
      {active && (
        <mesh position={[0, 0, -0.003]}>
          <ringGeometry args={[0.36, 0.4, 32]} />
          <meshBasicMaterial color={selected ? "#00a69c" : "#a5b6b2"} />
        </mesh>
      )}
      <group ref={body} scale={active ? 0.7 : 0.48}>
        <CarRepresentation
          detail={detail}
          identity={visualIdentity}
          compound={compound}
        />
      </group>
      <Html
        position={[0, selected ? 0.85 : 0.5, 0]}
        center
        zIndexRange={selected ? [100, 90] : [80 - index, 60 - index]}
      >
        <button
          type="button"
          className={
            selected
              ? "car-label car-label-selected"
              : "car-label car-label-compact"
          }
          style={{
            borderColor: selected ? "#00a69c" : car.color,
            transform: "translateY(" + labelOffset + "px)",
          }}
          data-car-number={car.number}
          data-car-detail={detail}
          data-car-compound={compound}
          title={carIdentityText(visualIdentity)}
          aria-label={"Select car " + car.number + " on circuit"}
          aria-pressed={selected}
          onClick={(event) => {
            event.stopPropagation();
            onSelect(car.id);
          }}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          onFocus={() => setHovered(true)}
          onBlur={() => setHovered(false)}
        >
          {car.number}
          {selected && (
            <>
              <i />
              {car.number === "07" ? "PETRONAS" : "SELECTED"}
            </>
          )}
        </button>
      </Html>
    </group>
  );
}
