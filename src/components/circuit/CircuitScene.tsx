import { useGestureReceiver } from "../handtracking/GestureContext";
import {
  lazy,
  Suspense,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrthographicCamera } from "three";
import Circuit from "./Circuit";
import { engineeringCamera, type EngineeringView } from "./cameraView";
import { trackSize, trackCenter, trackCurve } from "./trackCurve";
import CarMarker from "../cars/CarMarker";
import type { CarState, CarDefinition } from "../../domain/field";
import { sampleRace, type ReplayData } from "../../services/raceState";

const SpatialReferenceDebug = import.meta.env.DEV
  ? lazy(() => import("./SpatialReferenceDebug"))
  : null;
const showSpatialReferences =
  import.meta.env.DEV &&
  new URLSearchParams(window.location.search).get("spatialRefs") === "1";

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
}: Props & { view: EngineeringView }) {
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
      // Fit the rotated foundation in overview while retaining the original zoom scale ceiling.
      const a = (view.angle * Math.PI) / 180;
      const projectedWidth =
        Math.abs(Math.cos(a)) * (trackSize.x + 4.4) +
        Math.abs(Math.sin(a)) * (trackSize.y + 4.4);
      const projectedHeight =
        (Math.abs(Math.sin(a)) * (trackSize.x + 4.4) +
          Math.abs(Math.cos(a)) * (trackSize.y + 4.4)) *
          Math.cos((view.tilt * Math.PI) / 180) +
        0.15;
      camera.zoom = Math.min(
        camera.zoom,
        size.width / (projectedWidth + 1),
        size.height / (projectedHeight + 1),
      );
      camera.zoom *= view.zoom;
      const pose = engineeringCamera(view);
      camera.up.copy(pose.up);
      camera.position.copy(pose.position);
      camera.lookAt(pose.target);
      camera.updateProjectionMatrix();
    }
  }, [camera, size, view]);
  useFrame(() => {
    field.current = sample(clock.current);
  }, -1);
  return (
    <>
      <hemisphereLight args={["#ffffff", "#60756d", 2.2]} />
      <directionalLight position={[8, -12, 20]} intensity={3} />
      <Circuit />
      {showSpatialReferences && SpatialReferenceDebug && (
        <Suspense fallback={null}>
          <SpatialReferenceDebug />
        </Suspense>
      )}
      {syntheticCars.map(
        (car, index) =>
          (!historical || historical.activeIds.includes(car.id)) && (
            <CarMarker
              key={car.id}
              car={car}
              tyresKnown={!historical}
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
  const overview = (): EngineeringView => ({
    zoom: 1,
    angle: -20,
    tilt: 48,
    target: [trackCenter.x, trackCenter.y, 0],
  });
  const [view, setView] = useState<EngineeringView>(overview);
  const focusSelected = () => {
    const cars =
      props.historical?.sample(props.clock.current) ??
      sampleRace(props.data!, props.clock.current);
    const selected = cars.find((c) => c.id === props.selectedId);
    if (
      !selected ||
      (props.historical && !props.historical.activeIds.includes(selected.id))
    )
      return;
    const point = trackCurve.getPointAt(selected.progress);
    setView((v) => ({ ...v, zoom: 2.5, target: [point.x, point.y, point.z] }));
  };
  const pan = (x: number, y: number) =>
    setView((v) => {
      const angle = (v.angle * Math.PI) / 180,
        step = 1.5 / v.zoom;
      return {
        ...v,
        target: [
          v.target[0] + (x * Math.cos(angle) - y * Math.sin(angle)) * step,
          v.target[1] + (x * Math.sin(angle) + y * Math.cos(angle)) * step,
          v.target[2],
        ],
      };
    });
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
        <button onClick={() => setView(overview())}>Reset view</button>
        <button
          aria-pressed={view.tilt === 48}
          onClick={() => setView((v) => ({ ...v, tilt: 48 }))}
        >
          3D view
        </button>
        <button
          aria-pressed={view.tilt === 0}
          onClick={() => setView((v) => ({ ...v, tilt: 0 }))}
        >
          Top view
        </button>
        <button onClick={focusSelected}>Focus selected</button>
        <button aria-label="Pan left" onClick={() => pan(-1, 0)}>
          ←
        </button>
        <button aria-label="Pan right" onClick={() => pan(1, 0)}>
          →
        </button>
        <button aria-label="Pan up" onClick={() => pan(0, 1)}>
          ↑
        </button>
        <button aria-label="Pan down" onClick={() => pan(0, -1)}>
          ↓
        </button>
        <span data-testid="circuit-view-state">
          {view.zoom.toFixed(2)}× / {view.angle}° /{" "}
          {view.tilt === 0 ? "TOP" : "3D"}
        </span>
      </div>
      <span className="circuit-accuracy-note">
        Flat elevation · illustrative track surroundings
      </span>
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
