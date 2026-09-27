import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
function glb(name: string) {
  const raw = readFileSync(
    new URL("../public/assets/models/cars/" + name, import.meta.url),
  );
  const length = raw.readUInt32LE(12);
  return {
    raw,
    json: JSON.parse(raw.subarray(20, 20 + length).toString()),
    binary: raw.subarray(28 + length),
  };
}
test("Runtime GLB preserves every accessor byte and all scene transforms", () => {
  const source = glb("svl-formula-car-v1.glb"),
    runtime = glb("svl-formula-car-runtime-v1.glb");
  assert.equal(
    createHash("sha256").update(source.raw).digest("hex"),
    "7350a5feaa9aa6afcfa874b85c06f257bb57f1544fd5d75e3b8fe3dd9fe7ed3b",
  );
  assert.ok(runtime.raw.length < source.raw.length * 0.05);
  for (const key of ["images", "textures", "materials"])
    assert.equal(runtime.json[key], undefined);
  for (const key of ["nodes", "scenes", "scene"])
    assert.deepEqual(runtime.json[key], source.json[key]);
  assert.equal(runtime.json.accessors.length, source.json.accessors.length);
  for (let i = 0; i < source.json.accessors.length; i++) {
    const { bufferView: s, ...a } = source.json.accessors[i];
    const { bufferView: r, ...b } = runtime.json.accessors[i];
    assert.deepEqual(a, b);
    const sv = source.json.bufferViews[s],
      rv = runtime.json.bufferViews[r];
    assert.equal(sv.byteLength, rv.byteLength);
    assert.deepEqual(
      source.binary.subarray(
        sv.byteOffset ?? 0,
        (sv.byteOffset ?? 0) + sv.byteLength,
      ),
      runtime.binary.subarray(
        rv.byteOffset ?? 0,
        (rv.byteOffset ?? 0) + rv.byteLength,
      ),
    );
  }
  const expected = structuredClone(source.json.meshes);
  for (const mesh of expected)
    for (const primitive of mesh.primitives) delete primitive.material;
  assert.deepEqual(runtime.json.meshes, expected);
});
