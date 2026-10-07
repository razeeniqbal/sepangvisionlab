import { useEffect, useRef, useState } from "react";
import Icon, { type IconName } from "../ui/Icon";

const STEPS: { icon: IconName; title: string; text: string }[] = [
  {
    icon: "info",
    title: "Welcome to Sepang Vision Lab",
    text: "A 3D replay of the 2026 Sepang weekend from recorded OpenF1 data. Here is how to get around in five quick steps.",
  },
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
 * Quick guide, shown each time the app opens: one step at a time with Back/Next and progress
 * dots. Ticking "Don't show again" (off by default) keeps it closed on later visits; it can be
 * reopened from the app menu. Arrow keys move between steps, Escape closes.
 */
export default function QuickGuide({ onClose }: { onClose: (remember: boolean) => void }) {
  const [step, setStep] = useState(0);
  const [remember, setRemember] = useState(false);
  const next = useRef<HTMLButtonElement>(null);
  const last = step === STEPS.length - 1;
  const current = STEPS[step];
  useEffect(() => {
    next.current?.focus();
  }, [step]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose(remember);
      if (e.key === "ArrowRight") setStep((s) => Math.min(STEPS.length - 1, s + 1));
      if (e.key === "ArrowLeft") setStep((s) => Math.max(0, s - 1));
    };
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
          <small>Quick guide · {step + 1} of {STEPS.length}</small>
          <button className="sv-icon-button" aria-label="Close guide" onClick={() => onClose(remember)}>
            <Icon name="close" />
          </button>
        </header>
        <div className="sv-guide-step" key={step} aria-live="polite">
          <span className="sv-guide-icon">
            <Icon name={current.icon} size={26} />
          </span>
          <h2 id="sv-guide-title">{current.title}</h2>
          <p>{current.text}</p>
        </div>
        <div className="sv-guide-dots" role="tablist" aria-label="Guide steps">
          {STEPS.map((s, i) => (
            <button
              key={s.title}
              role="tab"
              aria-selected={i === step}
              aria-label={`Step ${i + 1}: ${s.title}`}
              onClick={() => setStep(i)}
            />
          ))}
        </div>
        <footer>
          <label className="sv-switch">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
            <span>Don't show again</span>
          </label>
          <div className="sv-guide-nav">
            {step > 0 && (
              <button className="sv-button" onClick={() => setStep(step - 1)}>
                Back
              </button>
            )}
            <button
              ref={next}
              className="sv-guide-start"
              onClick={() => (last ? onClose(remember) : setStep(step + 1))}
            >
              {last ? "Start watching" : "Next"}
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}
