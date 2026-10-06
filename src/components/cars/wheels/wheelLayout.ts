// Wheel hubs of svl-formula-car-runtime-v1.glb in the createFormulaVisual frame
// (+x nose, +y left, +z up, car length 1.05 units). DERIVED by reading the GLB's vertex
// buffer: tyre equator extremes and lateral faces, symmetric left/right to 0.1 mm.
// The GLB is a single merged mesh, so its own wheels cannot move; the livery shader masks
// them out (formulaLivery.ts) and generated wheels are drawn at these hubs instead.
export const WHEEL_RADIUS = 0.0695;
export const WHEEL_WIDTH = 0.053;
export const COVER = 1.0;
export const FRONT_AXLE_X = 0.2895;
export const REAR_AXLE_X = -0.3729;
export const HUB_Z = 0.0683;
export const HUB_Y = 0.1765;

export type WheelId = "wheel_FL" | "wheel_FR" | "wheel_RL" | "wheel_RR";
export interface WheelHub {
  id: WheelId;
  front: boolean;
  side: 1 | -1; // +1 left
  position: readonly [number, number, number];
}
export const WHEEL_HUBS: readonly WheelHub[] = [
  {
    id: "wheel_FL",
    front: true,
    side: 1,
    position: [FRONT_AXLE_X, HUB_Y, HUB_Z],
  },
  {
    id: "wheel_FR",
    front: true,
    side: -1,
    position: [FRONT_AXLE_X, -HUB_Y, HUB_Z],
  },
  {
    id: "wheel_RL",
    front: false,
    side: 1,
    position: [REAR_AXLE_X, HUB_Y, HUB_Z],
  },
  {
    id: "wheel_RR",
    front: false,
    side: -1,
    position: [REAR_AXLE_X, -HUB_Y, HUB_Z],
  },
];

// "generated": four code-built wheels over the static GLB wheels (default today).
// "model": drive nodes named wheel_FL/FR/RL/RR in a future GLB instead.
export type WheelSource = "generated" | "model";
