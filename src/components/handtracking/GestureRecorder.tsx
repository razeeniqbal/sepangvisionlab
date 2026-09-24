import { useEffect, useRef, useState } from "react";
import {
  captureFrame,
  clipProblem,
  datasetExport,
  gestureLabels,
  instructions,
  type GestureClip,
  type GestureLabel,
} from "../../domain/gestureDataset";
import type { TrackedHand } from "../../domain/hands";
type Pending = { clip: GestureClip; start: number };
export default function GestureRecorder({
  hands,
  live,
  latency,
  aspect,
  enabled,
  onEnabled,
}: {
  hands: TrackedHand[];
  live: boolean;
  latency: number | null;
  aspect: number;
  enabled: boolean;
  onEnabled: (v: boolean) => void;
}) {
  const [label, setLabel] = useState<GestureLabel>("neutral"),
    [clips, setClips] = useState<GestureClip[]>([]),
    [session, setSession] = useState(() => crypto.randomUUID());
  const [recording, setRecording] = useState(false),
    [message, setMessage] = useState("No recordings yet.");
  const pending = useRef<Pending | null>(null);
  const cancel = (text: string) => {
    pending.current = null;
    setRecording(false);
    setMessage(text);
  };
  useEffect(() => {
    if (!live || !enabled) {
      if (pending.current)
        cancel(
          "Recording discarded because camera or collection mode stopped.",
        );
    }
  }, [live, enabled]);
  useEffect(() => {
    const p = pending.current;
    if (!p || !live || !enabled) return;
    const ms = performance.now() - p.start;
    if (ms < 0 || ms > 2000) return;
    if (latency === null || latency > 350 || aspect !== p.clip.aspect) {
      cancel(
        "Recording discarded: tracking was too slow or camera dimensions changed.",
      );
      return;
    }
    const f = captureFrame(hands, ms);
    if (!f) {
      cancel("Recording discarded: keep clear hands visible throughout.");
      return;
    }
    if (p.clip.frames.length >= 40) {
      cancel("Recording discarded: frame limit exceeded.");
      return;
    }
    p.clip.frames.push(f);
  }, [hands, live, enabled, latency, aspect]);
  useEffect(() => {
    const timer = window.setInterval(() => {
      const p = pending.current;
      if (!p) return;
      const elapsed = performance.now() - p.start;
      if (elapsed < 0) {
        setMessage(
          "Get ready… recording starts in " +
            Math.ceil(-elapsed / 1000) +
            " second.",
        );
        return;
      }
      if (elapsed < 2000) {
        setMessage(
          "Recording " +
            label.replaceAll("_", " ") +
            " · " +
            (2 - elapsed / 1000).toFixed(1) +
            "s left",
        );
        return;
      }
      const problem = clipProblem(p.clip);
      pending.current = null;
      setRecording(false);
      if (problem) setMessage("Clip discarded: " + problem);
      else {
        setClips((previous) => [...previous, p.clip]);
        setMessage(
          "Clip saved in memory. Review your label, then export before leaving.",
        );
      }
    }, 100);
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && pending.current) cancel("Recording discarded.");
    };
    const hidden = () => {
      if (document.hidden && pending.current)
        cancel("Recording discarded because the tab was hidden.");
    };
    document.addEventListener("keydown", escape);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      clearInterval(timer);
      document.removeEventListener("keydown", escape);
      document.removeEventListener("visibilitychange", hidden);
    };
  }, [label]);
  const download = () => {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(datasetExport(clips))], {
        type: "application/json",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "sepang-gestures-" + session + ".json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage(
      "Dataset exported. Keep this file for local training; it contains hand landmark coordinates.",
    );
  };
  return (
    <section className="gesture-controls" aria-label="Gesture dataset recorder">
      <h3>Gesture dataset · M15</h3>
      <p>
        Record labeled two-second examples for model training. Only landmark
        coordinates and hand estimates are kept, not images or audio. Clips stay
        in memory until you explicitly export a local file. Switching sessions
        or reloading clears them.
      </p>
      <label>
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onEnabled(e.target.checked)}
        />{" "}
        Collection mode: I agree to record my hand landmarks. This disables
        gesture actions.
      </label>
      <div className="hand-actions">
        <label>
          Gesture label{" "}
          <select
            value={label}
            disabled={recording}
            onChange={(e) => setLabel(e.target.value as GestureLabel)}
          >
            {gestureLabels.map((g) => (
              <option key={g} value={g}>
                {g.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </label>
        <button
          disabled={!enabled || !live || recording || clips.length >= 240}
          onClick={() => {
            pending.current = {
              start: performance.now() + 1000,
              clip: {
                id: crypto.randomUUID(),
                sessionId: session,
                label,
                aspect,
                frames: [],
              },
            };
            setRecording(true);
            setMessage("Get ready…");
          }}
        >
          Record 2-second clip
        </button>
        <button
          disabled={!recording}
          onClick={() => cancel("Recording discarded.")}
        >
          Cancel recording
        </button>
        <button disabled={!clips.length || recording} onClick={download}>
          Export landmark dataset
        </button>
        <button
          disabled={!clips.length || recording}
          onClick={() => {
            setClips((c) => c.slice(0, -1));
            setMessage("Last clip removed.");
          }}
        >
          Remove last clip
        </button>
        <button
          disabled={recording}
          onClick={() => {
            setSession(crypto.randomUUID());
            setMessage(
              "New recording session. Previous clips remain available for export.",
            );
          }}
        >
          New recording session
        </button>
      </div>
      <p>{instructions[label]}</p>
      <p role="status" data-testid="dataset-status">
        {message}
      </p>
      <p>
        {clips.length} / 240 clips · current session {session.slice(0, 8)}.
        Change lighting, position or take a separate sitting before starting a
        new session. Collect every label in at least five independent sessions;
        use at least two clips per label per session. Do not split one burst
        across session IDs.
      </p>
      <table>
        <thead>
          <tr>
            <th>Label</th>
            <th>Clips</th>
            <th>Sessions</th>
          </tr>
        </thead>
        <tbody>
          {gestureLabels.map((g) => (
            <tr key={g}>
              <th>{g.replaceAll("_", " ")}</th>
              <td>{clips.filter((c) => c.label === g).length}</td>
              <td>
                {
                  new Set(
                    clips.filter((c) => c.label === g).map((c) => c.sessionId),
                  ).size
                }
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        No trained gesture model is installed. Rule-based controls remain the
        active method outside collection mode. Training and evaluation require
        exported real examples; no accuracy is claimed yet.
      </p>
    </section>
  );
}
