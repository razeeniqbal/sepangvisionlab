import { validHand, type TrackedHand } from "./hands.ts";
export const gestureLabels = [
  "neutral",
  "point",
  "pinch",
  "grab",
  "rotate",
  "zoom",
  "swipe_left",
  "swipe_right",
] as const;
export type GestureLabel = (typeof gestureLabels)[number];
export interface GestureFrame {
  ms: number;
  hands: TrackedHand[];
}
export interface GestureClip {
  id: string;
  sessionId: string;
  label: GestureLabel;
  aspect: number;
  frames: GestureFrame[];
}
export const instructions: Record<GestureLabel, string> = {
  neutral: "Keep one relaxed hand visible without making a command gesture.",
  point:
    "Hold one index finger pointing upward, with the other fingers folded.",
  pinch: "Hold one thumb and index fingertip together.",
  grab: "Hold one closed fist.",
  rotate:
    "Show two open hands and rotate the line between them during the recording.",
  zoom: "Show two open hands and move them apart or together during the recording.",
  swipe_left: "Move one open hand to the LEFT in the mirrored preview.",
  swipe_right: "Move one open hand to the RIGHT in the mirrored preview.",
};
export function captureFrame(
  hands: TrackedHand[],
  ms: number,
): GestureFrame | null {
  if (
    !Number.isFinite(ms) ||
    ms < 0 ||
    ms > 2200 ||
    hands.length < 1 ||
    hands.length > 2 ||
    hands.some(
      (h) =>
        !validHand(h) ||
        h.score < 0.8 ||
        !["Left", "Right"].includes(h.label) ||
        h.points.some((p) => [p.x, p.y, p.z].some((v) => Math.abs(v) > 10)),
    ) ||
    new Set(hands.map((h) => h.label)).size !== hands.length
  )
    return null;
  return {
    ms,
    hands: [...hands]
      .sort((a, b) => a.label.localeCompare(b.label))
      .map((h) => ({ ...h, points: h.points.map((p) => ({ ...p })) })),
  };
}
export function clipProblem(clip: GestureClip): string | null {
  if (
    !gestureLabels.includes(clip.label) ||
    !Number.isFinite(clip.aspect) ||
    clip.aspect < 0.25 ||
    clip.aspect > 4
  )
    return "Invalid label or camera dimensions.";
  if (clip.frames.length < 12 || clip.frames.length > 40)
    return "Need 12–40 clear frames. Try again in brighter light.";
  if (
    clip.frames.some((f) =>
      f.hands.some(
        (h) =>
          h.points.length === 21 &&
          Math.hypot(
            (h.points[5].x - h.points[17].x) * clip.aspect,
            h.points[5].y - h.points[17].y,
          ) < 0.025,
      ),
    )
  )
    return "Move closer: hands are too small to normalize reliably.";
  const frames = clip.frames,
    expected = ["rotate", "zoom"].includes(clip.label) ? 2 : 1;
  if (
    frames.some(
      (f) => !captureFrame(f.hands, f.ms) || f.hands.length !== expected,
    )
  )
    return `Keep ${expected} clear hand${expected === 2 ? "s" : ""} visible throughout.`;
  if (frames[frames.length - 1].ms - frames[0].ms < 1500)
    return "Recording coverage was too short. Try again.";
  for (let i = 1; i < frames.length; i++) {
    const gap = frames[i].ms - frames[i - 1].ms;
    if (
      gap <= 0 ||
      gap > 350 ||
      frames[i].hands.map((h) => h.label).join() !==
        frames[0].hands.map((h) => h.label).join()
    )
      return "Tracking was interrupted or hand identity changed. Try again.";
  }
  return null;
}
export function datasetExport(clips: GestureClip[]) {
  if (!clips.length || clips.length > 240 || clips.some((c) => clipProblem(c)))
    throw Error("Only complete, valid clips can be exported.");
  return {
    schemaVersion: 1,
    kind: "sepang-gesture-landmarks",
    coordinateSystem: "unmirrored-camera-normalized",
    source: "user-labeled-camera",
    clips,
  };
}
