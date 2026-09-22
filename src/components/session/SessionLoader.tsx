import { useEffect, useState, type ReactNode } from "react";
import { loadReplay, type ReplayData } from "../../services/raceState";
export default function SessionLoader({
  children,
}: {
  children: (data: ReplayData) => ReactNode;
}) {
  const [data, setData] = useState<ReplayData | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setError("");
    const timeout = setTimeout(() => controller.abort(), 15000);
    loadReplay(controller.signal)
      .then((result) => {
        if (active) setData(result);
      })
      .catch(() => {
        if (active)
          setError(
            "The session could not be loaded. Check that the local session service is running, then retry.",
          );
      })
      .finally(() => clearTimeout(timeout));
    return () => {
      active = false;
      controller.abort();
      clearTimeout(timeout);
    };
  }, [attempt]);
  if (data) return children(data);
  return (
    <div className="session-loading">
      <img src="/assets/brands/svl-concept.png" alt="Sepang Vision Lab" />
      <h1>{error ? "Session unavailable" : "Loading Sepang session"}</h1>
      <p role="status">{error || "Preparing the synthetic replay…"}</p>
      {error && (
        <button onClick={() => setAttempt((value) => value + 1)}>Retry</button>
      )}
    </div>
  );
}
