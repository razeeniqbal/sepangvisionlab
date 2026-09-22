import { useEffect, useRef, useState } from "react";
import {
  cameraError,
  ResourceScope,
  validHand,
  type TrackedHand,
} from "../domain/hands";
import type { HandRequest, HandResponse } from "../services/handProtocol";
export type HandStatus =
  | "off"
  | "loading"
  | "checking"
  | "ready"
  | "requesting"
  | "live"
  | "error";
export default function useHandTracking() {
  const video = useRef<HTMLVideoElement>(null);
  const scope = useRef<ResourceScope | null>(null);
  const [status, setStatus] = useState<HandStatus>("off"),
    [message, setMessage] = useState("Camera is off.");
  const [hands, setHands] = useState<TrackedHand[]>([]),
    [latency, setLatency] = useState<number | null>(null);
  const [size, setSize] = useState({ width: 640, height: 480 });
  function stop(reason = "Camera stopped. Video and landmarks cleared.") {
    scope.current?.close();
    scope.current = null;
    if (video.current) {
      video.current.pause();
      video.current.srcObject = null;
    }
    setHands([]);
    setLatency(null);
    setStatus("off");
    setMessage(reason);
  }
  useEffect(() => {
    const hide = () => {
      if (document.hidden)
        stop(
          "Camera stopped when this tab was hidden. Enable it again to resume.",
        );
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") stop();
    };
    document.addEventListener("visibilitychange", hide);
    document.addEventListener("keydown", escape);
    return () => {
      scope.current?.close();
      scope.current = null;
      document.removeEventListener("visibilitychange", hide);
      document.removeEventListener("keydown", escape);
    };
  }, []);
  async function start(camera: boolean) {
    stop();
    const run = new ResourceScope();
    scope.current = run;
    setStatus(camera ? "loading" : "checking");
    setMessage("Loading local hand-tracking model…");
    const current = () => run.active && scope.current === run;
    const fail = (text: string) => {
      if (!current()) return;
      run.close();
      scope.current = null;
      if (video.current) {
        video.current.pause();
        video.current.srcObject = null;
      }
      setHands([]);
      setLatency(null);
      setStatus("error");
      setMessage(text);
    };
    let stageTimer = 0;
    const timeout = (text: string, ms: number) => {
      clearTimeout(stageTimer);
      stageTimer = window.setTimeout(() => fail(text), ms);
    };
    run.own(() => clearTimeout(stageTimer));
    try {
      if (
        !window.isSecureContext ||
        typeof Worker === "undefined" ||
        typeof createImageBitmap === "undefined" ||
        typeof OffscreenCanvas === "undefined"
      )
        throw Error("Required browser features unavailable");
      const worker = new Worker(
        new URL("../workers/hands.worker.ts", import.meta.url),
        { type: "module" },
      );
      run.own(() => worker.terminate());
      let busy = false,
        raf = 0,
        lastSent = -Infinity,
        lastTime = -1,
        lastReply = performance.now();
      run.own(() => cancelAnimationFrame(raf));
      worker.onerror = () =>
        fail(
          "The tracking worker could not start. Retry the engine check or reload the page.",
        );
      worker.onmessage = async ({ data }: MessageEvent<HandResponse>) => {
        if (!current()) return;
        if (data.type === "error") {
          fail(data.message);
          return;
        }
        if (data.type === "result") {
          busy = false;
          lastReply = performance.now();
          setHands(data.hands.filter(validHand));
          setLatency(data.inferenceMs);
          return;
        }
        clearTimeout(stageTimer);
        if (!camera) {
          run.close();
          scope.current = null;
          setStatus("ready");
          setMessage(
            `Engine check passed: local model processed a blank frame (${data.emptyFrameHands} hands). Camera stayed off.`,
          );
          return;
        }
        try {
          if (!navigator.mediaDevices?.getUserMedia)
            throw Error("Camera API unavailable");
          setStatus("requesting");
          setMessage("Waiting for camera permission…");
          timeout(
            "Camera request timed out. If a permission prompt remains open, dismiss it and retry.",
            30000,
          );
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: {
              width: { ideal: 640 },
              height: { ideal: 480 },
              frameRate: { ideal: 20, max: 30 },
              facingMode: "user",
            },
          });
          run.own(() => stream.getTracks().forEach((t) => t.stop()));
          if (!current()) return;
          for (const track of stream.getVideoTracks())
            track.addEventListener(
              "ended",
              () =>
                fail(
                  "Camera disconnected or permission was removed. Enable it again to retry.",
                ),
              { once: true },
            );
          const element = video.current;
          if (!element) throw Error("Video unavailable");
          element.srcObject = stream;
          run.own(() => {
            element.pause();
            element.srcObject = null;
          });
          await element.play();
          if (!current()) return;
          clearTimeout(stageTimer);
          setStatus("live");
          setMessage(
            "Live tracking · up to two hands. Press Escape or Stop camera to end.",
          );
          lastReply = performance.now();
          const tick = async (now: number) => {
            if (!current()) return;
            raf = requestAnimationFrame(tick);
            if (now - lastReply > 10000) {
              fail(
                "Camera frames or tracking stopped responding. Enable camera to retry.",
              );
              return;
            }
            if (
              busy ||
              now - lastSent < 1000 / 15 ||
              element.readyState < 2 ||
              element.currentTime === lastTime
            )
              return;
            busy = true;
            lastSent = now;
            lastTime = element.currentTime;
            try {
              const frame = await createImageBitmap(element);
              if (!current()) {
                frame.close();
                return;
              }
              setSize({ width: frame.width, height: frame.height });
              const request: HandRequest = {
                type: "frame",
                frame,
                timestamp: now,
              };
              try {
                worker.postMessage(request, [frame]);
              } catch (error) {
                frame.close();
                throw error;
              }
            } catch (error) {
              fail(cameraError(error));
            }
          };
          raf = requestAnimationFrame(tick);
        } catch (error) {
          fail(cameraError(error));
        }
      };
      timeout(
        "The local model took too long to load. Check the local service, then retry.",
        45000,
      );
      const request: HandRequest = {
        type: "init",
        baseUrl: new URL("/vendor/mediapipe/", window.location.href).href,
      };
      worker.postMessage(request);
    } catch (error) {
      fail(cameraError(error));
    }
  }
  return { video, status, message, hands, latency, size, start, stop };
}
