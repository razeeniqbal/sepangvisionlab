import { useEffect, useRef, type RefObject } from "react";
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
function Scene({ clock, data, historical, selectedId, onSelect }: Props) {
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
      camera.position.x = trackCenter.x;
      camera.position.y = trackCenter.y;
      camera.updateProjectionMatrix();
    }
  }, [camera, size]);
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
  return (
    <Canvas
      orthographic
      camera={{ position: [0, 0, 30], zoom: 35, near: 0.1, far: 100 }}
      dpr={[1, 2]}
      fallback={
        <div className="fallback">
          WebGL is unavailable. Enable browser hardware acceleration to view the
          circuit.
        </div>
      }
    >
      <Scene {...props} />
    </Canvas>
  );
}
