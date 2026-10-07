import { Component, useState, type ReactNode } from "react";
import { GestureProvider } from "./components/handtracking/GestureContext";
import HandTrackingPanel from "./components/handtracking/HandTrackingPanel";
import RecordedWorkspace from "./components/recorded/RecordedWorkspace";

// Last-resort boundary: the circuit has its own; this keeps the page usable if anything else fails.
class AppBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="fallback" role="alert">
        Something went wrong while showing the replay. Please reload the page.
      </div>
    ) : (
      this.props.children
    );
  }
}

/** Sepang Vision Lab: the 2026 Sepang weekend (OpenF1) as a 3D broadcast replay. */
export default function App() {
  // Hand tracking stays mounted (a running camera keeps working) and opens as a sheet.
  const [handsOpen, setHandsOpen] = useState(false);
  return (
    <div className="shell shell-broadcast">
      <GestureProvider>
        <AppBoundary>
          <RecordedWorkspace
            handsOpen={handsOpen}
            onHands={() => setHandsOpen((open) => !open)}
          />
        </AppBoundary>
        <div
          className={"hands-sheet" + (handsOpen ? " is-open" : "")}
          aria-label="Hand tracking"
        >
          <HandTrackingPanel onClose={() => setHandsOpen(false)} />
        </div>
      </GestureProvider>
    </div>
  );
}
