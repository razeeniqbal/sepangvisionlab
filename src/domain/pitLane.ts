// Pit lane: its own centre line in world metres (the road cars really drive, including the
// entry that leaves the track at the final hairpin), plus an across-track offset per track
// profile sample for things placed along the track (pit wall, barriers, cameras). Pure; no three.js.

export interface PitPath {
  x: number[];
  y: number[];
}

export interface PitLane {
  /** First profile sample of the lane (entry), inclusive. */
  from: number;
  /** Last profile sample (exit), inclusive; may exceed the sample count to wrap past the line. */
  to: number;
  /** -1 right of travel, +1 left. */
  side: -1 | 1;
  /** Signed centre-line offset (m) for samples from..to. */
  offsets: number[];
  /** Centre line in world metres from where it leaves the track to where it rejoins, every ~4 m. */
  path: PitPath;
}

export const PIT_LANE_HALF_WIDTH = 3.4;
/** A car off the race track within this distance (m) of the pit centre line is in the pit lane. */
export const PIT_LANE_CAPTURE = 6;

const median = (a: readonly number[]) => {
  const s = [...a].sort((x, y) => x - y);
  return s[Math.floor(s.length / 2)];
};

/** Resample a polyline every `step` metres of arc length (ends kept). */
export function resample(path: PitPath, step: number): PitPath {
  const x = [path.x[0]], y = [path.y[0]];
  let carry = 0;
  for (let i = 1; i < path.x.length; i++) {
    const ax = path.x[i - 1], ay = path.y[i - 1];
    const len = Math.hypot(path.x[i] - ax, path.y[i] - ay);
    let at = step - carry;
    while (at <= len) {
      x.push(ax + ((path.x[i] - ax) * at) / len);
      y.push(ay + ((path.y[i] - ay) * at) / len);
      at += step;
    }
    carry = len - (at - step);
  }
  const last = path.x.length - 1;
  if (Math.hypot(x[x.length - 1] - path.x[last], y[y.length - 1] - path.y[last]) > step / 4) {
    x.push(path.x[last]);
    y.push(path.y[last]);
  }
  return { x, y };
}

/** Unit left normal at every vertex (central difference). */
export function pathNormals(path: PitPath) {
  const n = path.x.length, nx: number[] = [], ny: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1);
    const tx = path.x[b] - path.x[a], ty = path.y[b] - path.y[a];
    const len = Math.hypot(tx, ty) || 1;
    nx.push(-ty / len);
    ny.push(tx / len);
  }
  return { nx, ny };
}

/** Nearest point on the polyline: arc position (m), signed offset (+ left) and distance. */
export function projectOnPath(path: PitPath, px: number, py: number) {
  let best = { u: 0, offset: 0, distance: Infinity, segment: 0 };
  let u = 0;
  for (let i = 0; i + 1 < path.x.length; i++) {
    const ax = path.x[i], ay = path.y[i], ex = path.x[i + 1] - ax, ey = path.y[i + 1] - ay;
    const len2 = ex * ex + ey * ey, len = Math.sqrt(len2);
    const f = len2 > 0 ? Math.max(0, Math.min(1, ((px - ax) * ex + (py - ay) * ey) / len2)) : 0;
    const qx = ax + ex * f, qy = ay + ey * f;
    const d = Math.hypot(px - qx, py - qy);
    if (d < best.distance) {
      const side = Math.sign(ex * (py - ay) - ey * (px - ax)) || 1;
      best = { u: u + f * len, offset: side * d, distance: d, segment: i };
    }
    u += len;
  }
  return best;
}

/** Position and left normal at an arc position along the polyline (clamped to its ends). */
export function pathFrame(path: PitPath) {
  const n = path.x.length, cum = [0];
  for (let i = 1; i < n; i++) cum.push(cum[i - 1] + Math.hypot(path.x[i] - path.x[i - 1], path.y[i] - path.y[i - 1]));
  const { nx, ny } = pathNormals(path);
  return (u: number) => {
    const v = Math.max(0, Math.min(cum[n - 1], u));
    let lo = 0, hi = n - 2;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (cum[mid] <= v) lo = mid;
      else hi = mid - 1;
    }
    const f = (v - cum[lo]) / Math.max(1e-9, cum[lo + 1] - cum[lo]);
    const mx = nx[lo] + (nx[lo + 1] - nx[lo]) * f, my = ny[lo] + (ny[lo + 1] - ny[lo]) * f, m = Math.hypot(mx, my) || 1;
    return {
      x: path.x[lo] + (path.x[lo + 1] - path.x[lo]) * f,
      y: path.y[lo] + (path.y[lo + 1] - path.y[lo]) * f,
      nx: mx / m,
      ny: my / m,
    };
  };
}

/**
 * Distance from a point to the polyline, up to `reach` (Infinity beyond it), through a grid of
 * segments: cheap enough for every off-track sample of a session.
 */
export function pathDistance(path: PitPath, reach: number) {
  const cell = 16, grid = new Map<string, number[]>();
  for (let i = 0; i + 1 < path.x.length; i++) {
    const x0 = Math.floor((Math.min(path.x[i], path.x[i + 1]) - reach) / cell), x1 = Math.floor((Math.max(path.x[i], path.x[i + 1]) + reach) / cell);
    const y0 = Math.floor((Math.min(path.y[i], path.y[i + 1]) - reach) / cell), y1 = Math.floor((Math.max(path.y[i], path.y[i + 1]) + reach) / cell);
    for (let gx = x0; gx <= x1; gx++)
      for (let gy = y0; gy <= y1; gy++) {
        const key = gx + ":" + gy, list = grid.get(key);
        if (list) list.push(i);
        else grid.set(key, [i]);
      }
  }
  return (px: number, py: number) => {
    let best = Infinity;
    for (const i of grid.get(Math.floor(px / cell) + ":" + Math.floor(py / cell)) ?? []) {
      const ax = path.x[i], ay = path.y[i], ex = path.x[i + 1] - ax, ey = path.y[i + 1] - ay;
      const len2 = ex * ex + ey * ey;
      const f = len2 > 0 ? Math.max(0, Math.min(1, ((px - ax) * ex + (py - ay) * ey) / len2)) : 0;
      best = Math.min(best, Math.hypot(px - ax - ex * f, py - ay - ey * f));
    }
    return best <= reach ? best : Infinity;
  };
}

/**
 * Centre line of a road from many noisy passes along it (each pass in driving order): start
 * from the longest pass, then repeatedly move every vertex to the median across-road offset of
 * all pass points that project onto it, smoothing as it goes. Robust to positioning noise and
 * to a few stray passes, and it follows the road wherever it goes, not only beside the track.
 */
export function pitPathFromRuns(runs: readonly PitPath[], step = 4, iterations = 5, minPoints = 4): PitPath | null {
  const seed = runs.reduce<PitPath | null>((a, r) => (!a || r.x.length > a.x.length ? r : a), null);
  if (!seed || seed.x.length < 10) return null;
  const smooth = (v: number[], k: number) =>
    v.map((_, i) => {
      let sum = 0, count = 0;
      for (let j = Math.max(0, i - k); j <= Math.min(v.length - 1, i + k); j++) (sum += v[j]), count++;
      return sum / count;
    });
  let path = resample({ x: smooth(seed.x, 2), y: smooth(seed.y, 2) }, step);
  for (let it = 0; it < iterations; it++) {
    const bins: number[][] = path.x.map(() => []);
    for (const run of runs)
      for (let i = 0; i < run.x.length; i++) {
        const q = projectOnPath(path, run.x[i], run.y[i]);
        if (q.distance > 12) continue;
        const k = Math.round(q.u / step);
        if (k > 0 && k < path.x.length - 1) bins[k].push(q.offset);
      }
    const shift = smooth(bins.map((b) => (b.length >= minPoints ? median(b) : 0)), 2);
    const { nx, ny } = pathNormals(path);
    path = resample(
      {
        x: smooth(path.x.map((x, i) => x + nx[i] * shift[i]), 1),
        y: smooth(path.y.map((y, i) => y + ny[i] * shift[i]), 1),
      },
      step,
    );
  }
  return path;
}

/** Lane centre offset at a profile sample, or null outside the lane. */
export function pitOffsetAt(lane: PitLane, index: number, count: number) {
  let k = (((index - lane.from) % count) + count) % count;
  if (k > lane.to - lane.from) return null;
  return lane.offsets[k];
}
