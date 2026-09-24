import {
  Component,
  lazy,
  Suspense,
  type ComponentProps,
  type ReactNode,
} from "react";
const CircuitScene = lazy(() => import("./CircuitScene"));
class CircuitBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="fallback" role="alert">
        The circuit could not load. Replay and analysis remain available.{" "}
        <button onClick={() => window.location.reload()}>
          Reload circuit page
        </button>
      </div>
    ) : (
      this.props.children
    );
  }
}
export default function CircuitViewport(
  props: ComponentProps<typeof CircuitScene>,
) {
  return (
    <CircuitBoundary>
      <Suspense
        fallback={
          <div className="fallback" role="status">
            Loading Sepang circuit…
          </div>
        }
      >
        <CircuitScene {...props} />
      </Suspense>
    </CircuitBoundary>
  );
}
