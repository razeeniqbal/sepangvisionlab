import { useEffect, useRef, useState } from "react";
import { PRESETS, matchPreset, presetAnswer, type EngineerBrief, type PresetId } from "../../domain/engineer";
import { EngineerError, askClaude, readKey, writeKey } from "../../services/claudeEngineer";
import Icon from "../ui/Icon";

// Minimal Web Speech recognition types (the DOM library has the result types, not the class).
interface Recognition {
  lang: string;
  interimResults: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start(): void;
  stop(): void;
}
type RecognitionClass = new () => Recognition;
const speechWindow = window as unknown as { SpeechRecognition?: RecognitionClass; webkitSpeechRecognition?: RecognitionClass };
const Recognizer = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;

interface Answer {
  question: string;
  text: string;
  /** "data": answered by rules from the recorded data; "claude": by Claude from the same data. */
  source: "data" | "claude" | "note";
}

/** A short two-tone radio blip before the engineer speaks. */
let blipContext: AudioContext | null = null;
function radioBlip() {
  try {
    blipContext ??= new AudioContext();
    const ctx = blipContext,
      now = ctx.currentTime;
    [1150, 1500].forEach((f, i) => {
      const o = ctx.createOscillator(),
        g = ctx.createGain();
      o.type = "square";
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, now + i * 0.07);
      g.gain.exponentialRampToValueAtTime(0.04, now + i * 0.07 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.07 + 0.06);
      o.connect(g).connect(ctx.destination);
      o.start(now + i * 0.07);
      o.stop(now + i * 0.07 + 0.07);
    });
  } catch {
    // No audio device: silent.
  }
}

function speak(text: string) {
  const synth = window.speechSynthesis;
  if (!synth) return;
  synth.cancel();
  radioBlip();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 1.08;
  u.pitch = 0.95;
  const voice = synth.getVoices().find((v) => v.lang === "en-GB") ?? synth.getVoices().find((v) => v.lang.startsWith("en"));
  if (voice) u.voice = voice;
  window.setTimeout(() => synth.speak(u), 160);
}

/**
 * The race engineer: a floating radio button that opens a popout. Preset questions are answered
 * from the recorded data with no key; free questions (typed or spoken) go to Claude with the
 * viewer's own API key. Each answer replaces the last: there is no conversation history.
 */
export default function RaceEngineer({ brief }: { brief: () => EngineerBrief }) {
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState(false);
  const [key, setKey] = useState(readKey);
  const [draft, setDraft] = useState("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [voice, setVoice] = useState(true);
  const pending = useRef<AbortController | null>(null);
  const recognition = useRef<Recognition | null>(null);
  const briefRef = useRef(brief);
  briefRef.current = brief;

  const stopAll = () => {
    pending.current?.abort();
    recognition.current?.stop();
    window.speechSynthesis?.cancel();
  };
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  useEffect(() => {
    if (!open) stopAll();
  }, [open]);
  useEffect(() => stopAll, []);

  const reply = (a: Answer) => {
    setAnswer(a);
    if (voice && a.source !== "note") speak(a.text);
  };

  const ask = async (q: string, preset?: PresetId) => {
    const text = q.trim();
    if (!text) return;
    pending.current?.abort();
    window.speechSynthesis?.cancel();
    setQuestion("");
    const b = briefRef.current();
    const id = preset ?? (key ? null : matchPreset(text));
    if (id) return reply({ question: text, text: presetAnswer(id, b), source: "data" });
    if (!key)
      return reply({
        question: text,
        text: "Free questions need your Anthropic API key (Settings). The preset questions work without one.",
        source: "note",
      });
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    setAnswer({ question: text, text: "", source: "claude" });
    try {
      reply({ question: text, text: await askClaude(key, b, text, controller.signal), source: "claude" });
    } catch (e) {
      if (controller.signal.aborted) return;
      reply({
        question: text,
        text: e instanceof EngineerError ? e.message : "Something went wrong. Try again.",
        source: "note",
      });
    } finally {
      if (pending.current === controller) {
        pending.current = null;
        setBusy(false);
      }
    }
  };

  const listen = () => {
    if (!Recognizer) return;
    if (listening) return recognition.current?.stop();
    const r = new Recognizer();
    r.lang = "en-GB";
    r.interimResults = false;
    r.onresult = (e) => {
      const said = e.results[0]?.[0]?.transcript ?? "";
      setQuestion(said);
      void ask(said);
    };
    r.onend = r.onerror = () => setListening(false);
    recognition.current = r;
    window.speechSynthesis?.cancel();
    setListening(true);
    r.start();
  };

  const saveKey = (value: string) => {
    writeKey(value);
    setKey(value);
    setDraft("");
    setSettings(false);
  };

  return (
    <div className={"sv-engineer" + (open ? " is-open" : "")}>
      {open && (
        <section className="sv-engineer-panel glass" role="dialog" aria-label="Race engineer">
          <header className="sv-engineer-head">
            <span className="sv-engineer-badge">
              <Icon name="headset" />
            </span>
            <div>
              <h2>Race engineer</h2>
              <p>
                {brief().driver.name} · {key ? "Claude + recorded data" : "Recorded data only"}
              </p>
            </div>
            <button
              className="sv-icon-button"
              aria-label={voice ? "Mute the engineer's voice" : "Speak replies aloud"}
              aria-pressed={voice}
              onClick={() => {
                if (voice) window.speechSynthesis?.cancel();
                setVoice(!voice);
              }}
            >
              <Icon name="speaker" />
            </button>
            <button
              className="sv-icon-button"
              aria-label="API key settings"
              aria-pressed={settings}
              onClick={() => setSettings(!settings)}
            >
              <Icon name="key" />
            </button>
            <button className="sv-icon-button" aria-label="Close race engineer" onClick={() => setOpen(false)}>
              <Icon name="close" />
            </button>
          </header>

          {settings ? (
            <form
              className="sv-engineer-settings"
              onSubmit={(e) => {
                e.preventDefault();
                if (draft.trim()) saveKey(draft.trim());
              }}
            >
              <h3>Anthropic API key (optional)</h3>
              <p>
                Lets you ask anything, typed or spoken. Answers come from Claude using only this moment's recorded
                data. The key is kept in this browser only and sent only to the Anthropic API; each question is
                billed to your account. Use a key with a spending limit.
              </p>
              <input
                type="password"
                autoComplete="off"
                spellCheck={false}
                placeholder={key ? "Key saved · paste a new one to replace it" : "sk-ant-..."}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                aria-label="Anthropic API key"
              />
              <div className="sv-row">
                <button className="sv-button is-primary" type="submit" disabled={!draft.trim()}>
                  Save key
                </button>
                {key && (
                  <button className="sv-button" type="button" onClick={() => saveKey("")}>
                    Remove key
                  </button>
                )}
              </div>
            </form>
          ) : (
            <>
              <div className="sv-engineer-answer" aria-live="polite">
                {answer ? (
                  <>
                    <p className="sv-engineer-q">{answer.question}</p>
                    {busy && !answer.text ? (
                      <p className="sv-engineer-wait">
                        <i />
                        <i />
                        <i /> On the radio...
                      </p>
                    ) : (
                      <p className={"sv-engineer-a" + (answer.source === "note" ? " is-note" : "")}>{answer.text}</p>
                    )}
                    {answer.source !== "note" && answer.text && (
                      <small>{answer.source === "claude" ? "Claude, from recorded data" : "From recorded data"}</small>
                    )}
                  </>
                ) : (
                  <p className="sv-engineer-hint">
                    Ask about gaps, tyres, pace, flags or the weather for the car you follow. Each answer replaces
                    the last.
                  </p>
                )}
              </div>
              <div className="sv-engineer-presets">
                {PRESETS.map((p) => (
                  <button key={p.id} className="sv-chip" disabled={busy} onClick={() => void ask(p.label, p.id)}>
                    {p.label}
                  </button>
                ))}
              </div>
              <form
                className="sv-engineer-ask"
                onSubmit={(e) => {
                  e.preventDefault();
                  void ask(question);
                }}
              >
                <input
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder={key ? "Ask your engineer..." : "Ask, or add a key for free questions"}
                  aria-label="Question for the race engineer"
                />
                {Recognizer && (
                  <button
                    type="button"
                    className={"sv-icon-button" + (listening ? " is-live" : "")}
                    aria-label={listening ? "Stop listening" : "Ask by voice"}
                    aria-pressed={listening}
                    onClick={listen}
                  >
                    <Icon name="mic" />
                  </button>
                )}
                <button type="submit" className="sv-icon-button is-send" aria-label="Send" disabled={!question.trim()}>
                  <Icon name="send" />
                </button>
              </form>
            </>
          )}
        </section>
      )}
      <button
        className="sv-engineer-fab"
        aria-label={open ? "Close race engineer" : "Open race engineer"}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <Icon name="headset" size={22} />
      </button>
    </div>
  );
}
