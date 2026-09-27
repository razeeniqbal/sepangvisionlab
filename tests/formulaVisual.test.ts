import { test } from "node:test";
import assert from "node:assert/strict";
import {
  Box3,
  BoxGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Vector3,
} from "three";
import {
  createFormulaVisual,
  FORMULA_VISUAL_LENGTH,
} from "../src/components/cars/formulaVisual.ts";
test("Formula visual maps nose and up axes, centers and grounds its visual bounds", () => {
  const source = new Group();
  source.add(new Mesh(new BoxGeometry(2, 1, 6), new MeshStandardMaterial()));
  source.position.set(0.3, 2, -1);
  const visual = createFormulaVisual(source);
  visual.updateMatrixWorld(true);
  const box = new Box3().setFromObject(visual),
    size = box.getSize(new Vector3()),
    center = box.getCenter(new Vector3());
  assert.ok(Math.abs(size.x - FORMULA_VISUAL_LENGTH) < 1e-8);
  assert.ok(Math.abs(box.min.z) < 1e-8);
  assert.ok(Math.abs(center.x) < 1e-8);
  assert.ok(Math.abs(center.y) < 1e-8);
  assert.ok(
    new Vector3(0, 0, 1)
      .applyQuaternion(visual.quaternion)
      .distanceTo(new Vector3(1, 0, 0)) < 1e-8,
  );
  assert.ok(
    new Vector3(0, 1, 0)
      .applyQuaternion(visual.quaternion)
      .distanceTo(new Vector3(0, 0, 1)) < 1e-8,
  );
  assert.deepEqual(source.position.toArray(), [0.3, 2, -1]);
});
test("Driver instances share geometry and material without sharing transforms", () => {
  const scene = new Group(),
    mesh = new Mesh(new BoxGeometry(2, 1, 6), new MeshStandardMaterial());
  scene.add(mesh);
  const a = createFormulaVisual(scene),
    b = createFormulaVisual(scene);
  const ma = a.children[0].children[0] as Mesh,
    mb = b.children[0].children[0] as Mesh;
  assert.notEqual(ma, mb);
  assert.equal(ma.geometry, mesh.geometry);
  assert.equal(ma.material, mb.material);
  a.position.x = 9;
  assert.notEqual(a.position.x, b.position.x);
  assert.equal(scene.position.x, 0);
});
test("Empty model rejects to allow the visual fallback", () => {
  assert.throws(() => createFormulaVisual(new Group()));
});
