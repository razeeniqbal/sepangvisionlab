import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Icon, { type IconName } from "../ui/Icon";

interface Step {
  icon: IconName;
  title: string;
  text: string;
  /** The control this step points at; no target (or not on screen) shows the step centred. */
  target?: string;
  /** Scroll this ancestor into view instead (the camera bar lives inside the 3D view). */
  scroll?: string;
}

const STEPS: Step[] = [
  {
    icon: "info",
    title: "Welcome to Sepang Vision Lab",
    text: "A 3D replay of the 2026 Sepang weekend from recorded OpenF1 data. This quick tour points out the controls, one at a time.",
  },
  {
    icon: "list",
    title: "Choose a session",
    text: "Switch between FP1, FP2, FP3, Qualifying and the Race here.",
    target: ".sv-header .sv-sessions",
  },
  {
    icon: "play",
    title: "Play and scrub",
    text: "Press play, change the speed, or drag the timeline. The coloured marks are race-control moments: tap one to jump there.",
    target: ".sv-replay",
  },
  {
    icon: "list",
    title: "Follow a driver",
    text: "The timing tower shows the live order. Click a row, or a car on track, to follow that driver.",
    target: ".bc-tower",
  },
  {
    icon: "tv",
    title: "Change the camera",
    text: "TV, Chase, Onboard, Heli or Inspect. In the 3D view, drag to orbit, scroll to zoom and double-click to reset.",
    target: ".sv-dock",
    scroll: ".circuit-view-controls",
  },
  {
    icon: "headset",
    title: "Race engineer",
    text: "Ask your engineer about gaps, tyres, pace, flags or weather, by tapping or by voice. Add your own Anthropic API key to ask anything.",
    target: ".sv-engineer-fab",
  },
  {
    icon: "inspect",
    title: "Lap times",
    text: "Laps opens the followed driver's lap and sector times, plus session details.",
    target: '.sv-header button[aria-controls="sv-panel"]',
  },
  {
    icon: "sliders",
    title: "Menu",
    text: "Theme, hand tracking and this guide live here. Press P any time for Present mode.",
    target: '.sv-header button[aria-label="App menu"]',
  },
];

interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}
const PAD = 8;
const CARD = { width: 340, gap: 14 };

/** Where the target is on screen (padded), or null when it is missing or hidden. */
function measure(selector: string | undefined): Box | null {
  if (!selector) return null;
  const el = document.querySelector<HTMLElement>(selector);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width === 0 || r.height === 0) return null;
  // Clipped to the screen, so a control taller than the phone (the timing tower) stays framed.
  const top = Math.max(4, r.top - PAD),
    left = Math.max(4, r.left - PAD),
    bottom = Math.min(window.innerHeight - 4, r.bottom + PAD),
    right = Math.min(window.innerWidth - 4, r.right + PAD);
  if (bottom - top < 8 || right - left < 8) return null;
  return { top, left, width: right - left, height: bottom - top };
}

/** Card position next to the spotlight: below if it fits, else above, else centred. */
function place(box: Box | null, cardHeight: number) {
  const vw = window.innerWidth,
    vh = window.innerHeight,
    width = Math.min(CARD.width, vw - 24);
  if (!box) return { left: (vw - width) / 2, top: Math.max(12, (vh - cardHeight) / 2), width };
  const left = Math.min(Math.max(12, box.left + box.width / 2 - width / 2), vw - width - 12);
  const below = box.top + box.height + CARD.gap;
  const above = box.top - CARD.gap - cardHeight;
  if (below + cardHeight <= vh - 12) return { left, top: below, width };
  if (above >= 12) return { left, top: above, width };
  // A tall control (the timing tower): beside it, right then left, vertically centred on it.
  const sideTop = Math.min(Math.max(12, box.top + box.height / 2 - cardHeight / 2), vh - cardHeight - 12);
  if (box.left + box.width + CARD.gap + width <= vw - 12)
    return { left: box.left + box.width + CARD.gap, top: sideTop, width };
  if (box.left - CARD.gap - width >= 12) return { left: box.left - CARD.gap - width, top: sideTop, width };
  return { left, top: Math.max(12, vh - cardHeight - 12), width };
}

/**
 * Guided tour, shown each time the app opens: each step spotlights a real control and puts a
 * short tip beside it. A step whose control is not on screen is shown centred. Back/Next, arrow keys and Escape work; "Don't show again" keeps it closed on later
 * visits, and the app menu reopens it.
 */
export default function QuickGuide({ onClose }: { onClose: (remember: boolean) => void }) {
  const steps = STEPS;
  const [step, setStep] = useState(0);
  const [remember, setRemember] = useState(false);
  const [box, setBox] = useState<Box | null>(null);
  const [cardHeight, setCardHeight] = useState(220);
  const card = useRef<HTMLElement>(null);
  const next = useRef<HTMLButtonElement>(null);
  const current = steps[Math.min(step, steps.length - 1)];
  const last = step === steps.length - 1;

  // Bring the target into view (phones scroll), then follow it while the page moves.
  useLayoutEffect(() => {
    const el = current.target ? document.querySelector<HTMLElement>(current.target) : null;
    // Bring it near the top (below the sticky header on phones, see scroll-margin-top) so the
    // tip fits underneath; instant, so the spotlight never chases a scrolling page.
    (current.scroll ? el?.closest<HTMLElement>(current.scroll) : el)?.scrollIntoView({
      block: "start",
      behavior: "auto",
    });
    let frame = 0;
    const track = () => {
      const b = measure(current.target);
      setBox((old) =>
        old &&
        b &&
        Math.abs(old.top - b.top) < 0.5 &&
        Math.abs(old.left - b.left) < 0.5 &&
        old.width === b.width &&
        old.height === b.height
          ? old
          : b,
      );
      frame = requestAnimationFrame(track);
    };
    track();
    return () => cancelAnimationFrame(frame);
  }, [current]);
  useLayoutEffect(() => {
    if (card.current) setCardHeight(card.current.offsetHeight);
  }, [step, box]);
  useEffect(() => {
    next.current?.focus({ preventScroll: true });
  }, [step]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose(remember);
      if (e.key === "ArrowRight") setStep((s) => Math.min(steps.length - 1, s + 1));
      if (e.key === "ArrowLeft") setStep((s) => Math.max(0, s - 1));
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onClose, remember, steps.length]);

  const at = place(box, cardHeight);
  return (
    <div className="sv-tour" role="presentation">
      {box ? (
        <div
          className="sv-tour-spot"
          style={{ top: box.top, left: box.left, width: box.width, height: box.height }}
          aria-hidden="true"
        />
      ) : (
        <div className="sv-tour-dim" aria-hidden="true" />
      )}
      <section
        ref={card}
        className={"sv-guide sv-tour-card glass" + (box ? "" : " is-centred")}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sv-guide-title"
        style={{ top: at.top, left: at.left, width: at.width }}
        key={step}
      >
        <header>
          <small>
            Guide · {step + 1} of {steps.length}
          </small>
          <button className="sv-icon-button" aria-label="Close guide" onClick={() => onClose(remember)}>
            <Icon name="close" />
          </button>
        </header>
        <div className="sv-tour-body" aria-live="polite">
          <span className="sv-guide-icon">
            <Icon name={current.icon} size={22} />
          </span>
          <div>
            <h2 id="sv-guide-title">{current.title}</h2>
            <p>{current.text}</p>
          </div>
        </div>
        <div className="sv-guide-dots" role="tablist" aria-label="Guide steps">
          {steps.map((s, i) => (
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
              {last ? "Start watching" : step === 0 ? "Show me" : "Next"}
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}
