import {
  BoxGeometry,
  BufferGeometry,
  CanvasTexture,
  CircleGeometry,
  Color,
  CylinderGeometry,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Quaternion,
  RingGeometry,
  Vector3,
  type Object3D,
} from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { TYRE_COLOURS, type VisualTyreCompound } from "../carVisualState";
import {
  COVER,
  WHEEL_HUBS,
  WHEEL_RADIUS,
  WHEEL_WIDTH,
  type WheelId,
} from "./wheelLayout";

// One merged, vertex-coloured mesh per wheel: one draw call each, shared per compound.
const material = new MeshStandardMaterial({
  vertexColors: true,
  roughness: 0.82,
  metalness: 0.12,
});
const cache = new Map<string, BufferGeometry>();

function tinted(geometry: BufferGeometry, colour: string) {
  const c = new Color(colour),
    count = geometry.getAttribute("position").count;
  const values = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) values.set([c.r, c.g, c.b], i * 3);
  geometry.setAttribute("color", new Float32BufferAttribute(values, 3));
  // Keep attribute sets identical so mergeGeometries accepts every part.
  geometry.deleteAttribute("uv");
  return geometry.index ? geometry.toNonIndexed() : geometry;
}

/** Wheel geometry for one side (sidewall details face outward), axle along y. */
export function wheelGeometry(compound: VisualTyreCompound, side: 1 | -1) {
  const key = compound + side;
  const cached = cache.get(key);
  if (cached) return cached;
  const r = WHEEL_RADIUS * COVER,
    w = WHEEL_WIDTH * COVER,
    face = side * (w / 2 + 0.0008);
  const parts = [
    tinted(new CylinderGeometry(r, r, w, 30, 1), "#17191a"),
    tinted(
      new CylinderGeometry(r * 0.62, r * 0.62, w * 1.01, 22, 1),
      "#3b4246",
    ),
    // Compound band on the outer sidewall, like the real coloured tyre markings.
    tinted(
      new RingGeometry(r * 0.7, r * 0.8, 30)
        .rotateX(side > 0 ? -Math.PI / 2 : Math.PI / 2)
        .translate(0, face, 0),
      TYRE_COLOURS[compound],
    ),
    ...[0, 1, 2].map((k) =>
      tinted(
        new BoxGeometry(r * 1.15, w * 0.12, r * 0.13)
          .rotateY((k * 2 * Math.PI) / 3)
          .translate(0, face, 0),
        "#aeb6b8",
      ),
    ),
  ];
  const geometry = mergeGeometries(parts)!;
  parts.forEach((p) => p.dispose());
  geometry.computeBoundingSphere();
  cache.set(key, geometry);
  return geometry;
}

export interface WheelRig {
  id: WheelId;
  front: boolean;
  steer: Object3D; // rotation.z steers
  spin: Object3D; // rotation.y rolls forward
}

// Motion blur over the rim: a soft grey disc that fades in with speed, as spokes smear on camera.
let blurMap: CanvasTexture | null = null;
function blurTexture() {
  if (blurMap || typeof document === "undefined") return blurMap;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  const c = canvas.getContext("2d");
  if (c) {
    const g = c.createRadialGradient(32, 32, 4, 32, 32, 32);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.7, "rgba(255,255,255,0.85)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    c.fillStyle = g;
    c.fillRect(0, 0, 64, 64);
  }
  return (blurMap = new CanvasTexture(canvas));
}
const blurDisc = new CircleGeometry(WHEEL_RADIUS * COVER * 0.86, 24);

/** Four generated wheels at the derived hubs: hub → steer → spin → mesh, plus a blur disc. */
export function createGeneratedWheels(compound: VisualTyreCompound) {
  const root = new Group();
  // Per car: its opacity follows that car's speed.
  const blur = new MeshBasicMaterial({
    color: "#4a5154",
    alphaMap: blurTexture(),
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const rigs: WheelRig[] = WHEEL_HUBS.map((hub) => {
    const steer = new Group(),
      spin = new Group();
    steer.position.set(...hub.position);
    const mesh = new Mesh(wheelGeometry(compound, hub.side), material);
    mesh.castShadow = false;
    spin.add(mesh);
    steer.add(spin);
    const disc = new Mesh(blurDisc, blur);
    disc.rotation.x = hub.side > 0 ? -Math.PI / 2 : Math.PI / 2;
    disc.position.y = hub.side * ((WHEEL_WIDTH * COVER) / 2 + 0.0016);
    disc.renderOrder = 1;
    steer.add(disc);
    root.add(steer);
    return { id: hub.id, front: hub.front, steer, spin };
  });
  return { root, rigs, blur };
}

/** Blur opacity for a road speed in m/s: none below ~55 km/h, full by ~200 km/h. */
export const wheelBlur = (speed: number) => Math.max(0, Math.min(0.92, (speed - 15) / 40));

const Z = new Vector3(0, 0, 1),
  Y = new Vector3(0, 1, 0);
const qSteer = new Quaternion(),
  qSpin = new Quaternion();

/**
 * Drive named wheel nodes in a future GLB (wheel: "model"). Assumes each node's local
 * frame matches the visual frame at rest (axle along y). Returns null if any node is missing.
 */
export function modelWheelDriver(model: Object3D) {
  const nodes = WHEEL_HUBS.map((hub) => ({
    hub,
    node: model.getObjectByName(hub.id),
  }));
  if (nodes.some((n) => !n.node)) return null;
  const base = nodes.map((n) => n.node!.quaternion.clone());
  return (steer: number, spin: number) =>
    nodes.forEach(({ hub, node }, i) => {
      qSteer.setFromAxisAngle(Z, hub.front ? steer : 0);
      qSpin.setFromAxisAngle(Y, spin);
      node!.quaternion.copy(base[i]).multiply(qSteer).multiply(qSpin);
    });
}
