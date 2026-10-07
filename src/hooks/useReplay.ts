import { useGestureReceiver } from "../components/handtracking/GestureContext";
import { useEffect, useRef, useState } from "react";
import { advanceReplay, clampTime, SESSION_DURATION } from "../domain/replay";
export default function useReplay(
  duration = SESSION_DURATION,
  autoplay = true,
) {
  const clock = useRef(0);
  const [time, setTime] = useState(0);
  const [running, setRunning] = useState(autoplay);
  const [speed, setSpeed] = useState(5);
  useEffect(() => {
    if (!running) return;
    let frame = 0;
    let previous: number | null = null;
    let published = 0;
    const visibility = () => {
      previous = null;
    };
    document.addEventListener("visibilitychange", visibility);
    const tick = (now: number) => {
      if (!document.hidden && previous !== null) {
        clock.current = advanceReplay(
          clock.current,
          (now - previous) / 1000,
          speed,
          duration,
        );
        if (now - published >= 100 || clock.current === duration) {
          setTime(clock.current);
          published = now;
        }
        if (clock.current === duration) {
          setRunning(false);
          return;
        }
      }
      previous = document.hidden ? null : now;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [running, speed, duration]);
  /** Jump to a time. Playback carries on if it was running, unless `pause` is set. */
  function seek(value: number, pause = false) {
    clock.current = clampTime(value, duration);
    setTime(clock.current);
    if (pause) setRunning(false);
  }
  function toggle() {
    if (running) {
      setTime(clock.current);
      setRunning(false);
    } else {
      if (clock.current === duration) {
        clock.current = 0;
        setTime(0);
      }
      setRunning(true);
    }
  }
  useGestureReceiver((action) => {
    if (action === "rewind" || action === "forward") {
      seek(clock.current + (action === "rewind" ? -10 : 10));
      return true;
    }
    if (action === "cancel") {
      seek(clock.current, true);
      return true;
    }
    if (action === "playPause") {
      toggle();
      return true;
    }
    return false;
  });
  return { clock, time, running, speed, setSpeed, seek, toggle };
}
