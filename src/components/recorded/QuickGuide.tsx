import { useEffect, useRef, useState } from "react";
import Icon, { type IconName } from "../ui/Icon";

const STEPS: { icon: IconName; title: string; text: string }[] = [
  {
    icon: "play",
    title: "Play the weekend",
    text: "Choose FP1 to Race at the top, then press play. Drag the timeline or tap a marker to jump to an incident.",
  },
  {
    icon: "list",
    title: "Follow a driver",
    text: "Click a row in the timing tower or a car on track. Laps shows their lap and sector times.",
  },
  {
    icon: "tv",
    title: "Change the camera",
    text: "TV, Chase, Onboard, Heli or Inspect from the bar at the bottom. Drag to orbit, scroll to zoom, double-click to reset.",
  },
  {
    icon: "trophy",
    title: "Pick your winner",
    text: "In the Race, pick a driver before lights out and see how they finish at the chequered flag.",
  },
  {
    icon: "sliders",
    title: "Make it yours",
    text: "The sliders button sets labels, trails and quality. The menu switches theme. Press P for Present mode.",
  },
];

/**
 * First-visit quick guide: five short steps on a glass card. "Start watching" closes it; tick
 * "Don't show again" to keep it closed. It can be reopened from the app menu.
 */
export default function QuickGuide({ onClose }: { onClose: (remember: boolean) => void }) {
  const [remember, setRemember] = useState(true);
  const start = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    start.current?.focus();
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose(remember);
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onClose, remember]);
  return (
    <div className="sv-guide-backdrop" onClick={() => onClose(remember)}>
      <section
        className="sv-guide glass"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sv-guide-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header>
          <h2 id="sv-guide-title">Welcome to Sepang Vision Lab</h2>
          <p>A 3D replay of the 2026 Sepang weekend, built from recorded OpenF1 data.</p>
        </header>
        <ol>
          {STEPS.map((s) => (
            <li key={s.title}>
              <span className="sv-guide-icon">
                <Icon name={s.icon} />
              </span>
              <div>
                <strong>{s.title}</strong>
                <span>{s.text}</span>
              </div>
            </li>
          ))}
        </ol>
        <footer>
          <label className="sv-switch">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
            <span>Don't show again</span>
          </label>
          <button ref={start} className="sv-guide-start" onClick={() => onClose(remember)}>
            Start watching
          </button>
        </footer>
      </section>
    </div>
  );
}
