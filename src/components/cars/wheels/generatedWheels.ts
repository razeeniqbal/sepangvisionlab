import {
  BufferGeometry,
  CanvasTexture,
  CircleGeometry,
  Color,
  CylinderGeometry,
  Float32BufferAttribute,
  Group,
  LatheGeometry,
  AdditiveBlending,
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
  const face = (g: RingGeometry | CircleGeometry) => g.rotateX(side > 0 ? -Math.PI / 2 : Math.PI / 2);
  // Compound band: an arc pair with two small gaps, so the wheel's rotation stays visible.
  const band = [0, Math.PI].map((start) =>
    tinted(
      face(new RingGeometry(r * 0.79, r * 0.875, 24, 1, start + 0.12, Math.PI - 0.24)).translate(0, sidewall, 0),
      TYRE_COLOURS[compound],
    ),
  );
  const parts = [
    tinted(new LatheGeometry(profile, 40), "#121415"),
    // Near-black carbon wheel cover, set just inside the tyre face, and a thin metal rim lip.
    tinted(new CylinderGeometry(rim, rim, w * 0.86, 36, 1), "#0d1011"),
    tinted(
      face(new RingGeometry(rim * 0.95, rim * 1.01, 36)).translate(0, side * (w * 0.43 + 0.0004), 0),
      "#4e5558",
    ),
    // Small centre nut, flush with the cover (never past the tyre face).
    tinted(
      face(new CircleGeometry(rim * 0.17, 16)).translate(0, side * (w * 0.43 + 0.0007), 0),
      "#3a4043",
    ),
    ...(compound === "UNKNOWN" ? [] : band),
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
// Brake-disc glow seen through the wheel: a ring just inside the rim lip.
const glowRing = new RingGeometry(WHEEL_RADIUS * COVER * 0.36, WHEEL_RADIUS * COVER * 0.62, 28);

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
  // Per car: hot brake discs glow through the wheel (front and rear share one temperature).
  const glow = new MeshBasicMaterial({
    color: "#ff6a1a",
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: AdditiveBlending,
    toneMapped: false,
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
    const hot = new Mesh(glowRing, glow);
    hot.rotation.x = disc.rotation.x;
    hot.position.y = disc.position.y + hub.side * 0.0006;
    hot.renderOrder = 2;
    steer.add(hot);
    root.add(steer);
    return { id: hub.id, front: hub.front, steer, spin };
  });
  return { root, rigs, blur, glow };
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
