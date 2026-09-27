// No hero asset is shipped. Explicit hero requests safely resolve to LOD1.
export type FormulaPresentation = "standard" | "hero";
export const FORMULA_ASSETS = Object.freeze({
  source: "/assets/models/cars/svl-formula-car-v1.glb",
  standard: Object.freeze({
    url: "/assets/models/cars/svl-formula-car-runtime-v1.glb",
    lod: "LOD1" as const,
    vertices: 30518,
    triangles: 40006,
    textures: 0,
    bytes: 1217688,
  }),
  hero: null,
});
export function resolveFormulaAsset(request: FormulaPresentation = "standard") {
  return {
    asset: FORMULA_ASSETS.standard,
    requested: request,
    resolved: "standard" as const,
    heroPending: request === "hero",
  };
}
