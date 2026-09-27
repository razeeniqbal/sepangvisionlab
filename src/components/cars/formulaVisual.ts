import { FORMULA_ASSETS } from "./formulaAssets.ts";
import {
  Box3,
  Group,
  Vector3,
  Mesh,
  type Material,
  type Object3D,
} from "three";
export const FORMULA_MODEL_URL = FORMULA_ASSETS.standard.url;
export const FORMULA_VISUAL_LENGTH = 1.05;
// Imported +Z nose -> +X travel; imported +Y up -> +Z track normal.
export function createFormulaVisual(scene: Object3D, material?: Material) {
  const correction = new Group();
  correction.quaternion.set(0.5, 0.5, 0.5, 0.5);
  // Static asset: clone transforms, share BufferGeometry, Material and Texture.
  const instance = scene.clone(true);
  if (material)
    instance.traverse((object) => {
      if (object instanceof Mesh) object.material = material;
    });
  correction.add(instance);
  correction.updateMatrixWorld(true);
  const box = new Box3().setFromObject(correction),
    size = box.getSize(new Vector3());
  if (!Number.isFinite(size.x) || size.x <= 0)
    throw Error("Formula model has invalid bounds");
  const scale = FORMULA_VISUAL_LENGTH / size.x,
    center = box.getCenter(new Vector3());
  correction.scale.setScalar(scale);
  correction.position.set(
    -center.x * scale,
    -center.y * scale,
    -box.min.z * scale,
  );
  return correction;
}
