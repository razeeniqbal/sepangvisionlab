import { Vector3 } from "three";
export interface EngineeringView {
  zoom: number;
  angle: number;
  tilt: number;
  target: [number, number, number];
}
export function engineeringCamera(view: EngineeringView, distance = 45) {
  const a = (view.angle * Math.PI) / 180,
    t = (view.tilt * Math.PI) / 180;
  const target = new Vector3(...view.target);
  return {
    target,
    position: target
      .clone()
      .add(
        new Vector3(
          Math.sin(a) * Math.sin(t),
          -Math.cos(a) * Math.sin(t),
          Math.cos(t),
        ).multiplyScalar(distance),
      ),
    up: new Vector3(
      -Math.sin(a) * Math.cos(t),
      Math.cos(a) * Math.cos(t),
      Math.sin(t),
    ),
  };
}
