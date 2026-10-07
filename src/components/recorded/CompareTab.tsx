import { useMemo } from "react";
import type { RecordedSession } from "../../domain/recordedSession";
import { motionAt } from "../../domain/recordedSession";
import { currentLap, deltaAt, lapWindow, speedTrace, type LapWindow } from "../../domain/compare";
import { formatLap } from "../../domain/inspection";
import type { DriverIdentity } from "../broadcast/TeamGlyph";

type Identity = DriverIdentity & { color: string };

const W = 320,
  H = 150,
  PAD = { l: 30, r: 8, t: 8, b: 18 };

/**
 * Compare the followed driver with a rival on the same lap: lap times, speed against distance
 * for both, and the live time gap at the followed driver's position. Recorded data only.
 */
export default function CompareTab({
  session,
  me,
  rival,
  onRival,
  ghost,
  onGhost,
  time,
  identities,
}: {
  session: RecordedSession;
  me: number;
  rival: number;
  onRival: (n: number) => void;
  ghost: boolean;
  onGhost: (on: boolean) => void;
  time: number; // ms
  identities: Map<number, Identity>;
}) {
  const { file, track, drivers } = session;
  const lap: LapWindow | null =
    currentLap(file.laps, me, time) ??
    // Between laps or after the flag: the last completed lap.
    [...file.laps]
      .filter((l) => l.d === me && l.t !== null && l.dur && l.t + l.dur * 1000 <= time)
      .sort((a, b) => b.n - a.n)
      .map((l) => ({ n: l.n, t: l.t!, dur: l.dur! }))[0] ??
    null;
  const theirs = lap ? lapWindow(file.laps, rival, lap.n) : null;
  const meTrack = drivers.find((d) => d.number === me),
    rivalTrack = drivers.find((d) => d.number === rival);
  const traces = useMemo(() => {
    if (!lap || !theirs || !meTrack || !rivalTrack) return null;
    return { mine: speedTrace(meTrack, track, lap), theirs: speedTrace(rivalTrack, track, theirs) };
  }, [lap?.n, lap?.t, theirs?.t, meTrack, rivalTrack, track]); // eslint-disable-line react-hooks/exhaustive-deps

  const mine = identities.get(me)!,
    other = identities.get(rival)!;
  const options = [...identities.entries()]
    .filter(([n]) => n !== me)
    .sort((a, b) => a[1].code.localeCompare(b[1].code));

  let chart = null,
    gap: number | null = null,
    at = 0;
  if (traces && traces.mine.length > 1 && traces.theirs.length > 1 && lap && meTrack) {
    const maxS = Math.max(traces.mine.at(-1)!.s, traces.theirs.at(-1)!.s);
    const maxV = Math.max(...traces.mine.map((p) => p.v), ...traces.theirs.map((p) => p.v), 100);
    const x = (s: number) => PAD.l + (s / maxS) * (W - PAD.l - PAD.r);
    const y = (v: number) => PAD.t + (1 - v / (maxV * 1.05)) * (H - PAD.t - PAD.b);
    const line = (t: { s: number; v: number }[]) => t.map((p) => `${x(p.s).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
    if (time >= lap.t && time <= lap.t + lap.dur * 1000) {
      at = motionAt(meTrack, track, time).distance - motionAt(meTrack, track, lap.t).distance;
      gap = deltaAt(traces.mine, traces.theirs, at);
    }
    chart = (
      <svg className="sv-compare-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Speed against distance for both drivers">
        {[100, 200, 300].filter((v) => v < maxV * 1.05).map((v) => (
          <g key={v}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} className="sv-compare-grid" />
            <text x={PAD.l - 4} y={y(v) + 3} className="sv-compare-axis">{v}</text>
          </g>
        ))}
        <polyline points={line(traces.theirs)} className="sv-compare-line" style={{ stroke: other.color }} strokeDasharray="4 3" />
        <polyline points={line(traces.mine)} className="sv-compare-line" style={{ stroke: mine.color }} />
        {gap !== null && <line x1={x(at)} x2={x(at)} y1={PAD.t} y2={H - PAD.b} className="sv-compare-now" />}
        <text x={W - PAD.r} y={H - 4} className="sv-compare-axis" textAnchor="end">
          {(maxS / 1000).toFixed(1)} km · km/h
        </text>
      </svg>
    );
  }

  return (
    <section className="sv-compare" aria-label="Compare drivers">
      <div className="sv-compare-pick">
        <span style={{ color: mine.color }}>{mine.code}</span>
        <span className="sv-muted">vs</span>
        <select value={rival} onChange={(e) => onRival(Number(e.target.value))} aria-label="Rival driver">
          {options.map(([n, d]) => (
            <option key={n} value={n}>
              {d.code} · {d.name}
            </option>
          ))}
        </select>
      </div>
      {lap ? (
        <>
          <h3>Lap {lap.n}</h3>
          <dl className="sv-compare-times">
            <div style={{ ["--team" as string]: mine.color }}>
              <dt>{mine.code}</dt>
              <dd>{formatLap(lap.dur)}</dd>
            </div>
            <div style={{ ["--team" as string]: other.color }}>
              <dt>{other.code}</dt>
              <dd>{theirs ? formatLap(theirs.dur) : "No time"}</dd>
            </div>
            <div>
              <dt>Gap now</dt>
              <dd className={gap === null ? "" : gap >= 0 ? "is-ahead" : "is-behind"}>
                {gap === null ? "—" : `${gap >= 0 ? "+" : "−"}${Math.abs(gap).toFixed(2)} s`}
              </dd>
            </div>
          </dl>
          {chart ?? <p className="sv-muted">No comparable lap for {other.code}.</p>}
          <p className="sv-compare-legend">
            <span style={{ ["--team" as string]: mine.color }}>{mine.code} solid</span>
            <span style={{ ["--team" as string]: other.color }}>{other.code} dashed</span>
            Gap: + means {mine.code} is ahead at this point of the lap.
          </p>
        </>
      ) : (
        <p className="sv-muted">{mine.code} has no timed lap here yet.</p>
      )}
      <label className="sv-switch">
        <input type="checkbox" checked={ghost} onChange={(e) => onGhost(e.target.checked)} />
        <span>Show {other.code} as a ghost car on the same lap</span>
      </label>
    </section>
  );
}
