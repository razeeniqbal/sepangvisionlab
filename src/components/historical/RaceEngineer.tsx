import { useEffect, useRef, useState } from "react";
import {
  parseStrategy,
  type StrategyResult,
  type StrategyRequest,
} from "../../services/strategy";
type Answer = {
  source: string;
  question: string;
  strategy: StrategyResult;
  focus: string[];
  explanation: string[];
  limitations: string[];
};
export default function RaceEngineer({
  strategy,
}: {
  strategy: StrategyResult;
}) {
  const [configured, setConfigured] = useState(false),
    [consent, setConsent] = useState(false),
    [question, setQuestion] = useState("What happens if I pit at this branch?");
  const [answer, setAnswer] = useState<Answer | null>(null),
    [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const active = useRef<AbortController | null>(null);
  useEffect(() => {
    const c = new AbortController();
    fetch("/api/v1/engineer/status", { signal: c.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setConfigured(d?.aiConfigured === true))
      .catch(() => {});
    return () => {
      c.abort();
      active.current?.abort();
    };
  }, []);
  async function explain(mode: "local" | "ai") {
    active.current?.abort();
    const c = new AbortController();
    active.current = c;
    setPending(true);
    setAnswer(null);
    setError("");
    const timer = setTimeout(() => c.abort(), 75000);
    const request: StrategyRequest = {
      driverId: strategy.driverId,
      completedLaps: strategy.branchLap,
      delayedPitLap:
        strategy.plans.find((p) => p.id === "later")?.pitLap ?? null,
      assumptions: strategy.assumptions,
    };
    try {
      const response = await fetch("/api/v1/engineer/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ strategy: request, mode, question, consent }),
        signal: c.signal,
      });
      const data = await response.json();
      if (!response.ok)
        throw Error(
          typeof data.detail === "string"
            ? data.detail
            : "Explanation unavailable.",
        );
      const result = parseStrategy(data.strategy, request);
      if (
        data.source !==
          (mode === "local"
            ? "local-simulator-explanation"
            : "ai-selected-simulator-evidence") ||
        typeof data.question !== "string" ||
        !Array.isArray(data.focus) ||
        !data.focus.length ||
        data.focus.some(
          (id: unknown) => !result.plans.some((p) => p.id === id),
        ) ||
        ![data.explanation, data.limitations].every(
          (a) =>
            Array.isArray(a) &&
            a.length > 0 &&
            a.every((x) => typeof x === "string"),
        )
      )
        throw Error("Invalid engineer response.");
      if (active.current === c && !c.signal.aborted)
        setAnswer({ ...data, strategy: result });
    } catch (e) {
      if (active.current === c)
        setError(
          c.signal.aborted
            ? "Request stopped or timed out. You can retry."
            : e instanceof Error
              ? e.message
              : "Explanation unavailable.",
        );
    } finally {
      clearTimeout(timer);
      if (active.current === c) setPending(false);
    }
  }
  return (
    <section className="gesture-controls" aria-label="Race engineer">
      <h3>Race engineer · SIMULATION</h3>
      <p>
        Captured branch: {strategy.driverName}, after lap {strategy.branchLap}.
        Each request reruns these exact assumptions. Changing the branch or
        comparison clears this answer.
      </p>
      <button disabled={pending} onClick={() => void explain("local")}>
        Explain comparison locally
      </button>
      <p>
        {configured
          ? "AI connection configured."
          : "AI is not configured. Local simulator explanations are available."}
      </p>
      <label>
        Question about this comparison{" "}
        <textarea
          maxLength={500}
          rows={2}
          value={question}
          disabled={pending}
          onChange={(e) => {
            setQuestion(e.target.value);
            setAnswer(null);
          }}
        />
      </label>
      <p>
        Ask about staying out, pitting at the branch or the configured delayed
        stop. Change costs and timing in Strategy Lab first. Finish positions
        and weather transitions are outside this assistant’s scope.
      </p>
      <label>
        <input
          type="checkbox"
          checked={consent}
          disabled={!configured || pending}
          onChange={(e) => setConsent(e.target.checked)}
        />{" "}
        Send this question, captured race context and simulation results to
        OpenAI for AI interpretation.
      </label>
      <div className="hand-actions">
        <button
          disabled={!configured || !consent || !question.trim() || pending}
          onClick={() => void explain("ai")}
        >
          Ask AI race engineer
        </button>
        <button disabled={!pending} onClick={() => active.current?.abort()}>
          Cancel explanation
        </button>
      </div>
      {pending && <p role="status">Running the captured comparison…</p>}
      {error && <p role="alert">{error}</p>}
      {answer && (
        <div data-testid="engineer-answer">
          <h4>
            {answer.source === "local-simulator-explanation"
              ? "Local simulator explanation · no AI"
              : "AI-selected evidence · simulator-derived explanation"}
          </h4>
          <p>{answer.question}</p>
          {answer.explanation.map((line, i) => (
            <p key={i}>{line}</p>
          ))}
          <details>
            <summary>Simulation evidence</summary>
            <table>
              <thead>
                <tr>
                  <th>Plan</th>
                  <th>Remaining seconds</th>
                  <th>Delta to staying out</th>
                </tr>
              </thead>
              <tbody>
                {answer.strategy.plans.map((p) => (
                  <tr key={p.id}>
                    <th>{p.label}</th>
                    <td>{p.remainingSeconds.toFixed(3)}</td>
                    <td>{p.deltaToStay.toFixed(3)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
          {answer.limitations.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      )}
    </section>
  );
}
