import { useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { Group } from "three";
import { trackCurve } from "../circuit/trackCurve";
import { brand } from "../../data/brand";
import type { CarDefinition, CarState } from "../../domain/field";
interface Props {
  car: CarDefinition;
  index: number;
  field: React.RefObject<CarState[]>;
  selected: boolean;
  onSelect: (id: string) => void;
}
export function CarBody({ color }: { color: string }) {
  return (
    <>
      <mesh>
        <boxGeometry args={[0.8, 0.26, 0.12]} />
        <meshBasicMaterial color={brand.silver} />
      </mesh>
      <mesh position={[0.25, 0, 0.08]}>
        <boxGeometry args={[0.65, 0.1, 0.08]} />
        <meshBasicMaterial color={color} />
      </mesh>
      {[-0.27, 0.3].flatMap((x) =>
        [-0.22, 0.22].map((y) => (
          <mesh key={x + "," + y} position={[x, y, 0]}>
            <boxGeometry args={[0.23, 0.14, 0.15]} />
            <meshBasicMaterial color="#080b0b" />
          </mesh>
        )),
      )}
      {[-0.45, 0.5].map((x) => (
        <mesh key={x} position={[x, 0, 0]}>
          <boxGeometry args={[0.1, 0.58, 0.07]} />
          <meshBasicMaterial color={color} />
        </mesh>
      ))}
      <mesh position={[-0.03, 0, 0.12]}>
        <boxGeometry args={[0.22, 0.17, 0.08]} />
        <meshBasicMaterial color={brand.carbon} />
      </mesh>
    </>
  );
}
export default function CarMarker({
  car,
  index,
  field,
  selected,
  onSelect,
}: Props) {
  const group = useRef<Group>(null);
  const body = useRef<Group>(null);
  const [hovered, setHovered] = useState(false);
  const active = selected || hovered;
  const labelOffset = selected ? 0 : [-12, 0, 12][index % 3];
  useFrame(() => {
    const p = trackCurve.getPointAt(field.current[index].progress);
    const t = trackCurve.getTangentAt(field.current[index].progress);
    group.current?.position.set(p.x, p.y, selected ? 0.4 : 0.2 + index * 0.001);
    if (body.current) body.current.rotation.z = Math.atan2(t.y, t.x);
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
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {active && (
        <mesh position={[0, 0, -0.03]}>
          <ringGeometry args={[0.36, 0.4, 32]} />
          <meshBasicMaterial color={selected ? car.color : "#ffffff"} />
        </mesh>
      )}
      <group ref={body} scale={active ? 0.7 : 0.48}>
        <CarBody color={car.color} />
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
            borderColor: car.color,
            transform: "translateY(" + labelOffset + "px)",
          }}
          data-car-number={car.number}
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
