import { MeshStandardMaterial } from "three";
function material(name: string, colour: string, roughness = 1) {
  return new MeshStandardMaterial({
    name,
    color: colour,
    roughness,
    metalness: 0,
  });
}
// Module-owned shared resources, no unique per-segment materials or downloaded textures.
export const foundationMaterials = {
  asphalt: material("Foundation asphalt", "#353c3d", 0.94),
  edge: material("Track edge paint", "#b6bbb0"),
  concrete: material("Generalized shoulder", "#686b62"),
  grass: material("Neutral flat grass foundation", "#37463b"),
  terrain: material("Foundation cut edge", "#292f29"),
  gravel: material("Illustrative gravel", "#777365"),
  barrier: material("Illustrative concrete barrier", "#868c85", 0.88),
  kerb: new MeshStandardMaterial({
    name: "Illustrative kerbs",
    vertexColors: true,
    roughness: 0.92,
  }),
};
// Subtle procedural grain, without image requests, displacement or extra geometry.
for (const key of ["asphalt", "gravel"] as const) {
  const m = foundationMaterials[key];
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying vec3 foundationPosition;",
      )
      .replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nfoundationPosition=position;",
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying vec3 foundationPosition;",
      )
      .replace(
        "#include <color_fragment>",
        "#include <color_fragment>\nfloat grain=fract(sin(dot(floor(foundationPosition.xy*700.0),vec2(12.9898,78.233)))*43758.5453); diffuseColor.rgb*=.96+.08*grain;",
      );
  };
  m.customProgramCacheKey = () => "svl-foundation-grain-v1";
}
