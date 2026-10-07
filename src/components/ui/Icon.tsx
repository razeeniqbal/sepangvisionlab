// Small inline icon set (24×24 strokes, currentColor). No icon library dependency.
const PATHS = {
  play: "M7 4.5v15l12-7.5z",
  pause: "M7 4h3.5v16H7zM13.5 4H17v16h-3.5z",
  start: "M6 5v14M19 5 9 12l10 7z",
  back: "M11 6 5 12l6 6M19 6l-6 6 6 6",
  forward: "M13 6l6 6-6 6M5 6l6 6-6 6",
  chevronDown: "m6 9 6 6 6-6",
  chevronUp: "m6 15 6-6 6 6",
  menu: "M5 12h.01M12 12h.01M19 12h.01",
  sliders: "M4 7h10M18 7h2M4 17h4M12 17h8M14 4v6M8 14v6",
  fullscreen: "M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5",
  present: "M3 5h18v11H3zM8 20h8M12 16v4",
  hand: "M8 13V5.5a1.5 1.5 0 0 1 3 0V12M11 11V4.5a1.5 1.5 0 0 1 3 0V12M14 11.5V6a1.5 1.5 0 0 1 3 0v8a6 6 0 0 1-6 6h-1a6 6 0 0 1-5-2.7L3.6 14a1.5 1.5 0 0 1 2.4-1.8L8 14",
  list: "M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01",
  close: "M6 6l12 12M18 6 6 18",
  map: "M9 4 3 6.5v13.5l6-2.5 6 2.5 6-2.5V4l-6 2.5zM9 4v13.5M15 6.5V20",
  chase: "M5 17h14l-2-6H7zM7 11l2-4h6l2 4M7 20v-3M17 20v-3",
  onboard: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM3.5 10.5 9 12M20.5 10.5 15 12M12 15v6",
  tv: "M3 7h18v12H3zM8 3l4 4 4-4",
  heli: "M3 6h18M12 6v3M6 13a6 4 0 0 0 12 0 6 4 0 0 0-12 0zM18 13h3M10 17l-1 3M14 17l1 3",
  inspect: "M12 5c-5 0-9 4.5-10 7 1 2.5 5 7 10 7s9-4.5 10-7c-1-2.5-5-7-10-7zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z",
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
  rotateLeft: "M4 4v6h6M5 15a7 7 0 1 0 2-7.6L4 10",
  rotateRight: "M20 4v6h-6M19 15a7 7 0 1 1-2-7.6L20 10",
  info: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 11v6M12 7.5h.01",
  headset: "M4 14v-2a8 8 0 0 1 16 0v2M4 14h3v6H5a1 1 0 0 1-1-1zM20 14h-3v6h2a1 1 0 0 0 1-1zM17 20a4 4 0 0 1-4 2h-1",
  mic: "M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0M12 18v3",
  send: "M4 12 20 4l-5 16-3-7zM12 13l8-9",
  speaker: "M4 9h4l5-4v14l-5-4H4zM16.5 9a4 4 0 0 1 0 6M19 6.5a7.5 7.5 0 0 1 0 11",
  key: "M14 10a4 4 0 1 1-8 0 4 4 0 0 1 8 0zM13 12l8 8M17 16l2-2M19 18l2-2",
} as const;
export type IconName = keyof typeof PATHS;

export default function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const filled = name === "play" || name === "pause";
  return (
    <svg
      className="sv-icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill={filled ? "currentColor" : "none"}
      stroke={filled ? "none" : "currentColor"}
      strokeWidth={name === "menu" ? 3.2 : 1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
