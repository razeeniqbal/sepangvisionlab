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
  fitBuilding,
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
  fenceTexture,
  grassTexture,
  gravelTexture,
  chevronTexture,
  kerbTexture,
  turnBoardTexture,
} from "./textures";

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
    return {
      pit: fitBuilding(
        track,
        {
          ...pitAnchor,
          heading: trackBearing(track, pitAnchor.x, pitAnchor.y),
        },
        420,
        24,
      ),
      // OFFICIAL "double frontage; east-west alignment": heading 0 (east).
      stand: fitBuilding(
        track,
        { ...standAnchor, heading: 0 },
        320,
        44,
        TRACK_HALF_WIDTH + 10,
      ),
      gantry: gantryAt(track, finish.x, finish.y),
      // Numbered T1-T15 when the detector matches the official layout; else unnumbered.
      ...(() => {
        const turns = officialTurnBoards(track, normals);
        return {
          turns,
          boards: turns.length ? turns : cornerBoards(track, normals),
        };
      })(),
      bounds: { minX, maxX, minY, maxY },
      ...(() => {
        const turns = officialTurnBoards(track, normals);
        const pit = fitBuilding(track, { ...pitAnchor, heading: trackBearing(track, pitAnchor.x, pitAnchor.y) }, 420, 24);
        const stand = fitBuilding(track, { ...standAnchor, heading: 0 }, 320, 44, TRACK_HALF_WIDTH + 10);
        return {
          apexes: turns.length ? turns.map((t) => t.apex) : findCorners(track),
          // Clumps keep clear of every trackside camera position, so TV shots stay open.
          trees: treeClumps(track, normals, { avoid: tvPoints(track, normals), buildings: [pit, stand] }),
          palms: palmRows(track, { buildings: [pit, stand] }),
        };
      })(),
    };
  }, [track, coordinates]);
}

function Surfaces({
  track,
  wet,
  apexes,
}: {
  track: TrackProfile;
  wet: boolean;
  apexes: readonly number[];
}) {
  const meshes = useMemo(() => {
    const normals = leftNormals(track);
    const strip = (spec: StripSpec) => buildStrip(track, normals, spec);
    const w = TRACK_HALF_WIDTH;
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
          { offset: Math.min(a, b), z: LAYER.runoff + 0.02 },
          { offset: Math.max(a, b), z: LAYER.runoff + 0.02 },
        ],
        from: run.from,
        to: run.to,
        uLength: 8,
      });
    });
    const barriers = ([-1, 1] as const).map((side) =>
      strip({
        edges: [
          { offset: (i: number) => barrierOffset(track, i, side), z: 0 },
          { offset: (i: number) => barrierOffset(track, i, side), z: 1.1 },
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
              { offset: -RUNOFF_OUTER, z: LAYER.runoff },
              { offset: -w, z: LAYER.runoff },
            ],
          }),
          strip({
            edges: [
              { offset: w, z: LAYER.runoff },
              { offset: RUNOFF_OUTER, z: LAYER.runoff },
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
    materials.asphalt.color.set(wet ? "#7d8589" : "#ffffff");
    materials.asphalt.roughness = wet ? 0.38 : 0.92;
    materials.asphalt.metalness = wet ? 0.22 : 0;
  }, [materials, wet]);
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

function PitBuilding({ b, track }: { b: Building; track: TrackProfile }) {
  // Which long side faces the circuit (local +y or -y)?
  const { index } = nearestSample(track, b.x, b.y);
  const c = Math.cos(-b.heading), s = Math.sin(-b.heading);
  const face = (track.x[index] - b.x) * s + (track.y[index] - b.y) * c > 0 ? 1 : -1;
  const bays = Math.max(4, Math.floor(b.length / 14));
  const bay = b.length / bays;
  return (
    <group
      position={[b.x, b.y, 0]}
      rotation={[0, 0, b.heading]}
      userData={OCCLUDER}
    >
      <mesh material={concrete} position={[0, 0, 4]} castShadow receiveShadow>
        <boxGeometry args={[b.length, b.depth, 8]} />
      </mesh>
      <mesh material={glass} position={[0, 0, 11]}>
        <boxGeometry args={[b.length * 0.98, b.depth * 0.9, 6]} />
      </mesh>
      <mesh material={roof} position={[0, 0, 14.4]} castShadow>
        <boxGeometry args={[b.length * 1.02, b.depth * 1.25, 0.8]} />
      </mesh>
      {Array.from({ length: bays }, (_, i) => {
        const x = -b.length / 2 + bay * (i + 0.5);
        return (
          <group key={i} position={[x, face * (b.depth / 2 + 0.05), 0]}>
            <mesh material={garageDoor} position={[0, 0, 2.6]}>
              <boxGeometry args={[bay * 0.82, 0.2, 5.2]} />
            </mesh>
            <mesh material={GARAGE_BANDS[i % GARAGE_BANDS.length]} position={[0, 0, 6]}>
              <boxGeometry args={[bay * 0.92, 0.3, 0.9]} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

// Double-frontage stand: two tiers rising away from each straight to a central spine.
function Grandstand({ b }: { b: Building }) {
  const tiers = 4,
    half = b.depth / 2,
    columns = Math.max(2, Math.round(b.length / 40)) + 1;
  return (
    <group
      position={[b.x, b.y, 0]}
      rotation={[0, 0, b.heading]}
      userData={OCCLUDER}
    >
      {[-1, 1].flatMap((side) =>
        Array.from({ length: tiers }, (_, t) => (
          <mesh
            key={side + ":" + t}
            material={seats}
            position={[
              0,
              side * (half - ((t + 0.5) * half) / tiers),
              1.5 + t * 3,
            ]}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[b.length, half / tiers, 3 + t * 6]} />
          </mesh>
        )),
      )}
      <mesh material={roof} position={[0, 0, 26]} castShadow>
        <boxGeometry args={[b.length * 1.02, b.depth * 0.95, 0.6]} />
      </mesh>
      {/* Canopy fascia on both frontages. */}
      {[-1, 1].map((side) => (
        <mesh key={side} material={steel} position={[0, side * b.depth * 0.475, 25.2]}>
          <boxGeometry args={[b.length * 1.02, 0.4, 1.6]} />
        </mesh>
      ))}
      {Array.from({ length: columns }, (_, i) => (
        <mesh
          key={i}
          material={steel}
          position={[-b.length / 2 + (i * b.length) / (columns - 1), 0, 13]}
        >
          <boxGeometry args={[0.8, 0.8, 26]} />
        </mesh>
      ))}
    </group>
  );
}

function Gantry({ p }: { p: Placement }) {
  const span = TRACK_HALF_WIDTH + 3;
  return (
    <group
      position={[p.x, p.y, 0]}
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
        material: new MeshStandardMaterial({
          map: turnBoardTexture(t.turn, track.curvature[t.apex] > 0),
          side: DoubleSide,
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
          position={[b.x, b.y, 0]}
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
        </group>
      ))}
    </group>
  );
}

function CornerBoards({ boards }: { boards: Placement[] }) {
  const parts = useMemo(() => {
    // Face oncoming cars: the board normal runs along the track tangent.
    const board = new PlaneGeometry(2.4, 2.4)
      .rotateX(Math.PI / 2)
      .rotateZ(Math.PI / 2);
    const post = new BoxGeometry(0.2, 0.2, 2.2).translate(0, 0, 1.1);
    const o = new Object3D();
    const at = (p: Placement, z: number, face: number) => {
      o.position.set(p.x, p.y, z);
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
  }, [boards]);
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

function Palms({ palms: all, count }: { palms: readonly Palm[]; count: number }) {
  const parts = useMemo(() => {
    const palms = all.slice(0, count);
    const trunk = new CylinderGeometry(0.24, 0.42, 9, 7)
      .rotateX(Math.PI / 2)
      .translate(0, 0, 4.5);
    const crown = palmCrown();
    const o = new Object3D();
    const matrices = palms.map((p) => {
      o.position.set(p.x, p.y, 0);
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
  }, [all, count]);
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
function TreeClumps({ trees }: { trees: readonly Tree[] }) {
  const parts = useMemo(() => {
    const trunk = new CylinderGeometry(0.35, 0.5, 4, 5).rotateX(Math.PI / 2).translate(0, 0, 2);
    const crown = broadleafCrown();
    const o = new Object3D();
    const matrices = trees.map((t) => {
      o.position.set(t.x, t.y, 0);
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
  }, [trees]);
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
        LAYER.paint + 0.004,
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
          o.position.set(ax + (bx - ax) * f, ay + (by - ay) * f, 0);
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

/** Catch fence above both barriers: wire mesh on posts every ~12 m, with a top rail. */
function CatchFence({ track }: { track: TrackProfile }) {
  const parts = useMemo(() => {
    const normals = leftNormals(track);
    const top = 4;
    const mesh = mergeStrips(
      ([-1, 1] as const).map((side) =>
        buildStrip(track, normals, {
          edges: [
            { offset: (i: number) => barrierOffset(track, i, side), z: 1.1 },
            { offset: (i: number) => barrierOffset(track, i, side), z: top },
          ],
          uLength: 2.4,
        }),
      ),
    );
    const texture = fenceTexture();
    texture.repeat.set(1, 1.2);
    const post = new BoxGeometry(0.12, 0.12, top).translate(0, 0, top / 2);
    const o = new Object3D();
    const posts: Matrix4[] = [];
    for (let i = 0; i < track.count; i += 3)
      for (const side of [-1, 1] as const) {
        const off = barrierOffset(track, i, side) + side * 0.08;
        o.position.set(track.x[i] + normals.nx[i] * off, track.y[i] + normals.ny[i] * off, 0);
        o.updateMatrix();
        posts.push(o.matrix.clone());
      }
    const material = new MeshStandardMaterial({
      map: texture,
      alphaTest: 0.35,
      transparent: false,
      side: DoubleSide,
      roughness: 0.5,
      metalness: 0.6,
    });
    // Trackside cameras film through a gap in the fence: wire within 14 m of the camera is
    // cut away, so it never fills the foreground of a TV shot.
    material.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nvarying vec3 vSvlFence;")
        .replace("#include <begin_vertex>", "#include <begin_vertex>\nvSvlFence = (modelMatrix * vec4(transformed, 1.0)).xyz;");
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", "#include <common>\nvarying vec3 vSvlFence;")
        .replace("#include <alphatest_fragment>", "#include <alphatest_fragment>\nif (distance(vSvlFence, cameraPosition) < 14.0) discard;");
    };
    material.customProgramCacheKey = () => "svl-fence";
    return {
      geometry: toGeometry(mesh),
      material,
      post,
      posts,
    };
  }, [track]);
  return (
    <>
      <mesh geometry={parts.geometry} material={parts.material} />
      <Instanced geometry={parts.post} material={steel} matrices={parts.posts} />
    </>
  );
}

/**
 * Low hills on the horizon, well beyond the plantation, so the view does not end in a flat
 * line. Illustrative (no terrain data): a seeded ring that the fog fades into the sky.
 */
function Hills({ bounds, wet }: { bounds: EnvironmentLayout["bounds"]; wet: boolean }) {
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
        positions.push(cx + Math.cos(a) * radius, cy + Math.sin(a) * radius, h - 2);
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
  }, [bounds]);
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
  quality = QUALITY.balanced,
}: {
  track: TrackProfile;
  layout: EnvironmentLayout;
  wet?: boolean;
  quality?: QualitySettings;
}) {
  const ground = useMemo(() => {
    const { minX, maxX, minY, maxY } = layout.bounds,
      pad = 1600;
    return {
      geometry: new PlaneGeometry(maxX - minX + pad * 2, maxY - minY + pad * 2),
      position: [(minX + maxX) / 2, (minY + maxY) / 2, LAYER.ground] as const,
      material: withMacroVariation(new MeshStandardMaterial({
        color: "#4f6b3c",
        roughness: 1,
        ...lower,
        polygonOffsetFactor: 4,
        polygonOffsetUnits: 4,
      })),
      size: [maxX - minX + pad * 2, maxY - minY + pad * 2] as const,
    };
  }, [layout]);
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
      {quality.terrain && <Hills bounds={layout.bounds} wet={wet} />}
      <mesh
        geometry={ground.geometry}
        material={ground.material}
        position={[...ground.position]}
        receiveShadow
      />
      <Surfaces track={track} wet={wet} apexes={layout.apexes} />
      <StartGrid track={track} gantry={layout.gantry} />
      <TyreWalls track={track} apexes={layout.apexes} />
      {quality.terrain && <CatchFence track={track} />}
      <PitBuilding b={layout.pit} track={track} />
      <Grandstand b={layout.stand} />
      <Gantry p={layout.gantry} />
      {layout.turns.length ? (
        <TurnBoards turns={layout.turns} track={track} />
      ) : (
        <CornerBoards boards={layout.boards} />
      )}
      <Palms palms={layout.palms} count={quality.palms} />
      {quality.trees && <TreeClumps trees={layout.trees} />}
    </>
  );
}
