import type { TrackedHand } from "../domain/hands";
export type HandRequest =
  | { type: "init"; baseUrl: string }
  | { type: "frame"; frame: ImageBitmap; timestamp: number };
export type HandResponse =
  | { type: "ready"; emptyFrameHands: number }
  | { type: "result"; hands: TrackedHand[]; inferenceMs: number }
  | { type: "error"; message: string };
