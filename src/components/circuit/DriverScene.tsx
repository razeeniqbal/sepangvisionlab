import { useLayoutEffect, useMemo, useRef, type RefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import {
  BufferAttribute,
  BufferGeometry,
  DirectionalLight,
  Fog,
  Group,
  Line,
  LineBasicMaterial,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  PerspectiveCamera,
  Raycaster,
  Vector3,
} from "three";
import sepang from "../../data/circuits/sepang.json";
import { sepangTrack } from "../../data/sepangPace";
import { poseAtDistance } from "../../domain/lapPhysics";
import type { CarDefinition, CarState } from "../../domain/field";
import Environment, {
  SKY,
  useEnvironmentLayout,
  type EnvironmentLayout,
} from "./environment/Environment";
import { LAYER, barrierOffset, type Building } from "./environment/layout";
import { leftNormals } from "./environment/ribbon";
import {
  cameraPose,
  clearTvPoints,
  nearestPoint,
  pickTvCamera,
  smoothHeading,
  stepRig,
  tvPoints,
  type Vec3,
  type CameraMode,
  type CameraRigState,
} from "./cameraRig";
import FormulaCar from "../cars/FormulaCar";
import PerfStats from "./PerfStats";
import { QUALITY, type QualitySettings } from "./quality";
import { themedAccent } from "../../themeRuntime";
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
  rig: RefObject<CameraRigState>;
  mode: CameraMode;
  /** Short broadcast tag per entry (same order as entries). */
  tags?: readonly string[];
  ghost?: { id: string; sample: (time: number) => CarState };
  labels?: boolean;
  trails?: boolean;
  /** Real rainfall (recorded sessions): wetter asphalt, greyer sky, shorter fog. */
  wet?: boolean;
  quality?: QualitySettings;
}

// Line-of-sight test against scenery tagged as an occluder (buildings, gantry, boards, trees).
const ray = new Raycaster();
const rayFrom = new Vector3(),
  rayTo = new Vector3(),
  rayDir = new Vector3();
function blocked(
  from: Vec3 | Vector3,
  to: Vec3 | Vector3,
  occluders: readonly Object3D[],
  margin = 3,
) {
  if (!occluders.length) return false;
  rayFrom.set(from.x, from.y, from.z);
  rayTo.set(to.x, to.y, to.z);
  const range = rayDir.subVectors(rayTo, rayFrom).length();
  if (range <= margin) return false;
  ray.set(rayFrom, rayDir.normalize());
  ray.near = 0;
  ray.far = range - margin;
  return ray.intersectObjects(occluders as Object3D[], true).length > 0;
}

// Recorded cars carry their own aligned pose (with lateral offset, raw in the pit lane);
// simulated cars sit on the profile at their progress.
type Posed = CarState & {
  pose?: { x: number; y: number; heading: number };
  present?: boolean;
  stale?: boolean;
};
function pose(car: Posed) {
  return car.pose ?? poseAtDistance(sepangTrack, car.progress * sepangTrack.length);
}

const TRAIL_POINTS = 32;
const tagPoint = new Vector3();

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
  ring,
  tag,
  labels,
  trails,
  occluders,
  tyresKnown,
  onSelect,
}: {
  car: CarDefinition;
  index: number;
  field: RefObject<CarState[]>;
  clock: RefObject<number>;
  selected: boolean;
  ring: boolean;
  tag: string;
  labels: boolean;
  trails: boolean;
  occluders: RefObject<Object3D[]>;
  tyresKnown: boolean;
  onSelect: (id: string) => void;
}) {
  const group = useRef<Group>(null);
  const label = useRef<HTMLDivElement>(null);
  const shown = useRef("");
  const body = useRef<Group>(null);
  const attitude = useRef<Group>(null);
  const compound = visualTyreCompound(
    field.current[index]?.compound,
    tyresKnown,
  );
  const wheels = useMemo(() => createGeneratedWheels(compound), [compound]);
  // Trail: the road behind the car for ~2.5 s of travel, in the team colour.
  const trail = useMemo(() => {
    const geometry = new BufferGeometry();
    geometry.setAttribute(
      "position",
      new BufferAttribute(new Float32Array(TRAIL_POINTS * 3), 3),
    );
    const line = new Line(
      geometry,
      new LineBasicMaterial({ color: car.color, transparent: true, opacity: 0.75 }),
    );
    line.frustumCulled = false;
    return line;
  }, [car.color]);
  const check = useRef(index);
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
  useFrame(({ camera }, delta) => {
    const state: Posed | undefined = field.current[index];
    if (!group.current || !state) return;
    // No recorded sample yet (before the car leaves the garage feed): draw nothing.
    const present = state.present !== false;
    group.current.visible = present;
    // Broadcast tag: nearby cars only, never over the onboard camera's own car.
    if (label.current) {
      label.current.classList.toggle("is-stale", state.stale === true);
      const near =
        present && labels && (ring || !selected)
          ? camera.position.distanceTo(group.current.position) < 240
          : false;
      const text = near ? "P" + state.position + " " + tag : "";
      if (text !== shown.current) {
        shown.current = text;
        label.current.textContent = text.replace(/^P\d+ /, "");
        label.current.dataset.position = "P" + state.position;
        label.current.hidden = !near;
      }
      // Fade a tag that scenery hides; staggered so each car is checked every 6th frame.
      if (near && check.current++ % 6 === 0) {
        tagPoint.copy(group.current.position).setZ(2.4);
        label.current.classList.toggle(
          "is-occluded",
          blocked(camera.position, tagPoint, occluders.current, 1),
        );
      }
    }
    const m = motion.current,
      distance = state.progress * sepangTrack.length,
      p = pose(state);
    trail.visible = trails && present;
    if (trail.visible) {
      const length = Math.min(260, Math.max(12, (state.speedKph / 3.6) * 2.5));
      const positions = trail.geometry.getAttribute("position") as BufferAttribute;
      for (let k = 0; k < TRAIL_POINTS; k++) {
        const q = poseAtDistance(
          sepangTrack,
          distance - (length * k) / (TRAIL_POINTS - 1),
        );
        positions.setXYZ(k, q.x, q.y, LAYER.paint + 0.06);
      }
      positions.needsUpdate = true;
    }
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
    <>
    <primitive object={trail} />
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
              <FormulaCar
                compound={compound}
                teamColor={car.color}
                fallback={<SimplifiedCar />}
              />
            </group>
          </group>
        </group>
        <primitive object={wheels.root} />
      </group>
      <Html position={[0, 0, 2.4]} center zIndexRange={[20, 0]}>
        <div
          ref={label}
          className={"bc-car-tag" + (selected ? " is-selected" : "")}
          hidden
        />
      </Html>
      {ring && (
        <mesh position={[0, 0, 0.02]}>
          <ringGeometry args={[3.1, 3.25, 40]} />
          <primitive object={ringMaterial} attach="material" />
        </mesh>
      )}
    </group>
    </>
  );
}

// Translucent replay of a saved setup. Shares the GLB geometry; its own material only.
const ghostMaterial = new MeshBasicMaterial({
  color: themedAccent(),
  transparent: true,
  opacity: 0.32,
  depthWrite: false,
});
// Selection ring under the followed car, in the theme accent.
const ringMaterial = new MeshBasicMaterial({
  color: themedAccent(),
  transparent: true,
  opacity: 0.45,
});
function GhostCar({
  ghost,
  clock,
}: {
  ghost: { sample: (time: number) => CarState };
  clock: RefObject<number>;
}) {
  const group = useRef<Group>(null);
  useFrame(() => {
    if (!group.current) return;
    const p = pose(ghost.sample(clock.current));
    group.current.position.set(p.x, p.y, LAYER.asphalt + 0.01);
    group.current.rotation.z = p.heading;
    group.current.traverse((object) => {
      if (object instanceof Mesh && object.material !== ghostMaterial) {
        object.material = ghostMaterial;
        object.castShadow = false;
      }
    });
  });
  return (
    <group ref={group} renderOrder={2}>
      <group scale={CAR_SCALE}>
        <FormulaCar fallback={<SimplifiedCar />} />
      </group>
    </group>
  );
}

// Trackside cameras keep 6 m from boards, gantry posts and barriers, and stay out of buildings.
function trackside(layout: EnvironmentLayout): Vec3[] {
  const normals = leftNormals(sepangTrack);
  const obstacles: { x: number; y: number }[] = [...layout.boards];
  for (let i = 0; i < sepangTrack.count; i++)
    for (const side of [-1, 1] as const) {
      const o = barrierOffset(sepangTrack, i, side);
      obstacles.push({
        x: sepangTrack.x[i] + normals.nx[i] * o,
        y: sepangTrack.y[i] + normals.ny[i] * o,
      });
    }
  for (const side of [-1, 1]) {
    const g = layout.gantry,
      span = 11;
    obstacles.push({
      x: g.x - Math.sin(g.heading) * side * span,
      y: g.y + Math.cos(g.heading) * side * span,
    });
  }
  const inside = (p: Vec3, b: Building) => {
    const c = Math.cos(-b.heading),
      s = Math.sin(-b.heading),
      dx = p.x - b.x,
      dy = p.y - b.y;
    return (
      Math.abs(dx * c - dy * s) < b.length / 2 + 6 &&
      Math.abs(dx * s + dy * c) < b.depth / 2 + 6
    );
  };
  return clearTvPoints(tvPoints(sepangTrack, normals), obstacles).filter(
    (p) => !inside(p, layout.pit) && !inside(p, layout.stand),
  );
}

// A board between a trackside camera and the car, inside the shot's cone, spoils the frame
// even when it does not cut the exact line of sight.
function boardInShot(
  camera: Vec3,
  car: { x: number; y: number },
  boards: readonly { x: number; y: number }[],
  cone = 0.44,
) {
  const range = Math.hypot(car.x - camera.x, car.y - camera.y),
    toCar = Math.atan2(car.y - camera.y, car.x - camera.x);
  return boards.some((b) => {
    const d = Math.hypot(b.x - camera.x, b.y - camera.y);
    const off = Math.atan2(b.y - camera.y, b.x - camera.x) - toCar;
    return d < range && Math.abs(Math.atan2(Math.sin(off), Math.cos(off))) < cone;
  });
}

function CameraRig({
  field,
  entries,
  selectedId,
  rig,
  layout,
  occluders,
  wet,
  quality,
}: {
  field: RefObject<CarState[]>;
  entries: readonly CarDefinition[];
  selectedId: string;
  rig: RefObject<CameraRigState>;
  layout: EnvironmentLayout;
  occluders: RefObject<Object3D[]>;
  wet: boolean;
  quality: QualitySettings;
}) {
  const { camera, scene } = useThree();
  const sun = useRef<DirectionalLight>(null);
  const index = entries.findIndex((car) => car.id === selectedId);
  const tv = useMemo(() => trackside(layout), [layout]);
  const shot = useRef<{ point: Vec3 | null; age: number }>({
    point: null,
    age: Infinity,
  });
  useLayoutEffect(() => {
    camera.up.set(0, 0, 1);
    scene.fog = wet
      ? new Fog(SKY.wetHorizon, SKY.wetFogNear, SKY.wetFogFar)
      : new Fog(SKY.horizon, SKY.fogNear, SKY.fogFar);
    return () => {
      scene.fog = null;
    };
  }, [camera, scene, wet]);
  useFrame((_, delta) => {
    const state = field.current[index];
    if (!state || !(camera instanceof PerspectiveCamera)) return;
    const p = pose(state);
    stepRig(rig.current, delta);
    // Re-pick the trackside camera four times a second: nearest clear line of sight wins.
    let cameras = tv;
    if (rig.current.mode === "tv") {
      shot.current.age += delta;
      if (shot.current.age >= 0.25 || !shot.current.point) {
        const target = { x: p.x, y: p.y, z: 0.8 };
        shot.current.point =
          pickTvCamera(
            tv,
            p,
            (point) =>
              boardInShot(point, p, layout.boards) ||
              blocked(point, target, occluders.current),
            shot.current.point,
          ) ?? nearestPoint(tv, p.x, p.y);
        shot.current.age = 0;
      }
      cameras = [shot.current.point];
    }
    const view = cameraPose(
      rig.current,
      p,
      smoothHeading(rig.current, p.heading, delta),
      cameras,
    );
    camera.position.set(view.position.x, view.position.y, view.position.z);
    camera.lookAt(view.target.x, view.target.y, view.target.z);
    if (Math.abs(camera.fov - view.fov) > 0.01) {
      camera.fov = view.fov;
      camera.updateProjectionMatrix();
    }
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
      {/* A tight shadow camera that follows the selected car; only that car casts. */}
      <directionalLight
        ref={sun}
        intensity={2.6}
        color="#fff6e6"
        castShadow={quality.shadows}
        shadow-mapSize={[quality.shadowMap, quality.shadowMap]}
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
  rig,
  mode,
  tags,
  ghost,
  labels = true,
  trails = false,
  wet = false,
  quality = QUALITY.balanced,
}: DriverSceneProps) {
  const field = useRef<CarState[]>(sample(clock.current));
  const layout = useEnvironmentLayout(sepangTrack, coordinates);
  const occluders = useRef<Object3D[]>([]);
  useFrame(({ scene }) => {
    field.current = sample(clock.current);
    // Instanced scenery mounts a frame later; collect until the set is complete.
    if (occluders.current.length < 6) {
      const found: Object3D[] = [];
      scene.traverse((object) => {
        if (object.userData.occluder) found.push(object);
      });
      occluders.current = found;
    }
  }, -1);
  return (
    <>
      <CameraRig
        field={field}
        entries={entries}
        selectedId={selectedId}
        rig={rig}
        layout={layout}
        occluders={occluders}
        wet={wet}
        quality={quality}
      />
      <Environment
        track={sepangTrack}
        layout={layout}
        wet={wet}
        quality={quality}
      />
      {ghost && <GhostCar ghost={ghost} clock={clock} />}
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
              ring={car.id === selectedId && mode !== "onboard"}
              tag={tags?.[index] ?? "#" + car.number}
              labels={labels}
              trails={trails}
              occluders={occluders}
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
      shadows={(props.quality ?? QUALITY.balanced).shadows}
      dpr={(props.quality ?? QUALITY.balanced).dpr}
      // near ≥ 0.3 keeps depth precision for asphalt over grass on mobile GPUs.
      camera={{ fov: 55, near: 0.3, far: 7000, position: [0, 0, 50] }}
      fallback={
        <div className="fallback">
          WebGL is unavailable. Enable browser hardware acceleration to view the
          circuit.
        </div>
      }
    >
      <World {...props} />
      <PerfStats />
    </Canvas>
  );
}
