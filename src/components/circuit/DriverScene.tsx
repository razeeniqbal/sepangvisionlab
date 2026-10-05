import { useLayoutEffect, useRef, type RefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { DirectionalLight, Fog, Group, Mesh, Vector3 } from "three";
import sepang from "../../data/circuits/sepang.json";
import { sepangTrack } from "../../data/sepangPace";
import { poseAtDistance } from "../../domain/lapPhysics";
import type { CarDefinition, CarState } from "../../domain/field";
import Environment, {
  SKY,
  useEnvironmentLayout,
} from "./environment/Environment";
import { LAYER } from "./environment/layout";
import FormulaCar from "../cars/FormulaCar";
import { SimplifiedCar } from "../cars/CarRepresentation";
import { FORMULA_VISUAL_LENGTH } from "../cars/formulaVisual";
import { visualTyreCompound } from "../cars/carVisualState";

// Metric scene: 1 unit = 1 m, z up, built from the same profile the physics samples.
const CAR_LENGTH_METRES = 5.6;
const CAR_SCALE = CAR_LENGTH_METRES / FORMULA_VISUAL_LENGTH;
const coordinates = sepang.features[0].geometry.coordinates;

export interface DriverSceneProps {
  clock: RefObject<number>;
  entries: readonly CarDefinition[];
  sample: (time: number) => CarState[];
  activeIds?: readonly string[];
  tyresKnown: boolean;
  selectedId: string;
  onSelect: (id: string) => void;
}

function pose(car: CarState) {
  return poseAtDistance(sepangTrack, car.progress * sepangTrack.length);
}

function DriverCar({
  car,
  index,
  field,
  selected,
  tyresKnown,
  onSelect,
}: {
  car: CarDefinition;
  index: number;
  field: RefObject<CarState[]>;
  selected: boolean;
  tyresKnown: boolean;
  onSelect: (id: string) => void;
}) {
  const group = useRef<Group>(null);
  const body = useRef<Group>(null);
  const compound = visualTyreCompound(
    field.current[index]?.compound,
    tyresKnown,
  );
  useFrame(() => {
    const state = field.current[index];
    if (!group.current || !state) return;
    const p = pose(state);
    group.current.position.set(p.x, p.y, LAYER.asphalt);
    group.current.rotation.z = p.heading;
    // The GLB loads asynchronously, so keep the shadow flag in step with selection.
    body.current?.traverse((object) => {
      if (object instanceof Mesh) object.castShadow = selected;
    });
  });
  return (
    <group
      ref={group}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(car.id);
      }}
    >
      <group ref={body} scale={CAR_SCALE}>
        <FormulaCar compound={compound} fallback={<SimplifiedCar />} />
      </group>
      {/* Shadows only for the followed car keep the shadow pass cheap. */}
      {selected && (
        <mesh position={[0, 0, 0.02]}>
          <ringGeometry args={[3.1, 3.25, 40]} />
          <meshBasicMaterial color="#00a19c" transparent opacity={0.45} />
        </mesh>
      )}
    </group>
  );
}

function FollowRig({
  field,
  entries,
  selectedId,
}: {
  field: RefObject<CarState[]>;
  entries: readonly CarDefinition[];
  selectedId: string;
}) {
  const { camera, scene } = useThree();
  const sun = useRef<DirectionalLight>(null);
  const heading = useRef<Vector3 | null>(null);
  const index = entries.findIndex((car) => car.id === selectedId);
  useLayoutEffect(() => {
    camera.up.set(0, 0, 1);
    scene.fog = new Fog(SKY.horizon, SKY.fogNear, SKY.fogFar);
    return () => {
      scene.fog = null;
    };
  }, [camera, scene]);
  useFrame((_, delta) => {
    const state = field.current[index];
    if (!state) return;
    const p = pose(state);
    const want = new Vector3(Math.cos(p.heading), Math.sin(p.heading), 0);
    // Position is locked to the car; only the heading is eased (no 15–20 m lag at speed).
    heading.current ??= want.clone();
    heading.current
      .lerp(want, 1 - Math.exp(-Math.min(delta, 0.1) * 5))
      .normalize();
    const h = heading.current;
    camera.position.set(p.x - h.x * 13, p.y - h.y * 13, 4.4);
    camera.lookAt(p.x + h.x * 14, p.y + h.y * 14, 1.2);
    if (sun.current) {
      sun.current.position.set(p.x - 140, p.y - 220, 320);
      sun.current.target.position.set(p.x, p.y, 0);
      sun.current.target.updateMatrixWorld();
    }
  });
  return (
    <>
      <hemisphereLight
        args={["#e8f1f4", "#4c5a3e", 1.4]}
        position={[0, 0, 1]}
      />
      <directionalLight
        ref={sun}
        intensity={2.6}
        color="#fff6e6"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-camera-left={-60}
        shadow-camera-right={60}
        shadow-camera-top={60}
        shadow-camera-bottom={-60}
        shadow-camera-near={10}
        shadow-camera-far={800}
      />
    </>
  );
}

function World({
  clock,
  entries,
  sample,
  activeIds,
  tyresKnown,
  selectedId,
  onSelect,
}: DriverSceneProps) {
  const field = useRef<CarState[]>(sample(clock.current));
  const layout = useEnvironmentLayout(sepangTrack, coordinates);
  useFrame(() => {
    field.current = sample(clock.current);
  }, -1);
  return (
    <>
      <FollowRig field={field} entries={entries} selectedId={selectedId} />
      <Environment track={sepangTrack} layout={layout} />
      {entries.map(
        (car, index) =>
          (!activeIds || activeIds.includes(car.id)) && (
            <DriverCar
              key={car.id}
              car={car}
              index={index}
              field={field}
              selected={car.id === selectedId}
              tyresKnown={tyresKnown}
              onSelect={onSelect}
            />
          ),
      )}
    </>
  );
}

export default function DriverScene(props: DriverSceneProps) {
  return (
    <Canvas
      shadows
      dpr={[1, 1.5]}
      // near ≥ 0.3 keeps depth precision for asphalt over grass on mobile GPUs.
      camera={{ fov: 55, near: 0.5, far: 7000, position: [0, 0, 50] }}
      fallback={
        <div className="fallback">
          WebGL is unavailable. Enable browser hardware acceleration to view the
          circuit.
        </div>
      }
    >
      <World {...props} />
    </Canvas>
  );
}
