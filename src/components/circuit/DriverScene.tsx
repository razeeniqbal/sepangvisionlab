import { useLayoutEffect, useMemo, useRef, type RefObject } from "react";
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
import {
  attitudeTarget,
  curvatureAt,
  ease,
  spinDelta,
  steerAngle,
} from "../../domain/carMotion";
import {
  COVER,
  FRONT_AXLE_X,
  HUB_Z,
  REAR_AXLE_X,
  WHEEL_RADIUS,
  type WheelSource,
} from "../cars/wheels/wheelLayout";
import {
  createGeneratedWheels,
  modelWheelDriver,
} from "../cars/wheels/generatedWheels";

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

// Today's GLB is one merged mesh, so wheels are generated; see wheelLayout.ts.
const WHEELS: WheelSource = "generated";
const WHEELBASE = (FRONT_AXLE_X - REAR_AXLE_X) * CAR_SCALE;
const WHEEL_RADIUS_METRES = WHEEL_RADIUS * COVER * CAR_SCALE;

function DriverCar({
  car,
  index,
  field,
  clock,
  selected,
  tyresKnown,
  onSelect,
}: {
  car: CarDefinition;
  index: number;
  field: RefObject<CarState[]>;
  clock: RefObject<number>;
  selected: boolean;
  tyresKnown: boolean;
  onSelect: (id: string) => void;
}) {
  const group = useRef<Group>(null);
  const body = useRef<Group>(null);
  const attitude = useRef<Group>(null);
  const compound = visualTyreCompound(
    field.current[index]?.compound,
    tyresKnown,
  );
  const wheels = useMemo(() => createGeneratedWheels(compound), [compound]);
  const motion = useRef({
    distance: NaN,
    time: NaN,
    speed: 0,
    acceleration: 0,
    steer: 0,
    spin: 0,
    pitch: 0,
    roll: 0,
    model: null as ReturnType<typeof modelWheelDriver>,
  });
  useFrame((_, delta) => {
    const state = field.current[index];
    if (!group.current || !state) return;
    const m = motion.current,
      distance = state.progress * sepangTrack.length,
      p = poseAtDistance(sepangTrack, distance);
    group.current.position.set(p.x, p.y, LAYER.asphalt);
    group.current.rotation.z = p.heading;
    // Acceleration in replay time: a paused or seeking replay holds the body still.
    const speed = state.speedKph / 3.6,
      dt = clock.current - m.time;
    if (dt > 0 && dt < 1) m.acceleration = (speed - m.speed) / dt;
    else if (dt !== 0) m.acceleration = 0;
    const spin = Number.isNaN(m.distance)
      ? 0
      : spinDelta(
          m.distance,
          distance,
          WHEEL_RADIUS_METRES,
          sepangTrack.length,
        );
    m.spin = (m.spin + spin) % (Math.PI * 2);
    m.distance = distance;
    m.speed = speed;
    m.time = clock.current;
    const target = attitudeTarget(
      m.acceleration,
      speed,
      curvatureAt(sepangTrack, distance),
    );
    m.steer = ease(
      m.steer,
      steerAngle(sepangTrack, distance, WHEELBASE),
      delta,
      10,
    );
    m.pitch = ease(m.pitch, target.pitch, delta, 6);
    m.roll = ease(m.roll, target.roll, delta, 6);
    attitude.current?.rotation.set(m.roll, m.pitch, 0);
    if (WHEELS === "model" && attitude.current)
      m.model ??= modelWheelDriver(attitude.current);
    wheels.root.visible = !m.model;
    if (m.model) m.model(m.steer, m.spin);
    else
      for (const rig of wheels.rigs) {
        rig.steer.rotation.z = rig.front ? m.steer : 0;
        rig.spin.rotation.y = m.spin;
      }
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
        {/* Pitch and roll pivot at hub height; the wheels stay planted. */}
        <group position={[0, 0, HUB_Z]}>
          <group ref={attitude}>
            <group position={[0, 0, -HUB_Z]}>
              <FormulaCar compound={compound} fallback={<SimplifiedCar />} />
            </group>
          </group>
        </group>
        <primitive object={wheels.root} />
      </group>
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
    // Snap after a seek or a long frame hitch rather than swinging round from a stale heading.
    if (!heading.current || heading.current.dot(want) < 0.82)
      heading.current = want.clone();
    else
      heading.current
        .lerp(want, 1 - Math.exp(-Math.min(delta, 0.25) * 5))
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
              clock={clock}
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
