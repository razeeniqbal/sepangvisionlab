import test from "node:test";
import assert from "node:assert/strict";
import { ShaderLib, UniformsUtils, Texture, type WebGLRenderer } from "three";
import {
  createFormulaMaterialLibrary,
  SVL_DEVELOPMENT,
} from "../src/components/cars/formulaLivery.ts";
import {
  TYRE_COLOURS,
  visualTyreCompound,
  carIdentityText,
} from "../src/components/cars/carVisualState.ts";
import {
  FORMULA_ASSETS,
  resolveFormulaAsset,
} from "../src/components/cars/formulaAssets.ts";
const shader = () => ({
  vertexShader: ShaderLib.standard.vertexShader,
  fragmentShader: ShaderLib.standard.fragmentShader,
  uniforms: UniformsUtils.clone(ShaderLib.standard.uniforms),
});
test("Hero requests resolve to the existing standard asset without a second model", () => {
  const standard = resolveFormulaAsset(),
    hero = resolveFormulaAsset("hero");
  assert.equal(hero.asset, standard.asset);
  assert.equal(hero.asset.lod, "LOD1");
  assert.equal(hero.heroPending, true);
  assert.equal(standard.heroPending, false);
  assert.equal(FORMULA_ASSETS.hero, null);
  assert.equal(hero.asset.triangles, 40006);
});
test("Tyres accept all five visual compounds but unavailable historical data remains unknown", () => {
  for (const compound of ["SOFT", "MEDIUM", "HARD", "INTERMEDIATE", "WET"]) {
    assert.equal(visualTyreCompound(compound), compound);
    assert.equal(visualTyreCompound(compound, false), "UNKNOWN");
  }
  for (const value of [undefined, null, "", "UNCONFIRMED", "toString"]) {
    assert.equal(visualTyreCompound(value), "UNKNOWN");
  }
});
test("Livery cache is bounded by profiles and compounds, including unknown fallback", () => {
  const library = createFormulaMaterialLibrary(
    [SVL_DEVELOPMENT],
    SVL_DEVELOPMENT.id,
  );
  const soft = library.get("svl-development", "SOFT"),
    hard = library.get("svl-development", "HARD");
  assert.notEqual(soft, hard);
  assert.equal(soft, library.get("svl-development", "SOFT"));
  assert.equal(soft, library.get("missing-team", "SOFT"));
  for (const compound of Object.keys(TYRE_COLOURS))
    library.get("svl-development", visualTyreCompound(compound));
  for (let i = 0; i < 20; i++) library.get("unknown-team-" + i, "UNKNOWN");
  assert.equal(library.size, 6);
  const a = shader(),
    b = shader();
  soft.onBeforeCompile(a, {} as WebGLRenderer);
  hard.onBeforeCompile(b, {} as WebGLRenderer);
  assert.equal(a.uniforms.svlCompound.value.getHex(), Number("0x" + TYRE_COLOURS.SOFT.slice(1)));
  assert.equal(b.uniforms.svlCompound.value.getHex(), Number("0x" + TYRE_COLOURS.HARD.slice(1)));
  assert.equal(a.uniforms.svlCompound.value.getHex(), Number("0x" + TYRE_COLOURS.SOFT.slice(1)));
  assert.equal(soft.customProgramCacheKey(), hard.customProgramCacheKey());
  library.dispose();
  assert.equal(library.size, 0);
});
test("Compound accent is a masked shader sidewall treatment and unknown has no indicator", () => {
  const library = createFormulaMaterialLibrary(
    [SVL_DEVELOPMENT],
    SVL_DEVELOPMENT.id,
  );
  const unknown = shader(),
    wet = shader();
  library.get().onBeforeCompile(unknown, {} as WebGLRenderer);
  library.get(undefined, "WET").onBeforeCompile(wet, {} as WebGLRenderer);
  assert.equal(unknown.uniforms.svlHasCompound.value, 0);
  assert.equal(wet.uniforms.svlHasCompound.value, 1);
  assert.equal(wet.uniforms.svlCompound.value.getHex(), Number("0x" + TYRE_COLOURS.WET.slice(1)));
  assert.ok(wet.fragmentShader.includes("svlRing"));
  assert.ok(wet.fragmentShader.includes("svlTyre*svlHasCompound"));
  assert.ok(wet.vertexShader.includes("#include <begin_vertex>"));
  assert.equal(library.get(undefined, "WET").map, null);
  library.dispose();
});
test("Alternative profiles apply independent palette/surface parameters and borrow shared maps", () => {
  const texture = new Texture();
  let textureDisposed = 0;
  texture.addEventListener("dispose", () => textureDisposed++);
  const profile = {
    ...SVL_DEVELOPMENT,
    id: "research-test",
    palette: { ...SVL_DEVELOPMENT.palette, accent: "#556677" },
    surface: { ...SVL_DEVELOPMENT.surface, bodyRoughness: 0.8 },
    liveryTexture: texture,
  };
  const library = createFormulaMaterialLibrary(
    [SVL_DEVELOPMENT, profile],
    SVL_DEVELOPMENT.id,
  );
  const a = library.get(profile.id, "SOFT"),
    b = library.get(profile.id, "HARD");
  assert.equal(a.map, texture);
  assert.equal(b.map, texture);
  assert.equal(a.roughness, 0.8);
  const compiled = shader();
  a.onBeforeCompile(compiled, {} as WebGLRenderer);
  assert.equal(compiled.uniforms.svlAccent.value.getHex(), 0x556677);
  assert.equal(compiled.uniforms.svlHasLivery.value, 1);
  assert.equal(library.get().map, null);
  assert.equal(SVL_DEVELOPMENT.palette.accent, "#008e88");
  library.dispose();
  assert.equal(textureDisposed, 0);
  texture.dispose();
});
test("Number, short driver and team identity remain label data independent of assets", () => {
  assert.equal(
    carIdentityText({
      number: "88",
      driverId: "driver-88",
      shortDriverId: "DEV",
      teamId: "research",
    }),
    "88 · DEV · research",
  );
  assert.equal(carIdentityText({ number: "07", driverId: "car-07" }), "07");
});
