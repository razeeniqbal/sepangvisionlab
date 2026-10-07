import {
  CanvasTexture,
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
    /** Front and rear wing colour; defaults to the accent. */
    readonly wing?: string;
  };
  /** Race number painted on top of the nose, and its colour. */
  readonly number?: string;
  readonly numberColor?: string;
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
uniform vec3 svlBody,svlSecondary,svlMechanical,svlRubber,svlAccent,svlTechnical,svlCompound,svlWing;
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
// Team-style zones: nose tip and engine-cover fin in the secondary colour, wings in the wing colour.
float svlFrontWing=svlBand(vSvlSurface.y,.87,1.01)*(1.0-step(.13,vSvlSurface.z));
float svlRearWing=(1.0-step(.11,vSvlSurface.y))*step(.42,vSvlSurface.z);
float svlNoseTip=svlBand(vSvlSurface.y,.955,1.01)*step(.13,vSvlSurface.z);
float svlFin=svlBand(vSvlSurface.y,.16,.5)*smoothstep(.62,.78,vSvlSurface.z)*(1.0-step(.05,svlAcross));
svlFinish=mix(svlFinish,svlSecondary,max(svlNoseTip,svlFin));
svlFinish=mix(svlFinish,svlWing,max(svlFrontWing,svlRearWing));
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
        svlWing: { value: new Color(definition.palette.wing ?? definition.palette.accent) },
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
    material.customProgramCacheKey = () => "svl-formula-v27-team";
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
// One small white-on-transparent texture per race number, shared by every car carrying it.
const numberTextures = new Map<string, CanvasTexture | null>();
export function numberTexture(number: string | undefined) {
  if (!number) return null;
  if (numberTextures.has(number)) return numberTextures.get(number)!;
  let texture: CanvasTexture | null = null;
  if (typeof document !== "undefined") {
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 64;
    const c = canvas.getContext("2d");
    if (c) {
      // Heavy glyphs that fill the texture, thickened with a stroke, so they survive mipmapping.
      c.fillStyle = c.strokeStyle = "#ffffff";
      c.lineWidth = 5;
      c.lineJoin = "round";
      c.font = "700 62px 'Barlow Condensed', 'Arial Narrow', Arial, sans-serif";
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.strokeText(number, 64, 35);
      c.fillText(number, 64, 35);
    }
    texture = new CanvasTexture(canvas);
  }
  numberTextures.set(number, texture);
  return texture;
}

/**
 * Team-style colour schemes for the 2026 grid: body, secondary panels, wings, centre stripe and
 * number colour, approximating each team's public colours. Colours only: no team, sponsor or
 * series logos or marks. Teams not listed fall back to teamLivery() from the OpenF1 colour.
 */
const TEAM_SCHEMES: Record<string, { body: string; secondary: string; wing: string; accent: string; number: string }> = {
  McLaren: { body: "#f47600", secondary: "#24272b", wing: "#24272b", accent: "#f47600", number: "#ffffff" },
  Ferrari: { body: "#d8102c", secondary: "#f2f2f0", wing: "#1c1c1e", accent: "#f2f2f0", number: "#ffffff" },
  "Red Bull Racing": { body: "#1d2a5c", secondary: "#d8202f", wing: "#1d2a5c", accent: "#f5c518", number: "#ffffff" },
  Mercedes: { body: "#1c1e21", secondary: "#c3c8cc", wing: "#1c1e21", accent: "#00d7b6", number: "#ffffff" },
  "Aston Martin": { body: "#0f5a45", secondary: "#229971", wing: "#0f5a45", accent: "#cedc00", number: "#ffffff" },
  Alpine: { body: "#0a6ed1", secondary: "#ff87bc", wing: "#1b1f2a", accent: "#ff87bc", number: "#ffffff" },
  Williams: { body: "#1868db", secondary: "#071f45", wing: "#071f45", accent: "#00a3e0", number: "#ffffff" },
  "Racing Bulls": { body: "#eef0f2", secondary: "#1634cc", wing: "#1634cc", accent: "#e8002d", number: "#1634cc" },
  "Haas F1 Team": { body: "#eeeeee", secondary: "#1d1d1f", wing: "#1d1d1f", accent: "#e6002b", number: "#1d1d1f" },
  Audi: { body: "#9aa0a6", secondary: "#141414", wing: "#141414", accent: "#f50537", number: "#ffffff" },
  Cadillac: { body: "#141414", secondary: "#e8e8e8", wing: "#141414", accent: "#909090", number: "#ffffff" },
};

const teamStyles = new Map<string, FormulaLiveryDefinition>();
/** The car's team-style livery with its race number; falls back to the single team colour. */
export function teamStyle(team: string | undefined, colour: string, number?: string): FormulaLiveryDefinition {
  const scheme = team ? TEAM_SCHEMES[team] : undefined;
  const base = teamLivery(colour);
  const id = (scheme ? "style-" + team : base.id) + (number ? "-" + number : "");
  const cached = teamStyles.get(id);
  if (cached) return cached;
  const definition: FormulaLiveryDefinition = Object.freeze({
    id,
    palette: Object.freeze(
      scheme
        ? {
            body: scheme.body,
            secondary: scheme.secondary,
            mechanical: "#2a2e31",
            rubber: base.palette.rubber,
            accent: scheme.accent,
            technical: scheme.accent,
            wing: scheme.wing,
          }
        : base.palette,
    ),
    surface: base.surface,
    number,
    numberColor: scheme?.number ?? "#ffffff",
  });
  teamStyles.set(id, definition);
  return definition;
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
