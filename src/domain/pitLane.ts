// Pit lane as an across-track offset per track profile sample. Pure; no three.js.

export interface PitLane {
  /** First profile sample of the lane (entry), inclusive. */
  from: number;
  /** Last profile sample (exit), inclusive; may exceed the sample count to wrap past the line. */
  to: number;
  /** -1 right of travel, +1 left. */
  side: -1 | 1;
  /** Signed centre-line offset (m) for samples from..to. */
  offsets: number[];
}

/** Across-track distance (m) at which a pit-lane centre counts as off the race track. */
export const PIT_SEPARATION = 9;
export const PIT_LANE_HALF_WIDTH = 3.4;

const median = (a: readonly number[]) => {
  const s = [...a].sort((x, y) => x - y);
  return s[Math.floor(s.length / 2)];
};

/**
 * Lane from per-sample offset bins: the longest run (wrapping) of samples whose median offset is
 * beyond PIT_SEPARATION on one side, extended while the median still leans that way past 6 m
 * (entry and exit blends), then smoothed over five samples.
 */
export function pitLaneFromBins(bins: readonly (readonly number[])[], minSamples = 4): PitLane | null {
  const n = bins.length;
  const med = bins.map((b) => (b.length >= minSamples ? median(b) : 0));
  let best: { start: number; length: number; side: -1 | 1 } | null = null;
  for (const side of [-1, 1] as const) {
    const out = med.map((m) => m * side >= PIT_SEPARATION);
    for (let i = 0; i < n; i++) {
      if (!out[i] || out[(i - 1 + n) % n]) continue;
      let length = 0;
      while (length < n && out[(i + length) % n]) length++;
      if (!best || length > best.length) best = { start: i, length, side };
    }
  }
  if (!best || best.length < 5) return null;
  let from = best.start,
    to = best.start + best.length - 1;
  while (to - from < n - 1 && med[(from - 1 + n) % n] * best.side > 6) from--;
  while (to - from < n - 1 && med[(to + 1) % n] * best.side > 6) to++;
  const raw = Array.from({ length: to - from + 1 }, (_, k) => med[(((from + k) % n) + n) % n]);
  const offsets = raw.map((_, k) => {
    let sum = 0, count = 0;
    for (let j = Math.max(0, k - 2); j <= Math.min(raw.length - 1, k + 2); j++) (sum += raw[j]), count++;
    return sum / count;
  });
  if (from < 0) (from += n), (to += n);
  return { from, to, side: best.side, offsets };
}

/** Lane centre offset at a profile sample, or null outside the lane. */
export function pitOffsetAt(lane: PitLane, index: number, count: number) {
  let k = (((index - lane.from) % count) + count) % count;
  if (k > lane.to - lane.from) return null;
  return lane.offsets[k];
}
