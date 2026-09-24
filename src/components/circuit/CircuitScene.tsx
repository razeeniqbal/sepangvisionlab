import { useGestureReceiver } from "../handtracking/GestureContext";
import { useEffect, useRef, useState, type RefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrthographicCamera } from "three";
import Circuit from "./Circuit";
import { trackSize, trackCenter } from "./trackCurve";
import CarMarker from "../cars/CarMarker";
import type { CarState, CarDefinition } from "../../domain/field";
import { sampleRace, type ReplayData } from "../../services/raceState";

interface Props {
  clock: RefObject<number>;
  data?: ReplayData;
  historical?: {
    entries: CarDefinition[];
    sample: (time: number) => CarState[];
    activeIds: string[];
  };
  selectedId: string;
  onSelect: (id: string) => void;
}
function Scene({
  clock,
  data,
  historical,
  selectedId,
  onSelect,
  view,
}: Props & { view: { zoom: number; angle: number } }) {
  const syntheticCars = historical?.entries ?? data!.entries;
  const sample =
    historical?.sample ?? ((time: number) => sampleRace(data!, time));
  const field = useRef<CarState[]>(sample(clock.current));

  const { camera, size } = useThree();
  useEffect(() => {
    if (camera instanceof OrthographicCamera) {
      camera.zoom = Math.min(
        size.width / (trackSize.x + 4),
        size.height / (trackSize.y + 4),
      );
      camera.zoom *= view.zoom;
      camera.up.set(
        Math.sin((view.angle * Math.PI) / 180),
        Math.cos((view.angle * Math.PI) / 180),
        0,
      );
      camera.position.x = trackCenter.x;
      camera.position.y = trackCenter.y;
      camera.lookAt(trackCenter.x, trackCenter.y, 0);
      camera.updateProjectionMatrix();
    }
  }, [camera, size, view]);
  useFrame(() => {
    field.current = sample(clock.current);
  }, -1);
  return (
    <>
      <gridHelper
        args={[80, 80, "#243332", "#1b2524"]}
        rotation={[Math.PI / 2, 0, 0]}
        position={[0, 0, -0.1]}
      />
      <Circuit />
      {syntheticCars.map(
        (car, index) =>
          (!historical || historical.activeIds.includes(car.id)) && (
            <CarMarker
              key={car.id}
              car={car}
              index={index}
              field={field}
              selected={selectedId === car.id}
              onSelect={onSelect}
            />
          ),
      )}
    </>
  );
}
export default function CircuitScene(props: Props) {
  const [view, setView] = useState({ zoom: 1, angle: 0 });
  const zoom = (factor: number) =>
    setView((v) => ({
      ...v,
      zoom: Math.min(2.5, Math.max(0.75, v.zoom * factor)),
    }));
  const rotate = (delta: number) =>
    setView((v) => ({ ...v, angle: ((v.angle + delta + 540) % 360) - 180 }));
  useGestureReceiver((action) => {
    if (action === "zoomIn" || action === "zoomOut") {
      zoom(action === "zoomIn" ? 1.2 : 1 / 1.2);
      return true;
    }
    if (action === "rotateLeft" || action === "rotateRight") {
      rotate(action === "rotateLeft" ? -15 : 15);
      return true;
    }
    return false;
  });
  return (
    <div className="circuit-view-controls">
      <div
        className="circuit-camera-toolbar"
        aria-label="Circuit view controls"
      >
        <button onClick={() => zoom(1.2)}>Zoom +</button>
        <button onClick={() => zoom(1 / 1.2)}>Zoom −</button>
        <button onClick={() => rotate(-15)}>Rotate −15°</button>
        <button onClick={() => rotate(15)}>Rotate +15°</button>
        <button onClick={() => setView({ zoom: 1, angle: 0 })}>
          Reset view
        </button>
        <span data-testid="circuit-view-state">
          {view.zoom.toFixed(2)}× / {view.angle}°
        </span>
      </div>
      <Canvas
        orthographic
        camera={{ position: [0, 0, 30], zoom: 35, near: 0.1, far: 100 }}
        dpr={[1, 2]}
        fallback={
          <div className="fallback">
            WebGL is unavailable. Enable browser hardware acceleration to view
            the circuit.
          </div>
        }
      >
        <Scene {...props} view={view} />
      </Canvas>
    </div>
  );
}
