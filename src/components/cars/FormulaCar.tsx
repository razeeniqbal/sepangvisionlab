import { resolveFormulaAsset, type FormulaPresentation } from "./formulaAssets";
import type { VisualTyreCompound } from "./carVisualState";
import {
  Matrix4,
  MeshStandardMaterial,
  PlaneGeometry,
  Quaternion,
  Raycaster,
  Vector3,
  type Object3D,
} from "three";
import {
  getFormulaMaterial,
  getFormulaMaterialFor,
  numberTexture,
  teamStyle,
  type FormulaLiveryId,
} from "./formulaLivery";
import { Component, Suspense, useMemo, type ReactNode } from "react";
import { useGLTF } from "@react-three/drei";
import { createFormulaVisual } from "./formulaVisual";
class ModelBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
// Race-number decal: a small plane laid on top of the nose. Its pose is found once per model by
// casting a ray straight down onto the nose (visual frame: +x nose, +y left, +z up).
const NOSE_X = 0.34;
const decalGeometry = new PlaneGeometry(0.078, 0.039);
const decalPoses = new WeakMap<Object3D, Matrix4 | null>();
function noseDecalPose(scene: Object3D, visual: Object3D) {
  if (decalPoses.has(scene)) return decalPoses.get(scene)!;
  visual.updateMatrixWorld(true);
  const ray = new Raycaster(new Vector3(NOSE_X, 0, 1), new Vector3(0, 0, -1));
  const hit = ray.intersectObject(visual, true)[0];
  let pose: Matrix4 | null = null;
  if (hit?.face) {
    const n = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
    if (n.z < 0) n.negate();
    // Glyph tops point to the nose, so the number reads from behind and above.
    const up = new Vector3(1, 0, 0).addScaledVector(n, -n.x).normalize();
    const across = up.clone().cross(n);
    pose = new Matrix4().makeBasis(across, up, n).setPosition(hit.point.addScaledVector(n, 0.0008));
  }
  decalPoses.set(scene, pose);
  return pose;
}
const decalMaterials = new Map<string, MeshStandardMaterial>();
function decalMaterial(number: string, colour: string) {
  const key = number + colour;
  let material = decalMaterials.get(key);
  if (!material) {
    material = new MeshStandardMaterial({
      map: numberTexture(number),
      color: colour,
      // Blended, not alpha-tested: seen from a distance the number covers a few pixels, and a
      // cutoff would discard the whole glyph once mipmapping thins it.
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      roughness: 0.4,
    });
    decalMaterials.set(key, material);
  }
  return material;
}

function LoadedFormula({
  livery,
  teamColor,
  team,
  number,
  compound,
  presentation,
}: {
  livery: FormulaLiveryId;
  teamColor?: string;
  team?: string;
  number?: string;
  compound: VisualTyreCompound;
  presentation: FormulaPresentation;
}) {
  const { scene } = useGLTF(resolveFormulaAsset(presentation).asset.url, false);
  const style = teamColor ? teamStyle(team, teamColor, number) : null;
  const visual = useMemo(
    () =>
      createFormulaVisual(
        scene,
        style ? getFormulaMaterialFor(style, compound) : getFormulaMaterial(livery, compound),
      ),
    [scene, livery, style, compound],
  );
  const decal = useMemo(() => {
    if (!number || !style || !numberTexture(number)) return null;
    const pose = noseDecalPose(scene, visual);
    if (!pose) return null;
    const position = new Vector3(),
      quaternion = new Quaternion(),
      scale = new Vector3();
    pose.decompose(position, quaternion, scale);
    return { position, quaternion, material: decalMaterial(number, style.numberColor ?? "#ffffff") };
  }, [scene, visual, number, style]);
  // Geometry belongs to useGLTF; materials belong to the livery cache, not drivers.
  return (
    <group>
      <primitive object={visual} dispose={null} />
      {decal && (
        <mesh
          geometry={decalGeometry}
          material={decal.material}
          position={decal.position}
          quaternion={decal.quaternion}
          renderOrder={2}
        />
      )}
    </group>
  );
}
export default function FormulaCar({
  fallback,
  livery = "svl-development",
  teamColor,
  team,
  number,
  compound = "UNKNOWN",
  presentation = "standard",
}: {
  fallback: ReactNode;
  livery?: FormulaLiveryId;
  /** Team colour livery (driver views); overrides `livery` when set. */
  teamColor?: string;
  /** Team name and race number for the team-style livery and nose number. */
  team?: string;
  number?: string;
  compound?: VisualTyreCompound;
  presentation?: FormulaPresentation;
}) {
  return (
    <ModelBoundary fallback={fallback}>
      <Suspense fallback={fallback}>
        <LoadedFormula
          livery={livery}
          teamColor={teamColor}
          team={team}
          number={number}
          compound={compound}
          presentation={presentation}
        />
      </Suspense>
    </ModelBoundary>
  );
}
