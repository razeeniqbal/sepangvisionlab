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
  ShaderMaterial,
  SphereGeometry,
} from "three";
import { useFrame } from "@react-three/fiber";
import type { TrackProfile } from "../../../domain/lapPhysics";
import { anchorInProfile } from "./anchors";
import {
  KERB_WIDTH,
  LAYER,
  LINE_WIDTH,
  RUNOFF_OUTER,
  TRACK_HALF_WIDTH,
  barrierOffset,
  cornerBoards,
  fitBuilding,
  gantryAt,
  kerbRuns,
  scatterPalms,
  trackBearing,
  type Building,
  type Placement,
} from "./layout";
import {
  buildStrip,
  leftNormals,
  mergeStrips,
  type StripMesh,
  type StripSpec,
} from "./ribbon";
import { asphaltTexture, chevronTexture, kerbTexture } from "./textures";

export const SKY = Object.freeze({
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
      boards: cornerBoards(track, normals),
      bounds: { minX, maxX, minY, maxY },
    };
  }, [track, coordinates]);
}

function Surfaces({ track }: { track: TrackProfile }) {
  const meshes = useMemo(() => {
    const normals = leftNormals(track);
    const strip = (spec: StripSpec) => buildStrip(track, normals, spec);
    const w = TRACK_HALF_WIDTH;
    const kerbs = kerbRuns(track).map((run) => {
      const a = run.side * w,
        b = run.side * (w + KERB_WIDTH);
      return strip({
        edges: [
          { offset: Math.min(a, b), z: LAYER.paint },
          { offset: Math.max(a, b), z: LAYER.paint },
        ],
        from: run.from,
        to: run.to,
        uLength: 6,
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
      barriers: toGeometry(mergeStrips(barriers)),
    };
  }, [track]);
  const materials = useMemo(() => {
    const asphalt = asphaltTexture();
    asphalt.repeat.set(1, 1.6);
    return {
      asphalt: new MeshStandardMaterial({ map: asphalt, roughness: 0.92 }),
      lines: new MeshStandardMaterial({ color: "#eef0ea", roughness: 0.7 }),
      runoff: new MeshStandardMaterial({
        color: "#6f7d64",
        roughness: 1,
        ...lower,
      }),
      kerbs: new MeshStandardMaterial({ map: kerbTexture(), roughness: 0.6 }),
      barriers: new MeshStandardMaterial({
        color: "#c9cdc8",
        roughness: 0.8,
        side: DoubleSide,
      }),
    };
  }, []);
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
const seats = new MeshStandardMaterial({ color: "#3d4f5a", roughness: 0.8 });
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

function PitBuilding({ b }: { b: Building }) {
  return (
    <group position={[b.x, b.y, 0]} rotation={[0, 0, b.heading]}>
      <mesh material={concrete} position={[0, 0, 4]} castShadow receiveShadow>
        <boxGeometry args={[b.length, b.depth, 8]} />
      </mesh>
      <mesh material={glass} position={[0, 0, 11]}>
        <boxGeometry args={[b.length * 0.98, b.depth * 0.9, 6]} />
      </mesh>
      <mesh material={roof} position={[0, 0, 14.4]} castShadow>
        <boxGeometry args={[b.length * 1.02, b.depth * 1.25, 0.8]} />
      </mesh>
    </group>
  );
}

// Double-frontage stand: two tiers rising away from each straight to a central spine.
function Grandstand({ b }: { b: Building }) {
  const tiers = 4,
    half = b.depth / 2,
    columns = Math.max(2, Math.round(b.length / 40)) + 1;
  return (
    <group position={[b.x, b.y, 0]} rotation={[0, 0, b.heading]}>
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
    <group position={[p.x, p.y, 0]} rotation={[0, 0, p.heading]}>
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
}: {
  geometry: BufferGeometry;
  material: MeshStandardMaterial;
  matrices: Matrix4[];
  castShadow?: boolean;
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
    />
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
        geometry={parts.board}
        material={parts.boardMaterial}
        matrices={parts.boardMatrices}
      />
      <Instanced
        geometry={parts.post}
        material={steel}
        matrices={parts.postMatrices}
      />
    </>
  );
}

function Palms({ track, avoid }: { track: TrackProfile; avoid: Building[] }) {
  const parts = useMemo(() => {
    const palms = scatterPalms(track, { avoid });
    const trunk = new CylinderGeometry(0.22, 0.38, 9, 6)
      .rotateX(Math.PI / 2)
      .translate(0, 0, 4.5);
    const crown = new IcosahedronGeometry(3.4, 0)
      .scale(1, 1, 0.42)
      .translate(0, 0, 9.3);
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
        color: "#2f5a2c",
        roughness: 0.9,
        flatShading: true,
      }),
    };
  }, [track, avoid]);
  return (
    <>
      <Instanced
        geometry={parts.trunk}
        material={parts.bark}
        matrices={parts.matrices}
      />
      <Instanced
        geometry={parts.crown}
        material={parts.leaves}
        matrices={parts.matrices}
      />
    </>
  );
}

function Sky() {
  const material = useMemo(
    () =>
      new ShaderMaterial({
        side: BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {
          horizon: { value: new Color(SKY.horizon) },
          zenith: { value: new Color(SKY.zenith) },
        },
        vertexShader:
          "varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
        fragmentShader:
          "uniform vec3 horizon; uniform vec3 zenith; varying vec3 vDir; void main(){ float h = clamp(vDir.z, 0.0, 1.0); gl_FragColor = vec4(mix(horizon, zenith, pow(h, 0.6)), 1.0); }",
      }),
    [],
  );
  const geometry = useMemo(
    () => new SphereGeometry(6000, 24, 12).rotateX(Math.PI / 2),
    [],
  );
  const sky = useRef<Mesh>(null);
  // The sky follows the camera so it never clips at the far plane.
  useFrame(({ camera }) => sky.current?.position.copy(camera.position));
  return (
    <mesh ref={sky} geometry={geometry} material={material} renderOrder={-1} />
  );
}

export default function Environment({
  track,
  layout,
}: {
  track: TrackProfile;
  layout: EnvironmentLayout;
}) {
  const ground = useMemo(() => {
    const { minX, maxX, minY, maxY } = layout.bounds,
      pad = 1600;
    return {
      geometry: new PlaneGeometry(maxX - minX + pad * 2, maxY - minY + pad * 2),
      position: [(minX + maxX) / 2, (minY + maxY) / 2, LAYER.ground] as const,
      material: new MeshStandardMaterial({
        color: "#4f6b3c",
        roughness: 1,
        ...lower,
        polygonOffsetFactor: 4,
        polygonOffsetUnits: 4,
      }),
    };
  }, [layout]);
  const avoid = useMemo(() => [layout.pit, layout.stand], [layout]);
  return (
    <>
      <Sky />
      <mesh
        geometry={ground.geometry}
        material={ground.material}
        position={[...ground.position]}
        receiveShadow
      />
      <Surfaces track={track} />
      <PitBuilding b={layout.pit} />
      <Grandstand b={layout.stand} />
      <Gantry p={layout.gantry} />
      <CornerBoards boards={layout.boards} />
      <Palms track={track} avoid={avoid} />
    </>
  );
}
