import { useEffect, useRef } from "react";
import { engineTone } from "../domain/engineTone";

/**
 * Synthesised engine for the followed car (Web Audio, no audio files). Pitch follows the
 * recorded RPM, volume and brightness the recorded throttle; silent while paused. Created on
 * first enable (a user click, as browsers require) and closed when switched off.
 */
export default function useEngineSound(enabled: boolean, rpm: number, throttle: number, running: boolean) {
  const audio = useRef<{
    ctx: AudioContext;
    low: OscillatorNode;
    high: OscillatorNode;
    filter: BiquadFilterNode;
    gain: GainNode;
  } | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const Ctx = window.AudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const low = ctx.createOscillator(),
      high = ctx.createOscillator(),
      filter = ctx.createBiquadFilter(),
      gain = ctx.createGain(),
      mixHigh = ctx.createGain();
    low.type = "sawtooth";
    high.type = "square";
    mixHigh.gain.value = 0.35;
    filter.type = "lowpass";
    filter.Q.value = 4;
    gain.gain.value = 0;
    low.connect(filter);
    high.connect(mixHigh).connect(filter);
    filter.connect(gain).connect(ctx.destination);
    low.start();
    high.start();
    audio.current = { ctx, low, high, filter, gain };
    return () => {
      audio.current = null;
      gain.gain.setTargetAtTime(0, ctx.currentTime, 0.03);
      window.setTimeout(() => void ctx.close(), 150);
    };
  }, [enabled]);

  useEffect(() => {
    const a = audio.current;
    if (!a) return;
    const tone = engineTone(rpm, throttle, running);
    const now = a.ctx.currentTime;
    a.low.frequency.setTargetAtTime(tone.frequency, now, 0.06);
    a.high.frequency.setTargetAtTime(tone.frequency * 2, now, 0.06);
    a.filter.frequency.setTargetAtTime(tone.cutoff, now, 0.08);
    a.gain.gain.setTargetAtTime(tone.volume, now, 0.08);
  }, [rpm, throttle, running, enabled]);
}
