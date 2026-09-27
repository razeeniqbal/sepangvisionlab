import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BoxGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Texture,
  ShaderLib,
  UniformsUtils,
  type WebGLRenderer,
} from "three";
import { getFormulaMaterial } from "../src/components/cars/formulaLivery.ts";
import { createFormulaVisual } from "../src/components/cars/formulaVisual.ts";
test("Livery is cached across cars and carries no generated maps", () => {
  const a = getFormulaMaterial(),
    b = getFormulaMaterial("svl-development");
  assert.equal(a, b);
  assert.equal(a.map, null);
  assert.equal(a.normalMap, null);
  assert.equal(a.roughnessMap, null);
  assert.equal(a.metalnessMap, null);
  assert.equal(a.emissive.getHex(), 0);
});
test("Applying a shared finish does not mutate source materials, UVs or geometry", () => {
  const map = new Texture(),
    sourceMaterial = new MeshStandardMaterial({ map, color: "#ff0000" }),
    geometry = new BoxGeometry(2, 1, 6),
    scene = new Group();
  const mesh = new Mesh(geometry, sourceMaterial);
  scene.add(mesh);
  const before = Array.from(geometry.attributes.uv.array),
    a = createFormulaVisual(scene, getFormulaMaterial()),
    b = createFormulaVisual(scene, getFormulaMaterial());
  const am = a.children[0].children[0] as Mesh,
    bm = b.children[0].children[0] as Mesh;
  assert.equal(am.material, bm.material);
  assert.equal(am.geometry, geometry);
  assert.equal(mesh.material, sourceMaterial);
  assert.equal(sourceMaterial.map, map);
  assert.equal(sourceMaterial.color.getHex(), 0xff0000);
  assert.deepEqual(Array.from(geometry.attributes.uv.array), before);
  a.scale.setScalar(0.7);
  b.scale.setScalar(0.48);
  assert.equal(am.material, bm.material);
  assert.equal((am.material as MeshStandardMaterial).color.getHex(), 0xffffff);
});
test("Procedural finish patches the installed standard shader without position/UV changes", () => {
  const shader = {
    vertexShader: ShaderLib.standard.vertexShader,
    fragmentShader: ShaderLib.standard.fragmentShader,
    uniforms: UniformsUtils.clone(ShaderLib.standard.uniforms),
  };
  getFormulaMaterial().onBeforeCompile(shader, {} as WebGLRenderer);
  assert.ok(shader.vertexShader.includes("#include <begin_vertex>"));
  assert.ok(shader.vertexShader.includes("vSvlSurface=vec3"));
  assert.ok(shader.fragmentShader.includes("roughnessFactor=mix"));
  assert.ok(shader.fragmentShader.includes("metalnessFactor=mix"));
  assert.ok(shader.fragmentShader.includes("diffuseColor.rgb=mix"));
  assert.equal(shader.uniforms.svlAccent.value.getHex(), 0x008e88);
});
