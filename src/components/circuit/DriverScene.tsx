import { useEffect, useLayoutEffect, useMemo, useRef, type RefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  DirectionalLight,
  Fog,
  Group,
  Line,
  LineBasicMaterial,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  PerspectiveCamera,
  PlaneGeometry,
  Raycaster,
  Vector3,
} from "three";
import sepang from "../../data/circuits/sepang.json";
import { sepangTrack } from "../../data/sepangPace";
import { poseAtDistance } from "../../domain/lapPhysics";
import { gradeAt, heightAt } from "../../domain/elevation";
import type { CarDefinition, CarState } from "../../domain/field";
import Environment, {
  PIT_WALL_OFFSET,
  fenceSightTarget,
  SKY,
  useEnvironmentLayout,
  type EnvironmentLayout,
} from "./environment/Environment";
import { LAYER, barrierOffset, type Building } from "./environment/layout";
import { leftNormals } from "./environment/ribbon";
import {
  cameraPose,
  clearTvPoints,
  dragRig,
  resetView,
  wheelRig,
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
  rideDrop,
  roadShake,
  spinDelta,
  spring,
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
  wheelBlur,
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

// Soft contact shadow under every car (one shared texture and plane): grounds the cars that
// are outside the sun's shadow box, and darkens the road right under the floor like a real car.
const contactShadow = (() => {
  let texture: CanvasTexture | null = null;
  if (typeof document !== "undefined") {
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 128;
    const c = canvas.getContext("2d");
    if (c) {
      const g = c.createRadialGradient(32, 64, 6, 32, 64, 64);
      g.addColorStop(0, "rgba(0,0,0,0.75)");
      g.addColorStop(0.5, "rgba(0,0,0,0.45)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      c.fillStyle = g;
      c.fillRect(0, 0, 64, 128);
    }
    texture = new CanvasTexture(canvas);
  }
  return {
    geometry: new PlaneGeometry(2.6, 6.4).rotateZ(Math.PI / 2),
    material: new MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      opacity: 0.85,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    }),
  };
})();
// Rear rain light: blinks in the wet and in the pit lane (speed limiter), as on the real cars.
const rainLightMaterial = new MeshBasicMaterial({ color: "#ff2a2a", toneMapped: false });

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
/** Track surface height (m) at a distance, from the DERIVED elevation; 0 on a flat profile. */
const trackZ = (distance: number) =>
  sepangTrack.z ? heightAt(sepangTrack.z, sepangTrack.length, distance) : 0;
const trackGrade = (distance: number) =>
  sepangTrack.z ? gradeAt(sepangTrack.z, sepangTrack.length, distance) : 0;
const tagPoint = new Vector3();
const TAG_HEIGHT = 2.4;

/** Car tags drawn by TagLayer: each car registers its element and the group it follows. */
type TagRegistry = Map<string, { group: RefObject<Group | null>; el: HTMLDivElement }>;

/**
 * Positions every car tag once per frame, from the scene's after-render hook: by then the
 * camera and every car are final for the frame. drei's <Html> projected each tag before the
 * cars and camera updated, so tags trailed their car by a frame and shook at speed.
 */
function TagLayer({ registry }: { registry: TagRegistry }) {
  const { gl, scene } = useThree();
  const container = useMemo(() => {
    const div = document.createElement("div");
    div.className = "sv-tag-layer";
    return div;
  }, []);
  useLayoutEffect(() => {
    const host = gl.domElement.parentElement;
    host?.appendChild(container);
    const v = new Vector3();
    const previous = scene.onAfterRender;
    scene.onAfterRender = (_renderer, _scene, camera) => {
      const width = gl.domElement.clientWidth,
        height = gl.domElement.clientHeight;
      for (const { group, el } of registry.values()) {
        if (el.parentElement !== container) container.appendChild(el);
        const g = group.current;
        if (!g || el.hidden) continue;
        v.set(g.position.x, g.position.y, g.position.z + TAG_HEIGHT).project(camera);
        const visible = v.z < 1 && Math.abs(v.x) < 1.2 && Math.abs(v.y) < 1.2;
        el.style.visibility = visible ? "" : "hidden";
        if (!visible) continue;
        const x = ((v.x + 1) / 2) * width,
          y = ((1 - v.y) / 2) * height;
        el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -50%)`;
      }
    };
    return () => {
      scene.onAfterRender = previous;
      container.remove();
    };
  }, [gl, scene, container, registry]);
  return null;
}

// Today's GLB is one merged mesh, so wheels are generated; see wheelLayout.ts.
const WHEELS: WheelSource = "generated";
const WHEELBASE = (FRONT_AXLE_X - REAR_AXLE_X) * CAR_SCALE;
const WHEEL_RADIUS_METRES = WHEEL_RADIUS * COVER * CAR_SCALE;
// Visual steering gain: real lock in most corners is only a few degrees and reads as none.
const STEER_GAIN = 1.8;

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
  wet,
  shadowCaster,
  registry,
  mounted,
  rig,
}: {
  /** Followed car in the onboard camera: drawn with the camera's heading and no body motion. */
  mounted: boolean;
  rig: RefObject<CameraRigState>;
  wet: boolean;
  shadowCaster: boolean;
  registry: TagRegistry;
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
  const label = useRef<HTMLDivElement | null>(null);
  const shown = useRef("");
  const occludedVotes = useRef({ last: false, applied: false });
  // The tag element lives in TagLayer's overlay, not in the 3D tree.
  useEffect(() => {
    const el = document.createElement("div");
    el.className = "bc-car-tag";
    el.hidden = true;
    label.current = el;
    registry.set(car.id, { group, el });
    return () => {
      registry.delete(car.id);
      el.remove();
      label.current = null;
    };
  }, [registry, car.id]);
  useEffect(() => {
    label.current?.classList.toggle("is-selected", selected);
  }, [selected]);
  const body = useRef<Group>(null);
  const attitude = useRef<Group>(null);
  const pivot = useRef<Group>(null);
  const rainLight = useRef<Mesh>(null);
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
    heading: NaN,
    pathCurvature: 0,
    pitch: 0,
    pitchV: 0,
    roll: 0,
    rollV: 0,
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
      // Two checks in a row must agree before the fade changes, so tags at the edge of a
      // board do not flicker.
      if (near && check.current++ % 6 === 0) {
        tagPoint.copy(group.current.position).setZ(group.current.position.z + TAG_HEIGHT);
        const hit = blocked(camera.position, tagPoint, occluders.current, 1);
        const votes = occludedVotes.current;
        if (hit === votes.last && hit !== votes.applied) {
          votes.applied = hit;
          label.current.classList.toggle("is-occluded", hit);
        }
        votes.last = hit;
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
        positions.setXYZ(k, q.x, q.y, LAYER.paint + 0.06 + trackZ(distance - (length * k) / (TRAIL_POINTS - 1)));
      }
      positions.needsUpdate = true;
    }
    // Ride the DERIVED elevation: height from the track, nose up on climbs (rotation order ZYX:
    // pitch in the car's own frame, then heading).
    group.current.position.set(p.x, p.y, LAYER.asphalt + trackZ(distance));
    group.current.rotation.order = "ZYX";
    group.current.rotation.set(
      0,
      -Math.atan(trackGrade(distance)),
      mounted ? (rig.current.heading ?? p.heading) : p.heading,
    );
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
    // Curvature of the car's own path (racing line included), from how far its heading turned
    // over the ground covered this frame; the centre line stands in when it barely moves.
    const travelled = spin * WHEEL_RADIUS_METRES;
    const onLine = curvatureAt(sepangTrack, distance);
    if (Math.abs(travelled) > 0.05 && !Number.isNaN(m.heading)) {
      const turn = Math.atan2(Math.sin(p.heading - m.heading), Math.cos(p.heading - m.heading));
      m.pathCurvature = ease(m.pathCurvature, Math.max(-0.12, Math.min(0.12, turn / travelled)), delta, 12);
    } else if (Math.abs(travelled) <= 0.05) m.pathCurvature = ease(m.pathCurvature, onLine, delta, 4);
    m.heading = p.heading;
    m.distance = distance;
    m.speed = speed;
    m.time = clock.current;
    const target = attitudeTarget(m.acceleration, speed, m.pathCurvature);
    // Bicycle model on the real path: δ = atan(L·k), drawn at STEER_GAIN so it reads on screen.
    const steerTarget =
      Math.abs(travelled) > 0.05
        ? Math.atan(WHEELBASE * m.pathCurvature)
        : steerAngle(sepangTrack, distance, WHEELBASE, 9);
    m.steer = ease(
      m.steer,
      Math.max(-0.42, Math.min(0.42, steerTarget * STEER_GAIN)),
      delta,
      10,
    );
    // Sprung body: dives, squats and rolls with a little overshoot; a paused replay holds still.
    const step = dt > 0 && dt < 1 ? delta : 0;
    [m.pitch, m.pitchV] = spring(m.pitch, m.pitchV, target.pitch, step);
    [m.roll, m.rollV] = spring(m.roll, m.rollV, target.roll, step);
    const shake = roadShake(clock.current, speed, index * 1.37);
    // Onboard, the camera rides on the car: the car's own body motion would read as shaking.
    if (mounted) attitude.current?.rotation.set(0, 0, 0);
    else attitude.current?.rotation.set(m.roll + shake.roll, m.pitch + shake.pitch, 0);
    if (pivot.current) pivot.current.position.z = HUB_Z - rideDrop(speed) / CAR_SCALE;
    wheels.blur.opacity = wheelBlur(speed);
    if (rainLight.current) {
      const inPit = (state as Posed & { inPit?: boolean }).inPit === true;
      rainLight.current.visible =
        present && (wet || inPit) && Math.floor(clock.current * 4) % 2 === 0;
    }
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
      if (
        object instanceof Mesh &&
        object.material !== wheels.blur &&
        object.material !== rainLightMaterial
      )
        object.castShadow = shadowCaster;
    });
  });
  return (
    <>
    <primitive object={trail} />
    <group
      ref={group}
      onClick={(event) => {
        event.stopPropagation();
        // A drag that ends over a car moved the camera; only a real click selects.
        if (event.delta > 6) return;
        onSelect(car.id);
      }}
    >
      <group ref={body} scale={CAR_SCALE}>
        {/* Pitch and roll pivot at hub height; the wheels stay planted. */}
        <group ref={pivot} position={[0, 0, HUB_Z]}>
          <group ref={attitude}>
            <group position={[0, 0, -HUB_Z]}>
              <FormulaCar
                compound={compound}
                teamColor={car.color}
                team={car.team}
                number={car.number}
                fallback={<SimplifiedCar />}
              />
              <mesh
                ref={rainLight}
                material={rainLightMaterial}
                position={[-0.522, 0, 0.074]}
                visible={false}
              >
                <boxGeometry args={[0.006, 0.026, 0.01]} />
              </mesh>
            </group>
          </group>
        </group>
        <primitive object={wheels.root} />
      </group>
      <mesh
        geometry={contactShadow.geometry}
        material={contactShadow.material}
        position={[0, 0, 0.012]}
        renderOrder={1}
      />
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
      span = PIT_WALL_OFFSET + 0.25;
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
      Math.abs(dx * c - dy * s) < b.length / 2 + 14 &&
      Math.abs(dx * s + dy * c) < b.depth / 2 + 14
    );
  };
  const buildings = [layout.pit, layout.stand, layout.k1, layout.hill].filter((b): b is Building => b !== null);
  return clearTvPoints(tvPoints(sepangTrack, normals), obstacles).filter(
    (p) => !buildings.some((b) => inside(p, b)),
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
  clock,
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
  clock: RefObject<number>;
}) {
  const { camera, scene } = useThree();
  const sun = useRef<DirectionalLight>(null);
  const index = entries.findIndex((car) => car.id === selectedId);
  const tv = useMemo(() => trackside(layout), [layout]);
  const shot = useRef<{ point: Vec3 | null; age: number }>({
    point: null,
    age: Infinity,
  });
  // Game-style camera feel, eased so it never jumps: wider lens with speed, the chase camera
  // dropping back under power and closing in under braking, and a faint high-speed shake.
  const feel = useRef({ speed: 0, time: NaN, lag: 0, lagV: 0, fov: 0 });
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
        const target = { x: p.x, y: p.y, z: 0.8 + trackZ(state.progress * sepangTrack.length) };
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
      smoothHeading(rig.current, p.heading, delta, rig.current.mode === "onboard" ? 12 : 5),
      cameras,
    );
    const f = feel.current,
      mode = rig.current.mode,
      speed = state.speedKph / 3.6,
      dt = clock.current - f.time;
    const accel = dt > 0 && dt < 1 ? (speed - f.speed) / dt : 0;
    f.speed = speed;
    f.time = clock.current;
    const moving = mode === "chase" || mode === "onboard";
    const lagTarget = mode === "chase" ? Math.max(-1.2, Math.min(1.2, accel * 0.05)) : 0;
    [f.lag, f.lagV] = spring(f.lag, f.lagV, lagTarget, dt > 0 && dt < 1 ? delta : 0, 40, 9);
    f.fov = ease(f.fov, moving ? Math.max(0, Math.min(1, (speed - 25) / 60)) * (mode === "chase" ? 9 : 7) : 0, delta, 3);
    // A light high-speed shake on the chase camera only: the onboard camera is mounted to the car.
    const shake = mode === "chase" ? roadShake(clock.current * 1.7, speed, 3.1).pitch * 10 : 0;
    const back = { x: -Math.cos(p.heading), y: -Math.sin(p.heading) };
    // Camera poses are built on a flat track: lift them by the car's track height (trackside TV
    // cameras already stand on their own ground, so only their aim point moves).
    const carZ = trackZ(state.progress * sepangTrack.length);
    const lift = mode === "tv" ? 0 : carZ;
    fenceSightTarget.value.set(p.x, p.y, carZ + 0.8);
    camera.position.set(
      view.position.x + back.x * f.lag,
      view.position.y + back.y * f.lag,
      view.position.z + shake + lift,
    );
    camera.lookAt(view.target.x, view.target.y, view.target.z + shake * 0.5 + carZ);
    const fov = view.fov + f.fov;
    if (Math.abs(camera.fov - fov) > 0.01) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
    if (sun.current) {
      const ground = trackZ(state.progress * sepangTrack.length);
      sun.current.position.set(p.x - 140, p.y - 220, 320 + ground);
      sun.current.target.position.set(p.x, p.y, ground);
      sun.current.target.updateMatrixWorld();
    }
  });
  return (
    <>
      <hemisphereLight
        args={["#e8f1f4", "#4c5a3e", 0.75]}
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
  const scans = useRef(0);
  const registry = useMemo<TagRegistry>(() => new Map(), []);
  useFrame(({ scene }) => {
    field.current = sample(clock.current);
    // Occluders mount over the first frames and change with the quality preset:
    // scan every frame for the first second, then every 2 s (a cheap scene walk).
    scans.current++;
    if (scans.current < 60 || scans.current % 120 === 0) {
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
        clock={clock}
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
              wet={wet}
              shadowCaster={car.id === selectedId || quality.allCarShadows}
              registry={registry}
              mounted={car.id === selectedId && mode === "onboard"}
              rig={rig}
            />
          ),
      )}
      <TagLayer registry={registry} />
    </>
  );
}

/**
 * Mouse and touch camera control: drag to orbit (or look around onboard) and tilt, scroll to
 * zoom, double-click to reset. The wheel listener is non-passive so the page never scrolls.
 */
function useCameraInput(rig: RefObject<CameraRigState>) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let drag: { id: number; x: number; y: number } | null = null;
    // The control hint shows for a few seconds, and goes as soon as the camera is used.
    el.classList.add("show-hint");
    const hideHint = () => el.classList.remove("show-hint");
    const hintTimer = window.setTimeout(hideHint, 6000);
    const down = (e: PointerEvent) => {
      if (e.button !== 0 && e.button !== 2) return;
      hideHint();
      drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
    };
    const move = (e: PointerEvent) => {
      if (!drag || drag.id !== e.pointerId) return;
      const dx = e.clientX - drag.x,
        dy = e.clientY - drag.y;
      if (!el.classList.contains("is-dragging") && Math.hypot(dx, dy) < 4) return;
      if (!el.classList.contains("is-dragging")) el.setPointerCapture(e.pointerId);
      el.classList.add("is-dragging");
      dragRig(rig.current, dx, dy);
      drag.x = e.clientX;
      drag.y = e.clientY;
    };
    const up = (e: PointerEvent) => {
      if (drag?.id !== e.pointerId) return;
      drag = null;
      el.classList.remove("is-dragging");
    };
    const wheel = (e: WheelEvent) => {
      hideHint();
      const lines = e.deltaMode === 1 ? 33 : e.deltaMode === 2 ? 400 : 1;
      if (wheelRig(rig.current, e.deltaY * lines)) e.preventDefault();
    };
    const reset = () => resetView(rig.current);
    const menu = (e: MouseEvent) => e.preventDefault();
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    el.addEventListener("wheel", wheel, { passive: false });
    el.addEventListener("dblclick", reset);
    el.addEventListener("contextmenu", menu);
    return () => {
      window.clearTimeout(hintTimer);
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      el.removeEventListener("wheel", wheel);
      el.removeEventListener("dblclick", reset);
      el.removeEventListener("contextmenu", menu);
    };
  }, [rig]);
  return ref;
}

export default function DriverScene(props: DriverSceneProps) {
  const input = useCameraInput(props.rig);
  return (
    <div ref={input} className="sv-camera-input">
      <div className="sv-camera-hint" aria-hidden="true">
        <span className="for-mouse">Drag to orbit · Scroll to zoom · Double-click to reset</span>
        <span className="for-touch">Swipe sideways to orbit the camera</span>
      </div>
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
    </div>
  );
}
