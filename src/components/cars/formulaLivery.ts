import {
  Color,
  DoubleSide,
  MeshPhysicalMaterial,
  Vector3,
  type Texture,
} from "three";
import {
  TYRE_COLOURS,
  visualTyreCompound,
  type VisualTyreCompound,
} from "./carVisualState.ts";

export interface FormulaLiveryDefinition {
  readonly id: string;
  readonly palette: {
    readonly body: string;
    readonly secondary: string;
    readonly mechanical: string;
    readonly rubber: string;
    readonly accent: string;
    readonly technical: string;
  };
  readonly surface: {
    readonly bodyRoughness: number;
    readonly carbonRoughness: number;
    readonly rubberRoughness: number;
    readonly bodyMetalness: number;
    readonly mechanicalMetalness: number;
  };
  // Optional authored body map, prepared/shared/owned by the profile's caller.
  // Use sRGB and flipY=false for glTF UVs. No texture is loaded by default.
  readonly liveryTexture?: Texture;
}
export const SVL_DEVELOPMENT: FormulaLiveryDefinition = Object.freeze({
  id: "svl-development",
  palette: Object.freeze({
    body: "#323a3c",
    secondary: "#293235",
    mechanical: "#202527",
    rubber: "#191b1c",
    accent: "#008e88",
    technical: "#b5bfbe",
  }),
  surface: Object.freeze({
    bodyRoughness: 0.62,
    carbonRoughness: 0.78,
    rubberRoughness: 0.96,
    bodyMetalness: 0.2,
    mechanicalMetalness: 0.3,
  }),
});
export type FormulaLiveryId = string;
const meshMin = new Vector3(-0.228814, -0.540606, -0.248286);
const meshSpan = new Vector3(0.442462, 1.142766, 0.248286);
const declarations = `
varying vec3 vSvlSurface;
varying float vSvlSideNormal;
uniform vec3 svlBody,svlSecondary,svlMechanical,svlRubber,svlAccent,svlTechnical,svlCompound;
uniform vec3 svlRoughness;
uniform vec2 svlMetalness;
uniform float svlHasCompound,svlHasLivery,svlHideWheels;
float svlBand(float value,float low,float high){return step(low,value)*(1.0-step(high,value));}
`;
const surface = `
float svlAcross=abs(vSvlSurface.x-.5);
float svlAxles=max(svlBand(vSvlSurface.y,.035,.235),svlBand(vSvlSurface.y,.665,.86));
float svlTyre=step(.27,svlAcross)*svlAxles;
float svlLow=1.0-smoothstep(.15,.27,vSvlSurface.z);
float svlStripe=(1.0-smoothstep(.022,.032,svlAcross))*svlBand(vSvlSurface.y,.62,.97)*step(.15,vSvlSurface.z);
float svlShoulder=smoothstep(.10,.24,svlAcross)*svlBand(vSvlSurface.y,.25,.60);
vec3 svlFinish=mix(svlBody,svlSecondary,svlShoulder);
svlFinish=mix(svlFinish,svlMechanical,svlLow);
svlFinish=mix(svlFinish,svlAccent,svlStripe);
// A small technical nose tick, not decorative lettering or a sponsor mark.
float svlTick=(1.0-step(.075,svlAcross))*svlBand(vSvlSurface.y,.925,.930)*step(.15,vSvlSurface.z);
svlFinish=mix(svlFinish,svlTechnical,svlTick);
svlFinish=mix(svlFinish,diffuseColor.rgb,svlHasLivery);
diffuseColor.rgb=mix(svlFinish,svlRubber,svlTyre);
// Asset-local sidewall calibration. No extra meshes, textures or draw calls.
float svlY=vSvlSurface.y*1.142766-.540606;
float svlZ=vSvlSurface.z*.248286;
float svlWheelY=svlY<0.0?-.375:.344;
float svlRadius=length(vec2(svlY-svlWheelY,svlZ-.0745));
float svlRing=(1.0-smoothstep(.0015,.0035,abs(svlRadius-.058)))*smoothstep(.65,.9,abs(vSvlSideNormal))*step(.40,svlAcross)*svlTyre*svlHasCompound;
diffuseColor.rgb=mix(diffuseColor.rgb,svlCompound,svlRing);
// Hide the model's own (static) wheels: the generated wheels steer and spin in their place.
float svlLateral=abs(vSvlSurface.x*.442462-.228814);
if(svlHideWheels>.5&&abs(svlLateral-.1921)<.0335&&length(vec2(svlY-svlWheelY,svlZ-.0745))<.0795)discard;
`;

// One finite cache per configured library: profiles × six compound states.
// Driver IDs, numbers and selection are intentionally not cache keys.
export function createFormulaMaterialLibrary(
  profiles: readonly FormulaLiveryDefinition[],
  fallbackId: string,
) {
  const definitions = new Map(profiles.map((p) => [p.id, p]));
  const fallback = definitions.get(fallbackId);
  if (!fallback || definitions.size !== profiles.length)
    throw new Error("Invalid livery library");
  const materials = new Map<string, MeshPhysicalMaterial>();
  function get(
    id: string = fallbackId,
    requested: VisualTyreCompound = "UNKNOWN",
  ) {
    return build(definitions.get(id) ?? fallback!, requested);
  }
  function build(
    definition: FormulaLiveryDefinition,
    requested: VisualTyreCompound,
  ) {
    const compound = visualTyreCompound(requested);
    const key = JSON.stringify([definition.id, compound]);
    const cached = materials.get(key);
    if (cached) return cached;
    // Physical paint: a clear coat over the bodywork reflects the sky like a real livery.
    // The coat is masked off tyres and the dark lower carbon in the shader below.
    const material = new MeshPhysicalMaterial({
      name: `SVL · ${definition.id} · ${compound}`,
      color: "#ffffff",
      map: definition.liveryTexture ?? null,
      roughness: definition.surface.bodyRoughness,
      metalness: definition.surface.bodyMetalness,
      clearcoat: 1,
      clearcoatRoughness: 0.08,
      side: DoubleSide,
    });
    material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, {
        svlMin: { value: meshMin },
        svlSpan: { value: meshSpan },
        svlBody: { value: new Color(definition.palette.body) },
        svlSecondary: { value: new Color(definition.palette.secondary) },
        svlMechanical: { value: new Color(definition.palette.mechanical) },
        svlRubber: { value: new Color(definition.palette.rubber) },
        svlAccent: { value: new Color(definition.palette.accent) },
        svlTechnical: { value: new Color(definition.palette.technical) },
        svlCompound: { value: new Color(TYRE_COLOURS[compound]) },
        svlHasCompound: { value: compound === "UNKNOWN" ? 0 : 1 },
        svlHasLivery: { value: definition.liveryTexture ? 1 : 0 },
        svlHideWheels: { value: 1 },
        svlRoughness: {
          value: new Vector3(
            definition.surface.bodyRoughness,
            definition.surface.carbonRoughness,
            definition.surface.rubberRoughness,
          ),
        },
        svlMetalness: {
          value: [
            definition.surface.bodyMetalness,
            definition.surface.mechanicalMetalness,
          ],
        },
      });
      shader.vertexShader = shader.vertexShader
        .replace(
          "#include <common>",
          "#include <common>\nvarying vec3 vSvlSurface; varying float vSvlSideNormal; uniform vec3 svlMin; uniform vec3 svlSpan;",
        )
        .replace(
          "#include <begin_vertex>",
          "#include <begin_vertex>\nvSvlSurface=vec3((position.x-svlMin.x)/svlSpan.x,(position.y-svlMin.y)/svlSpan.y,-position.z/svlSpan.z); vSvlSideNormal=normal.x;",
        );
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", "#include <common>\n" + declarations)
        .replace(
          "#include <color_fragment>",
          "#include <color_fragment>\n" + surface,
        )
        .replace(
          "#include <roughnessmap_fragment>",
          "#include <roughnessmap_fragment>\nroughnessFactor=mix(mix(svlRoughness.x,svlRoughness.y,svlLow),svlRoughness.z,svlTyre);",
        )
        .replace(
          "#include <metalnessmap_fragment>",
          "#include <metalnessmap_fragment>\nmetalnessFactor=mix(mix(svlMetalness.x,svlMetalness.y,svlLow),0.0,svlTyre);",
        )
        .replace(
          "#include <lights_physical_fragment>",
          "#include <lights_physical_fragment>\nmaterial.clearcoat*=(1.0-svlTyre)*(1.0-svlLow*0.85);",
        );
    };
    material.customProgramCacheKey = () => "svl-formula-v26-physical";
    materials.set(key, material);
    return material;
  }
  return {
    get,
    /** Material for a livery defined at runtime (team colours); cached by livery id. */
    getFor: (
      definition: FormulaLiveryDefinition,
      requested: VisualTyreCompound = "UNKNOWN",
    ) => build(definition, requested),
    get size() {
      return materials.size;
    },
    // Call only after all users unmount. Textures are borrowed, never disposed here.
    dispose() {
      materials.forEach((m) => m.dispose());
      materials.clear();
    },
  };
}
const library = createFormulaMaterialLibrary(
  [SVL_DEVELOPMENT],
  SVL_DEVELOPMENT.id,
);
export const getFormulaMaterial = library.get;
export const getFormulaMaterialFor = library.getFor;

const teamLiveries = new Map<string, FormulaLiveryDefinition>();
/**
 * Readable livery in a team colour: body in the colour, darker shoulders, a light
 * mechanical grey and a pale centre stripe. Material only; the GLB is not modified.
 */
export function teamLivery(colour: string): FormulaLiveryDefinition {
  const key = new Color(colour).getHexString();
  const cached = teamLiveries.get(key);
  if (cached) return cached;
  const body = new Color("#" + key);
  const hsl = { h: 0, s: 0, l: 0 };
  body.getHSL(hsl);
  // Lift very dark colours so they still read at TV distance under the scene lighting.
  if (hsl.l < 0.32) body.setHSL(hsl.h, hsl.s, 0.32);
  const definition: FormulaLiveryDefinition = Object.freeze({
    id: "team-" + key,
    palette: Object.freeze({
      body: "#" + body.getHexString(),
      secondary: "#" + body.clone().multiplyScalar(0.7).getHexString(),
      mechanical: "#3d4548",
      rubber: "#191b1c",
      accent: hsl.l > 0.75 ? "#1b2224" : "#eef1f0",
      technical: "#e3e7e6",
    }),
    surface: Object.freeze({
      bodyRoughness: 0.34,
      carbonRoughness: 0.55,
      rubberRoughness: 0.96,
      bodyMetalness: 0.25,
      mechanicalMetalness: 0.3,
    }),
  });
  teamLiveries.set(key, definition);
  return definition;
}
