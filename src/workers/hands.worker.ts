import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";
import type { HandRequest, HandResponse } from "../services/handProtocol";
const channel = self as unknown as {
  onmessage: ((e: MessageEvent<HandRequest>) => void) | null;
  postMessage: (message: HandResponse) => void;
};
let detector: HandLandmarker | null = null;
channel.onmessage = async ({ data }) => {
  try {
    if (data.type === "init") {
      const files = await FilesetResolver.forVisionTasks(
        new URL("wasm", data.baseUrl).href,
        true,
      );
      detector = await HandLandmarker.createFromOptions(files, {
        baseOptions: {
          modelAssetPath: new URL("hand_landmarker.task", data.baseUrl).href,
          delegate: "CPU",
        },
        runningMode: "VIDEO",
        numHands: 2,
        minHandDetectionConfidence: 0.6,
        minHandPresenceConfidence: 0.6,
        minTrackingConfidence: 0.6,
      });
      const blank = new OffscreenCanvas(64, 64);
      const context = blank.getContext("2d");
      if (!context) throw Error("Canvas unavailable");
      context.fillStyle = "#202020";
      context.fillRect(0, 0, 64, 64);
      const result = detector.detectForVideo(blank, 0);
      channel.postMessage({
        type: "ready",
        emptyFrameHands: result.landmarks.length,
      });
    } else {
      try {
        if (!detector) throw Error("Model unavailable");
        const start = performance.now();
        const result = detector.detectForVideo(data.frame, data.timestamp);
        channel.postMessage({
          type: "result",
          inferenceMs: performance.now() - start,
          hands: result.landmarks.map((points, i) => ({
            points,
            label: result.handedness[i]?.[0]?.categoryName ?? "Unknown",
            score: result.handedness[i]?.[0]?.score ?? 0,
          })),
        });
      } finally {
        data.frame.close();
      }
    }
  } catch {
    channel.postMessage({
      type: "error",
      message:
        "The local hand-tracking engine could not process this frame. Stop and retry, or use a current browser with WebAssembly and worker support.",
    });
  }
};
