import { useMemo } from "react";
import type { CarSetup, Compound, SpeedProfile } from "../../domain/lapPhysics";
import { formatLap } from "../../domain/inspection";
import { sepangPace, sepangTrack } from "../../data/sepangPace";

const W = 300,
  H = 90;
function trace(profile: SpeedProfile) {
  let d = "";
  for (let i = 0; i <= sepangTrack.count; i += 4) {
    const x = (sepangTrack.distance[i] / sepangTrack.length) * W;
    const y = H - (profile.speed[i] * 3.6 * H) / 360;
    d += (i ? "L" : "M") + x.toFixed(1) + " " + y.toFixed(1);
  }
  return d;
}

export default function SetupDrawer({
  number,
  setup,
  baseline,
  ghost,
  ghostGap,
  onChange,
  onReset,
  onSaveGhost,
  onClearGhost,
}: {
  number: string;
  setup: CarSetup;
  baseline: CarSetup;
  ghost: CarSetup | null;
  ghostGap: number | null;
  onChange: (setup: CarSetup) => void;
  onReset: () => void;
  onSaveGhost: () => void;
  onClearGhost: () => void;
}) {
  const profile = sepangPace.profile(setup);
  const base = sepangPace.profile(baseline);
  const ghostProfile = ghost ? sepangPace.profile(ghost) : null;
  const paths = useMemo(
    () => ({
      car: trace(profile),
      ghost: ghostProfile ? trace(ghostProfile) : null,
    }),
    [profile, ghostProfile],
  );
  const delta = profile.lapSeconds - base.lapSeconds;
  const slider = (
    key: "powerKw" | "wingLevel" | "fuelKg",
    label: string,
    min: number,
    max: number,
    step: number,
    unit: string,
  ) => (
    <label className="bc-setup-row">
      <span>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={setup[key]}
        onChange={(e) => onChange({ ...setup, [key]: Number(e.target.value) })}
      />
      <output>
        {setup[key]}
        <small>{unit}</small>
      </output>
    </label>
  );
  return (
    <section className="bc-setup" aria-label={"Car " + number + " setup"}>
      <p className="bc-drawer-note">
        Fictional setup for car {number}. Changes re-solve the lap model and
        apply to the simulated car straight away.
      </p>
      {slider("powerKw", "Power", 500, 900, 10, " kW")}
      {slider("wingLevel", "Wing", 1, 10, 1, "")}
      {slider("fuelKg", "Fuel", 0, 110, 5, " kg")}
      <label className="bc-setup-row">
        <span>Compound</span>
        <select
          value={setup.compound}
          onChange={(e) =>
            onChange({ ...setup, compound: e.target.value as Compound })
          }
        >
          <option value="SOFT">Soft</option>
          <option value="MEDIUM">Medium</option>
          <option value="HARD">Hard</option>
        </select>
      </label>
      <div className="bc-setup-row" role="group" aria-label="Track condition">
        <span>Track</span>
        <div className="bc-segmented">
          <button
            aria-pressed={!setup.wet}
            onClick={() => onChange({ ...setup, wet: false })}
          >
            Dry
          </button>
          <button
            aria-pressed={setup.wet}
            onClick={() => onChange({ ...setup, wet: true })}
          >
            Wet
          </button>
        </div>
      </div>
      <div className="bc-setup-result">
        <div>
          <small>Predicted lap</small>
          <strong>{formatLap(profile.lapSeconds)}</strong>
        </div>
        <div>
          <small>vs original</small>
          <strong
            className={
              delta > 0.0005 ? "is-slower" : delta < -0.0005 ? "is-faster" : ""
            }
          >
            {delta >= 0 ? "+" : "−"}
            {Math.abs(delta).toFixed(3)}
          </strong>
        </div>
        <div>
          <small>Top speed</small>
          <strong>{(profile.topSpeed * 3.6).toFixed(0)}</strong>
        </div>
      </div>
      <svg
        className="bc-trace"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="Speed over one lap"
      >
        {[100, 200, 300].map((v) => (
          <line
            key={v}
            x1="0"
            x2={W}
            y1={H - (v * H) / 360}
            y2={H - (v * H) / 360}
          />
        ))}
        {paths.ghost && <path d={paths.ghost} className="bc-trace-ghost" />}
        <path d={paths.car} className="bc-trace-car" />
      </svg>
      <div className="bc-trace-legend">
        <span className="is-car">This setup</span>
        {ghost && <span className="is-ghost">Ghost</span>}
        <span>Speed over one lap · 0 to 360 km/h</span>
      </div>
      <div className="bc-setup-actions">
        <button className="primary" onClick={onSaveGhost}>
          Save as ghost
        </button>
        <button onClick={onClearGhost} disabled={!ghost}>
          Clear ghost
        </button>
        <button onClick={onReset}>Reset setup</button>
      </div>
      {ghostGap !== null && (
        <p className="bc-ghost-readout" role="status">
          Live gap to ghost{" "}
          <strong>
            {ghostGap > 0 ? "+" : "−"}
            {Math.abs(ghostGap).toFixed(2)} s
          </strong>{" "}
          {ghostGap > 0 ? "behind" : "ahead"}
        </p>
      )}
    </section>
  );
}
