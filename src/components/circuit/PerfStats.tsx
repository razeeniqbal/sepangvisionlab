import { lazy, Suspense } from "react";

// Development-only frame-rate meter: `npm run dev`, then open the app with ?perf.
// Production builds drop it (import.meta.env.DEV is false), so nothing ships.
const enabled =
  import.meta.env.DEV &&
  new URLSearchParams(window.location.search).has("perf");
const Stats = enabled
  ? lazy(() =>
      import("@react-three/drei").then((drei) => ({ default: drei.Stats })),
    )
  : null;

/** Render inside a <Canvas>. Click the meter to cycle FPS, frame ms and memory. */
export default function PerfStats() {
  if (!Stats) return null;
  return (
    <Suspense fallback={null}>
      <Stats showPanel={0} />
    </Suspense>
  );
}
