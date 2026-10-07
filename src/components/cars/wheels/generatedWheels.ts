import {
  BoxGeometry,
  BufferGeometry,
  CanvasTexture,
  CircleGeometry,
  Color,
  CylinderGeometry,
  Float32BufferAttribute,
  Group,
  LatheGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Quaternion,
  RingGeometry,
  Vector2,
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
  roughness: 0.78,
  metalness: 0.15,
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

/**
 * Wheel geometry for one side (sidewall details face outward), axle along y. Modelled on the
 * 18-inch era: a low-profile tyre with rounded shoulders, a dark wheel cover with a centre
 * nut, the compound stripe and two white sidewall marks so rotation reads at low speed.
 */
// Real rear tyres are about a third wider than the fronts (405 vs 305 mm); the rear grows
// outward from the derived hub so it never cuts into the floor or diffuser.
export const REAR_WIDTH = 1.3;

export function wheelGeometry(compound: VisualTyreCompound, side: 1 | -1, widthScale = 1) {
  const key = compound + side + ":" + widthScale;
  const cached = cache.get(key);
  if (cached) return cached;
  const r = WHEEL_RADIUS * COVER,
    w = WHEEL_WIDTH * COVER * widthScale,
    rim = r * 0.7;
  // Tyre cross-section revolved about the axle: bead, sidewall bulge, rounded shoulder, tread.
  const profile = [
    [rim, -0.46],
    [r * 0.86, -0.5],
    [r * 0.96, -0.47],
    [r * 0.995, -0.4],
    [r, -0.3],
    [r, 0.3],
    [r * 0.995, 0.4],
    [r * 0.96, 0.47],
    [r * 0.86, 0.5],
    [rim, 0.46],
  ].map(([radius, y]) => new Vector2(radius, y * w));
  const sidewall = side * (w * 0.5 + 0.0006);
  const parts = [
    tinted(new LatheGeometry(profile, 40), "#141617"),
    // Wheel cover, slightly dished, and the rim lip around it.
    tinted(new CylinderGeometry(rim, rim, w * 0.9, 36, 1), "#262b2e"),
    tinted(
      new RingGeometry(rim * 0.94, rim, 36)
        .rotateX(side > 0 ? -Math.PI / 2 : Math.PI / 2)
        .translate(0, side * (w * 0.45 + 0.0004), 0),
      "#8d9599",
    ),
    tinted(
      new CylinderGeometry(rim * 0.2, rim * 0.24, w * 0.16, 12, 1).translate(0, side * w * 0.5, 0),
      "#b9c0c2",
    ),
    // Compound stripe on the outer sidewall, like the real coloured tyre markings.
    tinted(
      new RingGeometry(r * 0.83, r * 0.875, 40)
        .rotateX(side > 0 ? -Math.PI / 2 : Math.PI / 2)
        .translate(0, sidewall, 0),
      TYRE_COLOURS[compound],
    ),
    // Two generic white sidewall marks (no lettering or brand).
    ...[0, Math.PI].map((angle) =>
      tinted(
        new BoxGeometry(r * 0.06, 0.0012, r * 0.03)
          .translate(r * 0.885, 0, 0)
          .rotateY(angle)
          .translate(0, sidewall, 0),
        "#e9ecea",
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
// Covers the wheel face only (inside the rim lip), never the tyre sidewall.
const blurDisc = new CircleGeometry(WHEEL_RADIUS * COVER * 0.69, 24);

/** Four generated wheels at the derived hubs: hub → steer → spin → mesh, plus a blur disc. */
export function createGeneratedWheels(compound: VisualTyreCompound) {
  const root = new Group();
  // Per car: its opacity follows that car's speed.
  const blur = new MeshBasicMaterial({
    color: "#2c3134",
    alphaMap: blurTexture(),
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const rigs: WheelRig[] = WHEEL_HUBS.map((hub) => {
    const steer = new Group(),
      spin = new Group();
    steer.position.set(...hub.position);
    const scale = hub.front ? 1 : REAR_WIDTH;
    const mesh = new Mesh(wheelGeometry(compound, hub.side, scale), material);
    // Wider rears grow outward only: shift the wheel by half the extra width.
    mesh.position.y = (hub.side * WHEEL_WIDTH * COVER * (scale - 1)) / 2;
    mesh.castShadow = false;
    spin.add(mesh);
    steer.add(spin);
    const disc = new Mesh(blurDisc, blur);
    disc.rotation.x = hub.side > 0 ? -Math.PI / 2 : Math.PI / 2;
    disc.position.y = hub.side * ((WHEEL_WIDTH * COVER * scale) / 2 + 0.0016) + mesh.position.y;
    disc.renderOrder = 1;
    steer.add(disc);
    root.add(steer);
    return { id: hub.id, front: hub.front, steer, spin };
  });
  return { root, rigs, blur };
}

/** Blur opacity for a road speed in m/s: none below ~55 km/h, full by ~200 km/h. */
export const wheelBlur = (speed: number) => Math.max(0, Math.min(0.75, (speed - 15) / 45));

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
