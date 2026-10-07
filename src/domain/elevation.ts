// Track elevation as a height per track profile sample. Pure; no three.js.

export interface Elevation {
  /** Height (m) above the lowest point, one per profile sample, closed around the lap. */
  heights: number[];
}

const median = (a: readonly number[]) => {
  const s = [...a].sort((x, y) => x - y);
  return s[Math.floor(s.length / 2)];
};

/**
 * Profile from per-sample height bins: median per sample, empty samples filled by linear
 * interpolation around the loop, then a circular moving average over `window` samples
 * (10 samples = 40 m) to remove positioning noise. Heights are shifted so the lowest is 0.
 */
export function elevationFromBins(bins: readonly (readonly number[])[], window = 10) {
  const n = bins.length;
  const raw = bins.map((b) => (b.length >= 3 ? median(b) : NaN));
  const known = raw.map((v, i) => [i, v] as const).filter(([, v]) => !Number.isNaN(v));
  if (known.length < 2) throw new Error("Not enough height samples");
  let filled = 0;
  for (let i = 0; i < n; i++) {
    if (!Number.isNaN(raw[i])) continue;
    filled++;
    const next = known.find(([k]) => k > i) ?? [known[0][0] + n, known[0][1]];
    const prev = [...known].reverse().find(([k]) => k < i) ?? [known.at(-1)![0] - n, known.at(-1)![1]];
    const f = (i - prev[0]) / (next[0] - prev[0]);
    raw[i] = prev[1] + (next[1] - prev[1]) * f;
  }
  const half = Math.floor(window / 2);
  const smooth = raw.map((_, i) => {
    let sum = 0;
    for (let k = -half; k <= half; k++) sum += raw[(((i + k) % n) + n) % n];
    return sum / (2 * half + 1);
  });
  const low = Math.min(...smooth);
  const heights = smooth.map((h) => h - low);
  return {
    heights,
    range: Math.max(...heights),
    samples: bins.reduce((a, b) => a + b.length, 0),
    filled,
  };
}

/** Height (m) at a distance along the lap, linear between samples. */
export function heightAt(heights: ArrayLike<number>, length: number, distance: number) {
  const n = heights.length;
  const d = ((distance % length) + length) % length;
  const x = (d / length) * n;
  const i = Math.floor(x) % n,
    j = (i + 1) % n;
  return heights[i] + (heights[j] - heights[i]) * (x - Math.floor(x));
}

/** Slope (rise over run, positive uphill) at a distance along the lap. */
export function gradeAt(heights: ArrayLike<number>, length: number, distance: number, step = 8) {
  return (heightAt(heights, length, distance + step / 2) - heightAt(heights, length, distance - step / 2)) / step;
}
