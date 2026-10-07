import { useLayoutEffect, useMemo, useRef } from "react";
import {
  BackSide,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  PMREMGenerator,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
} from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import pitLaneData from "../../../data/circuits/sepangPitLane.json";
import { PIT_LANE_HALF_WIDTH, pitOffsetAt, type PitLane } from "../../../domain/pitLane";
import type { TrackProfile } from "../../../domain/lapPhysics";
import { anchorInProfile } from "./anchors";
import { findCorners, poseAtDistance } from "../../../domain/lapPhysics";
import { tvPoints } from "../cameraRig";
import { QUALITY, type QualitySettings } from "../quality";
import {
  KERB_WIDTH,
  LAYER,
  LINE_WIDTH,
  RUNOFF_OUTER,
  TRACK_HALF_WIDTH,
  barrierOffset,
  cornerBoards,
  officialTurnBoards,
  gravelTraps,
  nearestSample,
  palmRows,
  treeClumps,
  type Palm,
  type Tree,
  besideTurn,
  fitBuilding,
  groundHeight,
  terrainHeight,
  gantryAt,
  kerbRuns,
  trackBearing,
  type Building,
  type Placement,
  type TurnBoard,
} from "./layout";
import {
  buildStrip,
  leftNormals,
  mergeStrips,
  type StripMesh,
  type StripSpec,
} from "./ribbon";
import {
  seatTexture,
  asphaltTexture,
  barrierTexture,
  chequerTexture,
  crowdTexture,
  fenceTexture,
  grassTexture,
  gravelTexture,
  chevronTexture,
  kerbTexture,
  turnBoardTexture,
} from "./textures";

/** DERIVED from where cars drove during the 2026 race pit stops (scripts/derive-pit-lane.ts). */
export const PIT_LANE = pitLaneData as PitLane;
/** Inner face of the pit wall, just outside the white edge line on the pit side. */
export const PIT_WALL_OFFSET = TRACK_HALF_WIDTH + 0.25;

/**
 * The point the camera is filming (the followed car), shared with the fence shader: fence mesh
 * along the sight line from the camera to it is cut away, like the camera holes cut in real
 * debris fences for broadcast cameras. DriverScene updates it every frame.
 */
export const fenceSightTarget = { value: new Vector3(0, 0, -1e6) };

// Terrain height under any point, from the DERIVED track elevation (flat without it).
const grounds = new WeakMap<TrackProfile, (x: number, y: number) => number>();
export function groundOf(track: TrackProfile) {
  let g = grounds.get(track);
  if (!g) grounds.set(track, (g = groundHeight(track)));
  return g;
}
/** Drape target for strips beside the road: the terrain surface, 0.3 m allowance for sag on slopes. */
function drapeOf(track: TrackProfile) {
  const t = terrainOf(track);
  return (x: number, y: number) => t(x, y) + 0.25 + 0.3;
}
// The terrain surface itself (lowered near other sections; see terrainHeight): free-standing
// things like trees stand on this, trackside things on their own road's level (groundOf).
const terrains = new WeakMap<TrackProfile, (x: number, y: number) => number>();
function terrainOf(track: TrackProfile) {
  let t = terrains.get(track);
  if (!t) terrains.set(track, (t = terrainHeight(track)));
  return t;
}

// Objects that block a camera's view of a car: used by TV camera picking and tag fading.
export const OCCLUDER = { occluder: true };
export const SKY = Object.freeze({
  haze: "#e9d6b8",
  wetHorizon: "#9aa6aa",
  wetZenith: "#5f6e78",
  wetFogNear: 160,
  wetFogFar: 1700,
  horizon: "#c9dade",
  zenith: "#4d84ad",
  fogNear: 450,
  fogFar: 3400,
});

function toGeometry(strip: StripMesh) {
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(strip.positions, 3));
  g.setAttribute("uv", new BufferAttribute(strip.uvs, 2));
  g.setIndex(new BufferAttribute(strip.indices, 1));
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

/**
 * Large-scale light and dark patches across grass (world space, ~40-150 m), so the 24 m
 * texture repeat does not read as a grid from the helicopter. Costs a few ALU ops per pixel.
 */
function withMacroVariation<T extends MeshStandardMaterial>(material: T): T {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec2 vSvlWorld;")
      .replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nvSvlWorld = (modelMatrix * vec4(transformed, 1.0)).xy;",
      );
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying vec2 vSvlWorld;")
      .replace(
        "#include <map_fragment>",
        "#include <map_fragment>\nvec2 q = vSvlWorld;" +
          "float m = sin(q.x * 0.043 + sin(q.y * 0.031)) * 0.5 + sin(q.y * 0.057 + q.x * 0.012) * 0.3 + sin((q.x + q.y) * 0.11) * 0.2;" +
          "diffuseColor.rgb *= 0.9 + 0.1 * m;",
      );
  };
  material.customProgramCacheKey = () => "svl-macro-grass";
  return material;
}

// Layered surfaces: polygonOffset pushes the lower layers back on 16-bit depth GPUs.
const lower = {
  polygonOffset: true,
  polygonOffsetFactor: 2,
  polygonOffsetUnits: 2,
};

export interface EnvironmentLayout {
  pit: Building;
  stand: Building;
  /** Covered K1 grandstand on the outside of T1 (null if the turn map is unavailable). */
  k1: Building | null;
  /** C2 hillstand, a grass bank over the T9-T11 complex (null if unavailable). */
  hill: Building | null;
  gantry: Placement;
  boards: Placement[];
  turns: TurnBoard[];
  apexes: number[];
  trees: Tree[];
  palms: Palm[];
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
}

export function useEnvironmentLayout(
  track: TrackProfile,
  coordinates: readonly (readonly number[])[],
): EnvironmentLayout {
  return useMemo(() => {
    const normals = leftNormals(track);
    const pitAnchor = anchorInProfile(track, coordinates, "pit-building");
    const standAnchor = anchorInProfile(track, coordinates, "main-grandstand");
    const finish = anchorInProfile(track, coordinates, "finish");
    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity;
    for (let i = 0; i < track.count; i++) {
      minX = Math.min(minX, track.x[i]);
      maxX = Math.max(maxX, track.x[i]);
      minY = Math.min(minY, track.y[i]);
      maxY = Math.max(maxY, track.y[i]);
    }
    // OFFICIAL (sepangcircuit.com/architecture): 33 pits, each 8 m wide and 24 m long.
    const pit = fitBuilding(
      track,
      { ...pitAnchor, heading: trackBearing(track, pitAnchor.x, pitAnchor.y) },
      PIT_GARAGES * PIT_GARAGE_WIDTH + 24,
      24,
    );
    // OFFICIAL "double frontage; east-west alignment": heading 0 (east).
    const stand = fitBuilding(track, { ...standAnchor, heading: 0 }, 320, 44, TRACK_HALF_WIDTH + 10);
    // Numbered T1-T15 when the detector matches the official layout; else unnumbered.
    const turns = officialTurnBoards(track, normals);
    const apexOf = (n: number) => turns.find((t) => t.turn === n)?.apex;
    const t1 = apexOf(1), t9 = apexOf(9), t11 = apexOf(11);
    // SOURCED: K1 grandstand at the end of the main straight facing T1-T2; C2 hillstand a grass
    // amphitheatre over T9-T11. Placement beside those turns is illustrative.
    const k1 = t1 === undefined ? null : besideTurn(track, normals, t1, 40, 150, 24);
    const hill =
      t9 === undefined || t11 === undefined
        ? null
        : besideTurn(track, normals, Math.round((t9 + t11) / 2), 42, 200, 55);
    const buildings = [pit, stand, ...(k1 ? [k1] : []), ...(hill ? [hill] : [])];
    return {
      pit,
      stand,
      k1,
      hill,
      gantry: gantryAt(track, finish.x, finish.y),
      turns,
      boards: turns.length ? turns : cornerBoards(track, normals),
      bounds: { minX, maxX, minY, maxY },
      apexes: turns.length ? turns.map((t) => t.apex) : findCorners(track),
      // Clumps keep clear of every trackside camera position, so TV shots stay open.
      trees: treeClumps(track, normals, { avoid: tvPoints(track, normals), buildings }),
      palms: palmRows(track, { buildings }),
    };
  }, [track, coordinates]);
}

function Surfaces({
  track,
  wetness,
  apexes,
}: {
  track: TrackProfile;
  wetness: number;
  apexes: readonly number[];
}) {
  const meshes = useMemo(() => {
    const normals = leftNormals(track);
    const strip = (spec: StripSpec) => buildStrip(track, normals, spec);
    const w = TRACK_HALF_WIDTH;
    const drape = drapeOf(track);
    const kerbs = kerbRuns(track).flatMap((run) => {
      const inner = run.side * w,
        ridge = run.side * (w + KERB_WIDTH * 0.55),
        outer = run.side * (w + KERB_WIDTH);
      const half = (a: number, za: number, b: number, zb: number) =>
        strip({
          edges:
            a < b
              ? [{ offset: a, z: za }, { offset: b, z: zb }]
              : [{ offset: b, z: zb }, { offset: a, z: za }],
          from: run.from,
          to: run.to,
          uLength: 6,
        });
      return [
        half(inner, LAYER.paint, ridge, LAYER.paint + 0.05),
        half(ridge, LAYER.paint + 0.05, outer, LAYER.paint + 0.02),
      ];
    });
    // Gravel traps outside the corner exits, from beyond the kerb to the run-off edge.
    const gravel = gravelTraps(track, apexes).map((run) => {
      const a = run.side * (w + KERB_WIDTH + 1),
        b = run.side * (RUNOFF_OUTER - 1);
      return strip({
        edges: [
          { offset: Math.min(a, b), z: LAYER.runoff + 0.02, drape },
          { offset: Math.max(a, b), z: LAYER.runoff + 0.02, drape },
        ],
        from: run.from,
        to: run.to,
        uLength: 8,
      });
    });
    const barriers = ([-1, 1] as const).map((side) =>
      strip({
        edges: [
          { offset: (i: number) => barrierOffset(track, i, side), z: 0, drape },
          { offset: (i: number) => barrierOffset(track, i, side), z: 1.1, drape },
        ],
      }),
    );
    return {
      asphalt: toGeometry(
        strip({
          edges: [
            { offset: -w, z: LAYER.asphalt },
            { offset: w, z: LAYER.asphalt },
          ],
        }),
      ),
      lines: toGeometry(
        mergeStrips([
          strip({
            edges: [
              { offset: -w, z: LAYER.paint },
              { offset: -w + LINE_WIDTH, z: LAYER.paint },
            ],
          }),
          strip({
            edges: [
              { offset: w - LINE_WIDTH, z: LAYER.paint },
              { offset: w, z: LAYER.paint },
            ],
          }),
        ]),
      ),
      runoff: toGeometry(
        mergeStrips([
          strip({
            edges: [
              { offset: -RUNOFF_OUTER, z: LAYER.runoff, drape },
              { offset: -w, z: LAYER.runoff },
            ],
          }),
          strip({
            edges: [
              { offset: w, z: LAYER.runoff },
              { offset: RUNOFF_OUTER, z: LAYER.runoff, drape },
            ],
          }),
        ]),
      ),
      kerbs: toGeometry(mergeStrips(kerbs)),
      gravel: toGeometry(mergeStrips(gravel)),
      barriers: toGeometry(mergeStrips(barriers)),
    };
  }, [track]);
  const materials = useMemo(() => {
    const asphalt = asphaltTexture();
    asphalt.repeat.set(1, 1.6);
    return {
      asphalt: new MeshStandardMaterial({ map: asphalt, roughness: 0.92 }),
      lines: new MeshStandardMaterial({ color: "#eef0ea", roughness: 0.7 }),
      runoff: withMacroVariation(new MeshStandardMaterial({
        map: (() => {
          const t = grassTexture();
          t.repeat.set(0.6, 1);
          return t;
        })(),
        color: "#c9d6b8",
        roughness: 1,
        ...lower,
      })),
      kerbs: new MeshStandardMaterial({ map: kerbTexture(), roughness: 0.6 }),
      barriers: new MeshStandardMaterial({
        map: barrierTexture(),
        roughness: 0.55,
        metalness: 0.25,
        side: DoubleSide,
      }),
    };
  }, []);
  // Wet track: darker, glossier asphalt (a reflective sheen, not simulated standing water).
  useLayoutEffect(() => {
    // Darker and glossier as the track gets wetter (a sheen, not simulated standing water).
    materials.asphalt.color.set("#ffffff").lerp(new Color("#7d8589"), wetness);
    materials.asphalt.roughness = 0.92 - 0.54 * wetness;
    materials.asphalt.metalness = 0.22 * wetness;
  }, [materials, wetness]);
  return (
    <>
      <mesh
        geometry={meshes.runoff}
        material={materials.runoff}
        receiveShadow
      />
      <mesh
        geometry={meshes.asphalt}
        material={materials.asphalt}
        receiveShadow
      />
      <mesh geometry={meshes.lines} material={materials.lines} receiveShadow />
      <mesh geometry={meshes.kerbs} material={materials.kerbs} receiveShadow />
      <mesh geometry={meshes.gravel} material={gravelMaterial} receiveShadow />
      <mesh geometry={meshes.barriers} material={materials.barriers} />
    </>
  );
}

const concrete = new MeshStandardMaterial({
  color: "#b9bdb7",
  roughness: 0.85,
});
const glass = new MeshStandardMaterial({
  color: "#2b3c44",
  roughness: 0.25,
  metalness: 0.4,
});
// Seat mosaic: generic coloured seats (canvas texture), not a sponsor or team pattern.
const seats = new MeshStandardMaterial({ map: seatTexture(), roughness: 0.8 });
const gravelMaterial = new MeshStandardMaterial({
  map: (() => {
    if (typeof document === "undefined") return null;
    const t = gravelTexture();
    t.repeat.set(1, 3);
    return t;
  })(),
  roughness: 1,
  polygonOffset: true,
  polygonOffsetFactor: 1,
  polygonOffsetUnits: 1,
});
const garageDoor = new MeshStandardMaterial({ color: "#1b2226", roughness: 0.7 });
// Generic garage bands: no source gives garage order, so no team is implied.
const GARAGE_BANDS = ["#8a9aa3", "#c9b37a", "#7aa38f", "#a3858a", "#7f8fb5", "#b0b8bc"].map(
  (c) => new MeshStandardMaterial({ color: c, roughness: 0.5 }),
);
const roof = new MeshStandardMaterial({
  color: "#eef0ec",
  roughness: 0.6,
  side: DoubleSide,
});
const steel = new MeshStandardMaterial({
  color: "#5b6466",
  roughness: 0.5,
  metalness: 0.5,
});

/** Which long side of a building faces the circuit: +1 for local +y, -1 for local -y. */
function facing(b: Building, track: TrackProfile) {
  const { index } = nearestSample(track, b.x, b.y);
  const c = Math.cos(-b.heading),
    s = Math.sin(-b.heading);
  return (track.x[index] - b.x) * s + (track.y[index] - b.y) * c > 0 ? 1 : -1;
}

/** OFFICIAL (sepangcircuit.com/architecture): 33 pit garages, each 8 m wide and 24 m long. */
export const PIT_GARAGES = 33;
export const PIT_GARAGE_WIDTH = 8;

/**
 * Pit building: 33 garages on the ground floor facing the pit lane, the paddock club behind
 * glass on the first floor, suites set back on the second, and a rooftop with a canopy over
 * the pit lane. The floor plan follows the SOURCED description; heights and finishes are
 * illustrative.
 */
function PitBuilding({ b, track }: { b: Building; track: TrackProfile }) {
  const face = facing(b, track);
  const bay = Math.min(PIT_GARAGE_WIDTH, (b.length - 8) / PIT_GARAGES);
  const start = (-bay * PIT_GARAGES) / 2;
  const front = face * (b.depth / 2);
  return (
    <group position={[b.x, b.y, groundOf(track)(b.x, b.y)]} rotation={[0, 0, b.heading]} userData={OCCLUDER}>
      <mesh material={concrete} position={[0, 0, 3.25]} castShadow receiveShadow>
        <boxGeometry args={[b.length, b.depth, 6.5]} />
      </mesh>
      {Array.from({ length: PIT_GARAGES }, (_, i) => {
        const x = start + bay * (i + 0.5);
        return (
          <group key={i} position={[x, front + face * 0.05, 0]}>
            <mesh material={garageDoor} position={[0, 0, 2.5]}>
              <boxGeometry args={[bay * 0.84, 0.2, 5]} />
            </mesh>
            <mesh material={GARAGE_BANDS[Math.floor(i / 2) % GARAGE_BANDS.length]} position={[0, 0, 5.6]}>
              <boxGeometry args={[bay * 0.92, 0.3, 0.8]} />
            </mesh>
          </group>
        );
      })}
      {/* Floor slabs read as white bands between the storeys. */}
      {[6.5, 10.7].map((z) => (
        <mesh key={z} material={roof} position={[0, face * 0.6, z]}>
          <boxGeometry args={[b.length * 1.005, b.depth + 1.2, 0.5]} />
        </mesh>
      ))}
      <mesh material={glass} position={[0, face * 0.4, 8.6]}>
        <boxGeometry args={[b.length * 0.99, b.depth * 0.96, 3.8]} />
      </mesh>
      <mesh material={glass} position={[0, -face * b.depth * 0.08, 12.6]}>
        <boxGeometry args={[b.length * 0.97, b.depth * 0.8, 3.4]} />
      </mesh>
      {/* Rooftop with a canopy reaching out over the pit lane. */}
      <mesh material={roof} position={[0, face * 2.5, 14.6]} castShadow>
        <boxGeometry args={[b.length * 1.02, b.depth + 5, 0.6]} />
      </mesh>
      <mesh material={steel} position={[0, front + face * 4.9, 15.4]}>
        <boxGeometry args={[b.length * 1.02, 0.12, 1]} />
      </mesh>
      {/* Taller end blocks (stairs and services). */}
      {[-1, 1].map((end) => (
        <mesh key={end} material={concrete} position={[end * (b.length / 2 - 5), 0, 8.5]} castShadow>
          <boxGeometry args={[10, b.depth * 1.02, 17]} />
        </mesh>
      ))}
    </group>
  );
}

/**
 * One petal of the main grandstand roof: a white shell, highest along the spine and falling to
 * both frontages, pointed at both ends. The real roof is described as hibiscus-inspired
 * "umbrella shade"; this shape is illustrative, not a survey of it.
 */
function petalGeometry(length: number, width: number, base: number, rise: number) {
  const nA = 20,
    nC = 14;
  const positions: number[] = [];
  const index: number[] = [];
  for (let i = 0; i <= nA; i++) {
    const a = i / nA,
      petal = Math.pow(Math.sin(Math.PI * a), 0.6);
    for (let j = 0; j <= nC; j++) {
      const c = -1 + (2 * j) / nC;
      positions.push(
        (a - 0.5) * length,
        c * (width / 2) * (0.3 + 0.7 * petal),
        base + rise * petal * (1 - 0.6 * c * c) - 1.2 * (1 - petal),
      );
      if (i && j) {
        const k = i * (nC + 1) + j;
        index.push(k - nC - 2, k - 1, k, k - nC - 2, k, k - nC - 1);
      }
    }
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}

/**
 * Main grandstand, double-fronted (OFFICIAL): stepped seating with spectators rising from each
 * straight to a central concourse, under a row of white petal-shaped canopies on masts.
 */
function Grandstand({ b, track }: { b: Building; track: TrackProfile }) {
  const rows = 10,
    half = b.depth / 2,
    rowDepth = (half - 3) / rows,
    count = Math.max(3, Math.round(b.length / 46)),
    petalLength = (b.length / count) * 1.22;
  const petal = useMemo(() => petalGeometry(petalLength, b.depth * 1.15, 21, 6), [petalLength, b.depth]);
  return (
    <group position={[b.x, b.y, groundOf(track)(b.x, b.y)]} rotation={[0, 0, b.heading]} userData={OCCLUDER}>
      {[-1, 1].flatMap((side) =>
        Array.from({ length: rows }, (_, r) => (
          <mesh
            key={side + ":" + r}
            material={seats}
            position={[0, side * (half - (r + 0.5) * rowDepth), (1.2 + r * 0.95) / 2]}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[b.length, rowDepth, 1.2 + r * 0.95]} />
          </mesh>
        )),
      )}
      <mesh material={concrete} position={[0, 0, (1.2 + rows * 0.95) / 2]} receiveShadow>
        <boxGeometry args={[b.length, 6, 1.2 + rows * 0.95]} />
      </mesh>
      {Array.from({ length: count }, (_, i) => {
        const x = -b.length / 2 + (b.length / count) * (i + 0.5);
        return (
          <group key={i} position={[x, 0, 0]}>
            <mesh geometry={petal} material={roof} castShadow receiveShadow />
            <mesh material={steel} position={[0, 0, 13]}>
              <cylinderGeometry args={[0.7, 1.1, 26, 10]} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

/**
 * Covered K1 grandstand at the end of the main straight (SOURCED: faces T1-T2). Rows rise away
 * from the track under a cantilevered roof on rear columns; size and finish are illustrative.
 */
function CoveredStand({ b, track }: { b: Building; track: TrackProfile }) {
  const face = facing(b, track);
  const rows = 12,
    rowDepth = (b.depth - 4) / rows,
    top = 1 + rows * 0.8;
  return (
    <group position={[b.x, b.y, groundOf(track)(b.x, b.y)]} rotation={[0, 0, b.heading]} userData={OCCLUDER}>
      {Array.from({ length: rows }, (_, r) => (
        <mesh
          key={r}
          material={seats}
          position={[0, face * (b.depth / 2 - 2 - (r + 0.5) * rowDepth), (1 + r * 0.8) / 2]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[b.length, rowDepth, 1 + r * 0.8]} />
        </mesh>
      ))}
      <mesh material={roof} position={[0, -face * 1, top + 6]} rotation={[face * 0.12, 0, 0]} castShadow>
        <boxGeometry args={[b.length * 1.02, b.depth + 2, 0.4]} />
      </mesh>
      {Array.from({ length: Math.round(b.length / 18) + 1 }, (_, i) => (
        <mesh key={i} material={steel} position={[-b.length / 2 + i * 18, -face * (b.depth / 2 - 0.5), (top + 6) / 2]}>
          <boxGeometry args={[0.6, 0.6, top + 6]} />
        </mesh>
      ))}
    </group>
  );
}

/**
 * C2 hillstand (SOURCED: a natural grass amphitheatre over T9-T11, partly covered). A grass
 * bank rising away from the track with spectators on its face and a canopy over one end.
 */
function Hillstand({ b, track }: { b: Building; track: TrackProfile }) {
  const face = facing(b, track);
  const parts = useMemo(() => {
    const L = b.length / 2,
      D = b.depth / 2,
      low = 0.4,
      high = 13;
    // Front edge low by the track, back edge high; ends taper down to the ground.
    const yf = face * D,
      yb = -face * D;
    const p = [
      [-L, yf, low], [L, yf, low], [L * 0.8, yb, high], [-L * 0.8, yb, high],
      [-L, yb, 0], [L, yb, 0],
    ];
    const tris = [[0, 1, 2], [0, 2, 3], [0, 3, 4], [1, 5, 2], [3, 2, 5], [3, 5, 4]];
    const positions = tris.flatMap((t) => t.flatMap((k) => p[k]));
    const ground = new BufferGeometry();
    ground.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
    ground.computeVertexNormals();
    const slope = Math.atan2(high - low, b.depth);
    const crowd = crowdTexture();
    crowd.repeat.set(6, 2.5);
    return {
      ground,
      slope,
      crowdLength: b.length * 0.62,
      crowdDepth: Math.hypot(high - low, b.depth) * 0.8,
      mid: (low + high) / 2,
      grass: new MeshStandardMaterial({ map: grassTexture(), color: "#c8d6b0", roughness: 1, side: DoubleSide }),
      people: new MeshStandardMaterial({ map: crowd, transparent: true, alphaTest: 0.3, roughness: 0.9 }),
    };
  }, [b, face]);
  return (
    <group position={[b.x, b.y, groundOf(track)(b.x, b.y)]} rotation={[0, 0, b.heading]} userData={OCCLUDER}>
      <mesh geometry={parts.ground} material={parts.grass} castShadow receiveShadow />
      <mesh
        material={parts.people}
        position={[0, 0, parts.mid + 0.35]}
        rotation={[-face * parts.slope, 0, 0]}
      >
        <planeGeometry args={[parts.crowdLength, parts.crowdDepth]} />
      </mesh>
      {/* The covered section. */}
      <mesh material={roof} position={[b.length * 0.28, 0, 17]} castShadow>
        <boxGeometry args={[b.length * 0.3, b.depth * 0.7, 0.4]} />
      </mesh>
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sy) => (
          <mesh key={sx + ":" + sy} material={steel} position={[b.length * 0.28 + sx * b.length * 0.13, sy * b.depth * 0.3, 8.5]}>
            <boxGeometry args={[0.5, 0.5, 17]} />
          </mesh>
        )),
      )}
    </group>
  );
}

function Gantry({ p, track }: { p: Placement; track: TrackProfile }) {
  const span = PIT_WALL_OFFSET + 0.25;
  return (
    <group
      position={[p.x, p.y, groundOf(track)(p.x, p.y)]}
      rotation={[0, 0, p.heading]}
      userData={OCCLUDER}
    >
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          material={steel}
          position={[0, side * span, 4]}
          castShadow
        >
          <boxGeometry args={[0.8, 0.8, 8]} />
        </mesh>
      ))}
      <mesh material={steel} position={[0, 0, 8.4]} castShadow>
        <boxGeometry args={[1.2, span * 2 + 0.8, 1.4]} />
      </mesh>
      <mesh position={[-0.65, 0, 8.4]}>
        <boxGeometry args={[0.1, 6, 0.9]} />
        <meshBasicMaterial color="#00a19c" />
      </mesh>
    </group>
  );
}

function Instanced({
  geometry,
  material,
  matrices,
  castShadow = false,
  occluder = false,
}: {
  geometry: BufferGeometry;
  material: MeshStandardMaterial;
  matrices: Matrix4[];
  castShadow?: boolean;
  /** Counts for camera and tag line-of-sight tests. Off for palms: raycasting thousands of
   * instances cost ~4-6 ms a frame, and the plantation stands 90 m or more from the road. */
  occluder?: boolean;
}) {
  const ref = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [matrices]);
  return (
    <instancedMesh
      ref={ref}
      args={[geometry, material, matrices.length]}
      castShadow={castShadow}
      frustumCulled={false}
      userData={occluder ? OCCLUDER : undefined}
    />
  );
}

// Each turn board carries its own number texture (15 small canvases, two draws each).
function TurnBoards({
  turns,
  track,
}: {
  turns: TurnBoard[];
  track: TrackProfile;
}) {
  const boards = useMemo(
    () =>
      turns.map((t) => ({
        ...t,
        // Front only: from behind, a board shows its plain back, not mirrored numbers.
        material: new MeshStandardMaterial({
          map: turnBoardTexture(t.turn, track.curvature[t.apex] > 0),
          roughness: 0.6,
        }),
      })),
    [turns, track],
  );
  return (
    <group userData={OCCLUDER}>
      {boards.map((b) => (
        <group
          key={b.turn}
          position={[b.x, b.y, groundOf(track)(b.x, b.y)]}
          rotation={[0, 0, b.heading]}
        >
          <mesh material={steel} position={[0, 0, 1.4]}>
            <boxGeometry args={[0.2, 0.2, 2.8]} />
          </mesh>
          {/* Faces oncoming cars: the plane normal runs along the track tangent. */}
          <mesh
            material={b.material}
            position={[0, 0, 3.6]}
            rotation={[Math.PI / 2, -Math.PI / 2, 0]}
          >
            <planeGeometry args={[2.4, 3]} />
          </mesh>
          <mesh material={steel} position={[-0.02, 0, 3.6]} rotation={[Math.PI / 2, Math.PI / 2, 0]}>
            <planeGeometry args={[2.4, 3]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function CornerBoards({ boards, track }: { boards: Placement[]; track: TrackProfile }) {
  const parts = useMemo(() => {
    // Face oncoming cars: the board normal runs along the track tangent.
    const board = new PlaneGeometry(2.4, 2.4)
      .rotateX(Math.PI / 2)
      .rotateZ(Math.PI / 2);
    const post = new BoxGeometry(0.2, 0.2, 2.2).translate(0, 0, 1.1);
    const o = new Object3D();
    const at = (p: Placement, z: number, face: number) => {
      o.position.set(p.x, p.y, z + groundOf(track)(p.x, p.y));
      o.rotation.set(0, 0, p.heading + face);
      o.updateMatrix();
      return o.matrix.clone();
    };
    return {
      board,
      post,
      boardMatrices: boards.map((p) => at(p, 2.2 + 1.2, 0)),
      postMatrices: boards.map((p) => at(p, 0, 0)),
      boardMaterial: new MeshStandardMaterial({
        map: chevronTexture(),
        side: DoubleSide,
        roughness: 0.6,
      }),
    };
  }, [boards, track]);
  return (
    <>
      <Instanced
        occluder
        geometry={parts.board}
        material={parts.boardMaterial}
        matrices={parts.boardMatrices}
      />
      <Instanced
        occluder
        geometry={parts.post}
        material={steel}
        matrices={parts.postMatrices}
      />
    </>
  );
}

function Palms({ palms: all, count, track }: { palms: readonly Palm[]; count: number; track: TrackProfile }) {
  const parts = useMemo(() => {
    const palms = all.slice(0, count);
    const trunk = new CylinderGeometry(0.24, 0.42, 9, 7)
      .rotateX(Math.PI / 2)
      .translate(0, 0, 4.5);
    const crown = palmCrown();
    const o = new Object3D();
    const matrices = palms.map((p) => {
      o.position.set(p.x, p.y, terrainOf(track)(p.x, p.y) - 0.1);
      o.rotation.set(0, 0, p.rotation);
      o.scale.setScalar(p.scale);
      o.updateMatrix();
      return o.matrix.clone();
    });
    return {
      trunk,
      crown,
      matrices,
      bark: new MeshStandardMaterial({ color: "#6b5a45", roughness: 1 }),
      leaves: new MeshStandardMaterial({
        color: "#ffffff",
        roughness: 0.85,
        side: DoubleSide,
      }),
      // Each palm a slightly different green, so the plantation does not read as one stamp.
      colours: palms.map((p) => {
        const k = (Math.sin(p.x * 12.9898 + p.y * 78.233) * 43758.5453) % 1;
        return new Color().setHSL(0.27 + Math.abs(k) * 0.05, 0.45, 0.2 + Math.abs(k) * 0.08);
      }),
    };
  }, [all, count, track]);
  const crowns = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = crowns.current;
    if (!mesh) return;
    parts.matrices.forEach((m, i) => {
      mesh.setMatrixAt(i, m);
      mesh.setColorAt(i, parts.colours[i]);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [parts]);
  return (
    <>
      <Instanced
        geometry={parts.trunk}
        material={parts.bark}
        matrices={parts.matrices}
      />
      <instancedMesh
        ref={crowns}
        args={[parts.crown, parts.leaves, parts.matrices.length]}
        frustumCulled={false}
      />
    </>
  );
}

/**
 * Oil palm crown: 12 fronds arching out and drooping from the top of a 9 m trunk, each a
 * tapered strip. One merged geometry (about 200 triangles) shared by every instance.
 */
function palmCrown() {
  const fronds: BufferGeometry[] = [];
  const segments = 5,
    length = 4.6;
  for (let f = 0; f < 12; f++) {
    const yaw = (f / 12) * Math.PI * 2 + (f % 2) * 0.2;
    const rise = f % 2 ? 0.55 : 0.25; // upper and lower ring of fronds
    const positions: number[] = [];
    const index: number[] = [];
    for (let k = 0; k <= segments; k++) {
      const t = k / segments;
      const r = t * length;
      const z = 9 + rise * 2 * t - 2.6 * t * t; // arch up, then droop
      const half = 0.55 * Math.sin(Math.PI * Math.min(1, t * 1.15)) + 0.04;
      const cx = Math.cos(yaw) * r,
        cy = Math.sin(yaw) * r;
      const px = -Math.sin(yaw) * half,
        py = Math.cos(yaw) * half;
      positions.push(cx + px, cy + py, z - 0.12 * t, cx - px, cy - py, z - 0.12 * t);
      if (k)
        index.push((k - 1) * 2, (k - 1) * 2 + 1, k * 2, (k - 1) * 2 + 1, k * 2 + 1, k * 2);
    }
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
    g.setIndex(index);
    g.computeVertexNormals();
    fronds.push(g);
  }
  const merged = mergeGeometries(fronds)!;
  fronds.forEach((g) => g.dispose());
  return merged;
}

/** Lumpy broadleaf crown: three overlapping, gently displaced spheres (smooth shaded). */
function broadleafCrown() {
  const lumps = [
    [0, 0, 6.2, 3.4],
    [1.6, 0.8, 5.6, 2.6],
    [-1.3, -1, 5.8, 2.5],
  ].map(([x, y, z, r], n) => {
    const g = new IcosahedronGeometry(r, 1);
    const pos = g.getAttribute("position") as BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i), vy = pos.getY(i), vz = pos.getZ(i);
      const k = 1 + 0.12 * Math.sin(vx * 2.1 + n) * Math.cos(vy * 1.7 + vz * 1.3);
      pos.setXYZ(i, vx * k, vy * k, vz * k * 0.85);
    }
    g.deleteAttribute("uv");
    const out = g.translate(x, y, z);
    out.computeVertexNormals();
    return out;
  });
  const merged = mergeGeometries(lumps)!;
  lumps.forEach((g) => g.dispose());
  return merged;
}

// Low-poly broadleaf trees: chunky crowns in a few greens (one draw call for crowns).
function TreeClumps({ trees, track }: { trees: readonly Tree[]; track: TrackProfile }) {
  const parts = useMemo(() => {
    const trunk = new CylinderGeometry(0.35, 0.5, 4, 5).rotateX(Math.PI / 2).translate(0, 0, 2);
    const crown = broadleafCrown();
    const o = new Object3D();
    const matrices = trees.map((t) => {
      o.position.set(t.x, t.y, terrainOf(track)(t.x, t.y) - 0.1);
      o.rotation.set(0, 0, t.rotation);
      o.scale.setScalar(t.scale);
      o.updateMatrix();
      return o.matrix.clone();
    });
    const greens = ["#3f6b34", "#4c7a3a", "#36602f", "#58864a"].map((g) => new Color(g));
    return {
      trunk, crown, matrices,
      colours: trees.map((t) => greens[Math.floor(t.shade * greens.length) % greens.length]),
      bark: new MeshStandardMaterial({ color: "#5d4a38", roughness: 1 }),
      leaves: new MeshStandardMaterial({ roughness: 0.9 }),
    };
  }, [trees, track]);
  const crowns = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = crowns.current;
    if (!mesh) return;
    parts.matrices.forEach((m, i) => {
      mesh.setMatrixAt(i, m);
      mesh.setColorAt(i, parts.colours[i]);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [parts]);
  return (
    <>
      <Instanced geometry={parts.trunk} material={parts.bark} matrices={parts.matrices} />
      <instancedMesh
        ref={crowns}
        args={[parts.crown, parts.leaves, parts.matrices.length]}
        frustumCulled={false}
        userData={OCCLUDER}
      />
    </>
  );
}

// Sun direction matches the directional light's offset in DriverScene (-140, -220, 320).
const SUN_DIRECTION = new Vector3(-140, -220, 320).normalize();

function Sky({ wet, sunDisc }: { wet: boolean; sunDisc: boolean }) {
  const material = useMemo(
    () =>
      new ShaderMaterial({
        side: BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {
          horizon: { value: new Color(SKY.horizon) },
          zenith: { value: new Color(SKY.zenith) },
          haze: { value: new Color(SKY.haze) },
          sunDir: { value: SUN_DIRECTION },
          sunOn: { value: 1 },
        },
        vertexShader:
          "varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
        fragmentShader:
          "uniform vec3 horizon; uniform vec3 zenith; uniform vec3 haze; uniform vec3 sunDir; uniform float sunOn; varying vec3 vDir;" +
          "void main(){ float h = clamp(vDir.z, 0.0, 1.0); vec3 sky = mix(horizon, zenith, pow(h, 0.6));" +
          // Warm haze low on the horizon, strongest towards the sun.
          "float toward = max(dot(normalize(vec3(vDir.xy, 0.0)), normalize(vec3(sunDir.xy, 0.0))), 0.0);" +
          "sky = mix(sky, haze, (1.0 - smoothstep(0.0, 0.22, h)) * (0.35 + 0.4 * toward) * sunOn);" +
          // Sun disc with a soft glow.
          "float d = dot(normalize(vDir), sunDir); sky += sunOn * (smoothstep(0.9992, 0.9996, d) * vec3(1.0, 0.96, 0.86) + pow(max(d, 0.0), 180.0) * vec3(0.35, 0.3, 0.22));" +
          "gl_FragColor = vec4(sky, 1.0); }",
      }),
    [],
  );
  const geometry = useMemo(
    () => new SphereGeometry(6000, 24, 12).rotateX(Math.PI / 2),
    [],
  );
  const sky = useRef<Mesh>(null);
  const { gl, scene } = useThree();
  useLayoutEffect(() => {
    material.uniforms.horizon.value.set(wet ? SKY.wetHorizon : SKY.horizon);
    material.uniforms.zenith.value.set(wet ? SKY.wetZenith : SKY.zenith);
    material.uniforms.sunOn.value = !wet && sunDisc ? 1 : 0;
    // Image-based light from this same sky, prefiltered once: paint, glass and wet asphalt
    // reflect the real sky and the shadowed sides of everything pick up its soft fill.
    const probe = new Scene();
    const dome = new Mesh(new SphereGeometry(100, 32, 16).rotateX(Math.PI / 2), material);
    probe.add(dome);
    // A sunlit ground below the horizon so reflections are not black underneath.
    const ground = new Mesh(
      new PlaneGeometry(400, 400),
      new MeshStandardMaterial({ color: wet ? "#3a4038" : "#55663f", emissive: wet ? "#2a2f2b" : "#4a5a36", emissiveIntensity: 0.6 }),
    );
    ground.position.z = -2;
    probe.add(ground);
    material.uniforms.sunOn.value = !wet ? 1 : 0;
    const pmrem = new PMREMGenerator(gl);
    const target = pmrem.fromScene(probe, 0.02, 0.1, 500);
    material.uniforms.sunOn.value = !wet && sunDisc ? 1 : 0;
    scene.environment = target.texture;
    scene.environmentIntensity = wet ? 0.55 : 0.75;
    pmrem.dispose();
    dome.geometry.dispose();
    ground.geometry.dispose();
    (ground.material as MeshStandardMaterial).dispose();
    return () => {
      if (scene.environment === target.texture) scene.environment = null;
      target.dispose();
    };
  }, [material, wet, sunDisc, gl, scene]);
  // The sky follows the camera so it never clips at the far plane.
  useFrame(({ camera }) => sky.current?.position.copy(camera.position));
  return (
    <mesh ref={sky} geometry={geometry} material={material} renderOrder={-1} />
  );
}

/**
 * The pit lane: asphalt along the DERIVED centre line, a concrete apron out to the garages, and
 * a concrete pit wall with catch fencing wherever the lane runs separate from the track.
 * Entry and exit blend into the track edge, so cars drive in and out on the surface they use.
 */
function PitLaneSurfaces({ track, lane, terrain }: { track: TrackProfile; lane: PitLane; terrain: boolean }) {
  const parts = useMemo(() => {
    const normals = leftNormals(track);
    const side = lane.side;
    const centre = (i: number) => pitOffsetAt(lane, i, track.count) ?? side * PIT_WALL_OFFSET;
    // Offsets are signed; work in "distance out on the pit side" and convert back.
    const out = (i: number) => centre(i) * side;
    const inner = (i: number) => Math.max(TRACK_HALF_WIDTH - 0.2, out(i) - PIT_LANE_HALF_WIDTH);
    const outer = (i: number) => out(i) + PIT_LANE_HALF_WIDTH;
    const ordered = (a: (i: number) => number, b: (i: number) => number, za: number, zb: number) =>
      side > 0
        ? ([{ offset: a, z: za }, { offset: b, z: zb }] as const)
        : ([{ offset: (i: number) => -b(i), z: zb }, { offset: (i: number) => -a(i), z: za }] as const);
    const range = { from: lane.from, to: lane.to };
    const asphalt = buildStrip(track, normals, {
      edges: ordered(inner, outer, LAYER.asphalt - 0.005, LAYER.asphalt - 0.005),
      ...range,
    });
    // Separate stretch: the lane is clear of the track edge by at least a wall's width.
    let a = 0;
    while (a < lane.offsets.length && lane.offsets[a] * side - PIT_LANE_HALF_WIDTH < PIT_WALL_OFFSET + 0.6) a++;
    let b = lane.offsets.length - 1;
    while (b > a && lane.offsets[b] * side - PIT_LANE_HALF_WIDTH < PIT_WALL_OFFSET + 0.6) b--;
    const wallRange = { from: lane.from + a, to: lane.from + b };
    const w0 = () => PIT_WALL_OFFSET,
      w1 = () => PIT_WALL_OFFSET + 0.5;
    const wall = mergeStrips([
      buildStrip(track, normals, { edges: ordered(w0, w0, 0, 1.05), ...wallRange, uLength: 4 }),
      buildStrip(track, normals, { edges: ordered(w1, w1, 0, 1.05), ...wallRange, uLength: 4 }),
      buildStrip(track, normals, { edges: ordered(w0, w1, 1.05, 1.05), ...wallRange, uLength: 4 }),
    ]);
    const fence = buildStrip(track, normals, {
      edges: ordered(() => PIT_WALL_OFFSET + 0.25, () => PIT_WALL_OFFSET + 0.25, 1.05, 3.4),
      ...wallRange,
      uLength: 2.4,
    });
    const apron = buildStrip(track, normals, {
      edges: ordered(outer, (i) => Math.max(outer(i) + 0.1, 22), LAYER.runoff + 0.02, LAYER.runoff + 0.02),
      ...wallRange,
      uLength: 8,
    });
    // Pit-lane edge line on the garage side.
    const line = buildStrip(track, normals, {
      edges: ordered((i) => outer(i) - 0.25, outer, LAYER.asphalt + 0.02, LAYER.asphalt + 0.02),
      ...range,
    });
    const asphaltMap = asphaltTexture();
    asphaltMap.repeat.set(1, 0.7);
    const fenceMap = fenceTexture();
    fenceMap.repeat.set(1, 1.2);
    return {
      asphalt: toGeometry(asphalt),
      wall: toGeometry(wall),
      fence: toGeometry(fence),
      apron: toGeometry(apron),
      line: toGeometry(line),
      asphaltMaterial: new MeshStandardMaterial({ map: asphaltMap, color: "#d6d9da", roughness: 0.9 }),
      wallMaterial: new MeshStandardMaterial({ color: "#d4d6d2", roughness: 0.85, side: DoubleSide }),
      fenceMaterial: new MeshStandardMaterial({ map: fenceMap, alphaTest: 0.35, side: DoubleSide, metalness: 0.6, roughness: 0.5 }),
      apronMaterial: new MeshStandardMaterial({ color: "#8d9192", roughness: 0.95 }),
      lineMaterial: new MeshStandardMaterial({ color: "#eef0ea", roughness: 0.7 }),
    };
  }, [track, lane]);
  return (
    <>
      <mesh geometry={parts.apron} material={parts.apronMaterial} receiveShadow />
      <mesh geometry={parts.asphalt} material={parts.asphaltMaterial} receiveShadow />
      <mesh geometry={parts.line} material={parts.lineMaterial} receiveShadow />
      <mesh geometry={parts.wall} material={parts.wallMaterial} castShadow receiveShadow userData={OCCLUDER} />
      {terrain && <mesh geometry={parts.fence} material={parts.fenceMaterial} />}
    </>
  );
}

/**
 * Start/finish: a chequered stripe across the track at the timing line, and 22 painted grid
 * boxes behind it, 8 m apart and staggered left/right like a real grid.
 */
function StartGrid({ track, gantry }: { track: TrackProfile; gantry: Placement }) {
  const parts = useMemo(() => {
    const { index } = nearestSample(track, gantry.x, gantry.y);
    const finish = track.distance[index];
    const o = new Object3D();
    const place = (distance: number, lateral: number, angle = 0) => {
      const p = poseAtDistance(track, distance);
      o.position.set(
        p.x - Math.sin(p.heading) * lateral,
        p.y + Math.cos(p.heading) * lateral,
        LAYER.paint + 0.004 + groundOf(track)(p.x - Math.sin(p.heading) * lateral, p.y + Math.cos(p.heading) * lateral),
      );
      o.rotation.set(0, 0, p.heading + angle);
      o.updateMatrix();
      return o.matrix.clone();
    };
    const bars: Matrix4[] = [];
    for (let k = 0; k < 22; k++) {
      const d = finish - 10 - 8 * k,
        side = k % 2 ? -1 : 1,
        lat = side * 3.4;
      bars.push(place(d, lat)); // front bar across the slot
      bars.push(place(d - 0.6, lat + 1.1, 0), place(d - 0.6, lat - 1.1, 0));
    }
    const line = place(finish, 0);
    const texture = chequerTexture();
    return {
      bars,
      bar: new PlaneGeometry(0.18, 2.4),
      tick: new PlaneGeometry(1.2, 0.16),
      tickMatrices: bars.filter((_, i) => i % 3 !== 0),
      barMatrices: bars.filter((_, i) => i % 3 === 0),
      line,
      lineGeometry: new PlaneGeometry(1.2, TRACK_HALF_WIDTH * 2),
      lineMaterial: new MeshStandardMaterial({ map: texture, roughness: 0.6 }),
      paint: new MeshStandardMaterial({ color: "#eef0ea", roughness: 0.7 }),
    };
  }, [track, gantry]);
  return (
    <>
      <Instanced geometry={parts.bar} material={parts.paint} matrices={parts.barMatrices} />
      <Instanced geometry={parts.tick} material={parts.paint} matrices={parts.tickMatrices} />
      <mesh
        geometry={parts.lineGeometry}
        material={parts.lineMaterial}
        matrixAutoUpdate={false}
        matrix={parts.line}
        receiveShadow
      />
    </>
  );
}

/**
 * Tyre walls in front of the barrier behind each gravel trap: stacks of three tyres every
 * 0.66 m, black with painted red and white runs, as at most circuits.
 */
function TyreWalls({ track, apexes }: { track: TrackProfile; apexes: readonly number[] }) {
  const parts = useMemo(() => {
    const normals = leftNormals(track);
    const stack = mergeGeometries(
      [0.16, 0.46, 0.76].map((z) => {
        const g = new CylinderGeometry(0.31, 0.31, 0.28, 10).rotateX(Math.PI / 2).translate(0, 0, z);
        g.deleteAttribute("uv");
        return g;
      }),
    )!;
    const o = new Object3D();
    const matrices: Matrix4[] = [];
    const colours: Color[] = [];
    const paint = [new Color("#1f2123"), new Color("#a3262e"), new Color("#1f2123"), new Color("#d6d6d0")];
    for (const run of gravelTraps(track, apexes)) {
      let n = 0;
      for (let s = run.from; s < run.to; s++) {
        const i = ((s % track.count) + track.count) % track.count,
          j = (i + 1) % track.count;
        const oi = barrierOffset(track, i, run.side) - 0.45 * run.side,
          oj = barrierOffset(track, j, run.side) - 0.45 * run.side;
        const ax = track.x[i] + normals.nx[i] * oi,
          ay = track.y[i] + normals.ny[i] * oi;
        const bx = track.x[j] + normals.nx[j] * oj,
          by = track.y[j] + normals.ny[j] * oj;
        const steps = Math.max(1, Math.round(Math.hypot(bx - ax, by - ay) / 0.66));
        for (let k = 0; k < steps; k++, n++) {
          const f = k / steps;
          const px = ax + (bx - ax) * f,
            py = ay + (by - ay) * f;
          o.position.set(px, py, Math.min(groundOf(track)(px, py), drapeOf(track)(px, py)));
          o.rotation.set(0, 0, 0);
          o.updateMatrix();
          matrices.push(o.matrix.clone());
          colours.push(paint[Math.floor(n / 5) % paint.length]);
        }
      }
    }
    return {
      stack,
      matrices,
      colours,
      material: new MeshStandardMaterial({ roughness: 0.9 }),
    };
  }, [track, apexes]);
  const ref = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    parts.matrices.forEach((m, i) => {
      mesh.setMatrixAt(i, m);
      mesh.setColorAt(i, parts.colours[i]);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [parts]);
  return <instancedMesh ref={ref} args={[parts.stack, parts.material, parts.matrices.length]} frustumCulled={false} />;
}

/**
 * Debris fence above both barriers, after the Geobrugg system Sepang installed (4.5 m at T1,
 * steel posts every 4 m, heavy horizontal cables, fine high-tensile mesh): mesh panels from the
 * barrier top to 4.5 m, a post at every 4 m profile sample, and five cables. The mesh is
 * blended, so from a distance it fades to a light haze like the real thing.
 */
function CatchFence({ track }: { track: TrackProfile }) {
  const parts = useMemo(() => {
    const normals = leftNormals(track);
    const top = 4.5,
      base = 1.1;
    const at = (side: -1 | 1) => (i: number) => barrierOffset(track, i, side);
    const mesh = mergeStrips(
      ([-1, 1] as const).map((side) =>
        buildStrip(track, normals, {
          edges: [
            { offset: at(side), z: base, drape: drapeOf(track) },
            { offset: at(side), z: top, drape: drapeOf(track) },
          ],
          uLength: 1.6,
        }),
      ),
    );
    const cables = mergeStrips(
      ([-1, 1] as const).flatMap((side) =>
        [1.15, 2, 2.85, 3.7, 4.45].map((z) =>
          buildStrip(track, normals, {
            edges: [
              { offset: (i: number) => at(side)(i) - side * 0.06, z, drape: drapeOf(track) },
              { offset: (i: number) => at(side)(i) - side * 0.06, z: z + 0.04, drape: drapeOf(track) },
            ],
          }),
        ),
      ),
    );
    const texture = fenceTexture();
    texture.repeat.set(1, (top - base) / 1.6);
    const post = new BoxGeometry(0.14, 0.2, top).translate(0, 0, top / 2);
    const o = new Object3D();
    const posts: Matrix4[] = [];
    for (let i = 0; i < track.count; i++)
      for (const side of [-1, 1] as const) {
        const off = barrierOffset(track, i, side) + side * 0.1;
        const x = track.x[i] + normals.nx[i] * off,
          y = track.y[i] + normals.ny[i] * off;
        o.position.set(x, y, Math.min(track.z?.[i] ?? 0, drapeOf(track)(x, y)));
        o.rotation.set(0, 0, Math.atan2(normals.ny[i], normals.nx[i]));
        o.updateMatrix();
        posts.push(o.matrix.clone());
      }
    const material = new MeshStandardMaterial({
      map: texture,
      color: "#c9cfd2",
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
      roughness: 0.45,
      metalness: 0.7,
    });
    // Trackside cameras film through a gap in the fence: mesh within 14 m of the camera is cut
    // away, so it never fills the foreground of a TV shot.
    material.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nvarying vec3 vSvlFence;")
        .replace("#include <begin_vertex>", "#include <begin_vertex>\nvSvlFence = (modelMatrix * vec4(transformed, 1.0)).xyz;");
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", "#include <common>\nvarying vec3 vSvlFence;")
        .replace("#include <common>", "#include <common>\nuniform vec3 svlSight;")
        .replace(
          "#include <alphatest_fragment>",
          "#include <alphatest_fragment>\nif (distance(vSvlFence, cameraPosition) < 14.0) discard;" +
            "vec3 svlRay = svlSight - cameraPosition; float svlT = clamp(dot(vSvlFence - cameraPosition, svlRay) / max(dot(svlRay, svlRay), 1e-3), 0.0, 1.0);" +
            "if (svlT < 0.98 && distance(vSvlFence, cameraPosition + svlRay * svlT) < 2.2 + 3.0 * svlT) discard;",
        );
      shader.uniforms.svlSight = fenceSightTarget;
    };
    material.customProgramCacheKey = () => "svl-fence-v3";
    return {
      geometry: toGeometry(mesh),
      cables: toGeometry(cables),
      material,
      post,
      posts,
    };
  }, [track]);
  return (
    <>
      <mesh geometry={parts.geometry} material={parts.material} renderOrder={1} />
      <mesh geometry={parts.cables} material={steel} />
      <Instanced geometry={parts.post} material={steel} matrices={parts.posts} />
    </>
  );
}

/**
 * Low hills on the horizon, well beyond the plantation, so the view does not end in a flat
 * line. Illustrative (no terrain data): a seeded ring that the fog fades into the sky.
 */
function Hills({ bounds, wet, base }: { bounds: EnvironmentLayout["bounds"]; wet: boolean; base: number }) {
  const geometry = useMemo(() => {
    const cx = (bounds.minX + bounds.maxX) / 2,
      cy = (bounds.minY + bounds.maxY) / 2;
    const inner = Math.hypot(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY) / 2 + 1500;
    const seg = 160,
      rings = 4,
      depth = 1400;
    const positions: number[] = [];
    const index: number[] = [];
    for (let r = 0; r <= rings; r++)
      for (let k = 0; k <= seg; k++) {
        const a = (k / seg) * Math.PI * 2;
        const t = r / rings;
        const ridge =
          60 + 70 * Math.sin(a * 3 + 1.1) + 45 * Math.sin(a * 7 + 0.4) + 25 * Math.sin(a * 17 + 2.3);
        const h = Math.max(0, ridge) * Math.sin(Math.PI * t) * (0.6 + 0.4 * t);
        const radius = inner + depth * t;
        positions.push(cx + Math.cos(a) * radius, cy + Math.sin(a) * radius, base + h - 2);
        if (r && k) {
          const i = r * (seg + 1) + k;
          index.push(i - seg - 2, i - 1, i, i - seg - 2, i, i - seg - 1);
        }
      }
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
    g.setIndex(index);
    g.computeVertexNormals();
    return g;
  }, [bounds, base]);
  const material = useMemo(() => new MeshStandardMaterial({ color: "#3f5a36", roughness: 1, side: DoubleSide }), []);
  useLayoutEffect(() => {
    material.color.set(wet ? "#3d4a3c" : "#3f5a36");
  }, [material, wet]);
  return <mesh geometry={geometry} material={material} />;
}

export default function Environment({
  track,
  layout,
  wet = false,
  wetness = wet ? 1 : 0,
  quality = QUALITY.balanced,
}: {
  track: TrackProfile;
  layout: EnvironmentLayout;
  wet?: boolean;
  /** Track wetness 0..1 for the asphalt sheen. */
  wetness?: number;
  quality?: QualitySettings;
}) {
  // Terrain: a height grid around the circuit following the track's DERIVED elevation (each
  // point takes its nearest sample's height, 0.25 m below the surfaces), fading to a level plain
  // 600 m beyond the circuit so it meets the distant ground plane.
  const ground = useMemo(() => {
    const { minX, maxX, minY, maxY } = layout.bounds,
      pad = 700,
      cell = 20;
    const x0 = minX - pad,
      y0 = minY - pad,
      w = maxX - minX + pad * 2,
      h = maxY - minY + pad * 2;
    const nx = Math.ceil(w / cell),
      ny = Math.ceil(h / cell);
    const terrain = terrainOf(track);
    // The surrounding plain sits at the circuit's lowest point: anywhere higher, the flat plane
    // would cut across every stretch of road below it (the T2-T3 dip is ~13 m under the mean).
    let level = Infinity;
    for (let i = 0; i < track.count; i++) level = Math.min(level, track.z?.[i] ?? 0);
    const positions = new Float32Array((nx + 1) * (ny + 1) * 3),
      uvs = new Float32Array((nx + 1) * (ny + 1) * 2);
    for (let j = 0; j <= ny; j++)
      for (let i = 0; i <= nx; i++) {
        const x = x0 + (i / nx) * w,
          y = y0 + (j / ny) * h;
        const outside = Math.max(minX - x, x - maxX, minY - y, y - maxY, 0);
        const fade = Math.min(1, outside / 600);
        const z = terrain(x, y) * (1 - fade) + (level - 0.4) * fade;
        const k = j * (nx + 1) + i;
        positions.set([x, y, z + LAYER.ground], k * 3);
        uvs.set([i / nx, j / ny], k * 2);
      }
    const index: number[] = [];
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nx; i++) {
        const a = j * (nx + 1) + i;
        index.push(a, a + 1, a + nx + 2, a, a + nx + 2, a + nx + 1);
      }
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(positions, 3));
    geometry.setAttribute("uv", new BufferAttribute(uvs, 2));
    geometry.setIndex(index);
    geometry.computeVertexNormals();
    const plain = new PlaneGeometry(w + 9000, h + 9000);
    return {
      geometry,
      plain,
      plainPosition: [x0 + w / 2, y0 + h / 2, level - 0.6 + LAYER.ground] as const,
      position: [0, 0, 0] as const,
      material: withMacroVariation(new MeshStandardMaterial({
        color: "#4f6b3c",
        roughness: 1,
        ...lower,
        polygonOffsetFactor: 4,
        polygonOffsetUnits: 4,
      })),
      size: [w, h] as const,
      level,
    };
  }, [layout, track]);
  // Grass detail on Balanced and High: one 24 m repeat over the whole ground plane.
  useLayoutEffect(() => {
    const m = ground.material;
    if (quality.terrain && !m.map) {
      const t = grassTexture();
      t.repeat.set(ground.size[0] / 24, ground.size[1] / 24);
      m.map = t;
      m.color.set("#ffffff");
    } else if (!quality.terrain && m.map) {
      m.map.dispose();
      m.map = null;
      m.color.set("#4f6b3c");
    }
    m.needsUpdate = true;
  }, [ground, quality.terrain]);
  return (
    <>
      <Sky wet={wet} sunDisc={quality.sunDisc} />
      {quality.terrain && <Hills bounds={layout.bounds} wet={wet} base={ground.level} />}
      <mesh geometry={ground.geometry} material={ground.material} receiveShadow />
      <mesh geometry={ground.plain} material={ground.material} position={[...ground.plainPosition]} />
      <Surfaces track={track} wetness={wetness} apexes={layout.apexes} />
      <PitLaneSurfaces track={track} lane={PIT_LANE} terrain={quality.terrain} />
      <StartGrid track={track} gantry={layout.gantry} />
      <TyreWalls track={track} apexes={layout.apexes} />
      {quality.terrain && <CatchFence track={track} />}
      <PitBuilding b={layout.pit} track={track} />
      <Grandstand b={layout.stand} track={track} />
      {layout.k1 && <CoveredStand b={layout.k1} track={track} />}
      {layout.hill && <Hillstand b={layout.hill} track={track} />}
      <Gantry p={layout.gantry} track={track} />
      {layout.turns.length ? (
        <TurnBoards turns={layout.turns} track={track} />
      ) : (
        <CornerBoards boards={layout.boards} track={track} />
      )}
      <Palms palms={layout.palms} count={quality.palms} track={track} />
      {quality.trees && <TreeClumps trees={layout.trees} track={track} />}
    </>
  );
}
