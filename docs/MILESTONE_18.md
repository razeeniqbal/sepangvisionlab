# M18 — 3D driver simulation and UI refresh

Brief: `docs/MILESTONE_18_PLAN.md`. Each phase below is committed separately. Session data in the synthetic workspace is labelled "Simulated session · physics pace"; it is never recorded or live data.

## Phase 1 — physics pace

`src/domain/lapPhysics.ts` is a quasi steady state point-mass lap model (power, grip circle, downforce and drag from wing level, braking backward pass). One metric `TrackProfile` of the Bacinger outline is rescaled to the official 5,543 m (`src/data/sepangPace.ts`). `src/domain/physicsField.ts` gives each synthetic entry a fictional, deterministic setup (power, wing, fuel, plus the entry's own compound) and samples position, speed, throttle, brake and lateral g with `sampleAtTime` at an absolute replay time, so seeks in either direction land on the same state.

The synthetic session is still served by the local Python service; it supplies the entries and the frontend computes motion. Entries without a setup keep the constant-pace path, so `fieldAtTime` still matches `backend/provider.py` and the API contract test. `initialProgress` is a phase of the lap in time, which keeps `lapMarkers` and the inspector lap maths exact; the car's distance at time zero therefore differs slightly from the listed start fraction. Simulated laps range from about 1:30 to 1:33.

Limitations: no tyre wear, fuel burn, traffic, slipstream or driver variation; every lap of a car is identical. Throttle and brake are inferred from the speed trace, not modelled pedal inputs.

## Phase 2 — metric scene and generated environment

The circuit viewport now has **Track view** (the existing orthographic engineering view, unchanged: 60 m/unit, `trackCurve`, V2.4 surfaces) and **Driver view**, a separate lazy-loaded Canvas in true metres (1 unit = 1 m, z up, camera `up = +z`). Driver view is built from the same `sepangTrack` profile the physics samples, so a car's position and heading land on the drawn road without any rescaling. The replay clock, selection and session sampler are shared. Driver view has its own error boundary (falls back to Track view) and the existing WebGL fallback message.

Environment, all generated in code (`src/components/circuit/environment/`):

- `ribbon.ts`: pure offset strips along the profile's left normal. Every offset on the inside of a bend is clamped to 0.8 × corner radius, which keeps the inside run-off and barriers from folding over at the hairpin and the tight right-handers.
- `layout.ts`: kerbs through each detected apex (inside) plus an exit kerb (outside); barriers at 27 m; run-off to 24 m; 900 oil palms by a seeded scatter at least 45 m from the centre line and clear of buildings; building envelopes; start gantry; corner boards.
- `anchors.ts`: the V2.5A SOURCED anchors projected with the existing fixed-frame projector at 1 m/unit, then multiplied by the profile scale (1.0045). That shared scale is the only DERIVED step.
- `Environment.tsx` / `textures.ts`: asphalt, white lines, run-off, red/white kerbs, barriers, pit building, double-frontage grandstand, start gantry, chevron boards, instanced palms (two draw calls), gradient sky, fog, hemisphere light and a sun whose 120 m shadow camera follows the selected car. Canvas textures only; no image assets.
- `DriverScene.tsx`: the existing car GLB, unmodified, scaled to 5.6 m; only the followed car casts a shadow. A simple chase camera locks position to the car and eases only the heading. It is a placeholder until the Phase 4 camera rig.

Placement and accuracy (new register source `svlEnvironment`, nine `ILLUSTRATIVE` entries with no coordinates):

| Object | Position | Shape |
|---|---|---|
| Pit building | Centred on SOURCED `pit-building`, aligned to the main straight | Illustrative; envelope shrunk to 174 × 24 m to keep 22 m from the centre line |
| Main grandstand | Centred on SOURCED `main-grandstand`, OFFICIAL east-west alignment | Illustrative two-sided tiers; envelope shrunk to clear both straights |
| Start gantry | Track sample nearest SOURCED `finish` | Illustrative. The replay progress origin is unchanged |
| Track width | OFFICIAL 16 m minimum used as a constant | Local width profile unavailable |
| Kerbs, boards | Curvature peaks of the community outline | Not a surveyed inventory |
| Barriers, run-off, palms, sky | Generated | Illustrative |

Depth: ground at −0.05 m, run-off 0.04 m, asphalt 0.10 m, paint and kerbs 0.16 m; ground and run-off use `polygonOffset`; camera near plane 0.5 m.

Check: 60 fps in Driver view during replay on the development machine with the webcam off; no console errors; Track view unchanged after switching back.

Limitations:

- Corner boards carry no numbers. The detector finds 22 apexes, which do not map to the official 15 turns, so printed turn numbers would be wrong.
- Flat elevation, constant width and no pit lane (pit centreline remains UNAVAILABLE). The pit building faces the main straight with no garages or pit road.
- Building envelopes are shrunk around their anchors to stay clear of the road, so they are smaller than the real structures (the main grandstand is reported at about 1.3 km).
- The static GLB wheels do not turn and cars do not pitch or roll (Phase 3). The camera is a basic chase; Onboard, TV, Heli and Inspect come in Phase 4.
- Every car loads a full-detail GLB clone. Fine at 20 cars on this machine; a mid-range or mobile GPU is not yet measured.
- The reference screenshots in `docs/reference/raceview/` were not in the repository, so no visual comparison against them was possible.

Files: `src/domain/lapPhysics.ts` (profile `scale`, `poseAtDistance`), `src/components/circuit/environment/{ribbon,layout,anchors,textures}.ts`, `environment/Environment.tsx`, `src/components/circuit/DriverScene.tsx`, `CircuitScene.tsx` (view toggle, session label), `App.tsx` (session label), `src/data/circuits/sepangSpatialReferences.ts` (register entries), `tests/environment.test.ts`, `docs/MILESTONE_18_PLAN.md` (copied from the kit), this file.

## Phase 3 — car that moves like a car

The GLB is still the body and is not modified. Because it is one merged mesh, its wheels cannot move, so four wheels are generated in code (`src/components/cars/wheels/`) and drawn 4% larger at the GLB's own hub positions to cover the static wheels. Each wheel is a single vertex-coloured mesh (tyre, rim, three spokes, compound-coloured sidewall band using the existing `TYRE_COLOURS`), one draw call per wheel and shared geometry per compound and side.

Hub positions are DERIVED by reading the GLB vertex buffer in the `createFormulaVisual` frame (tyre equator extremes and lateral faces, symmetric left/right to 0.1 mm). At the 5.6 m display length they give a 3.54 m wheelbase and a 0.37 m tyre radius.

Motion (`src/domain/carMotion.ts`, pure and tested), visual only and never fed back into race state:

- Steer: kinematic bicycle model from the heading change over the next 6 m, `δ = atan(L · Δψ / Δs)`, clamped to ±0.38 rad, eased.
- Spin: distance covered since the last frame / tyre radius. Pausing stops the wheels, rewinding turns them backward, and jumps over 60 m (seeks) add no spin.
- Pitch: nose down under braking from acceleration measured in replay time (a paused replay holds still), gain 0.012 rad/g, clamped to ±0.03 rad.
- Roll: toward the outside from v²κ/g, gain 0.009 rad/g, clamped to ±0.035 rad. Pitch and roll pivot at hub height and move only the body, so the wheels stay planted.
- All easing is exponential in wall-clock time, so it is frame-rate independent.

`wheels: "generated" | "model"` (`WHEELS` in `DriverScene.tsx`): `"model"` drives nodes named `wheel_FL`, `wheel_FR`, `wheel_RL`, `wheel_RR` in a future GLB, assuming each node's rest frame has its axle along y, and falls back to generated wheels if any node is missing. Today it is `"generated"`.

The Phase 2 chase camera now snaps to the car heading when its eased heading is more than ~35° off (after a seek or a long frame hitch) instead of swinging round from a stale direction.

Limitations:

- The generated wheels are simpler than the GLB's: no brake ducts, tread or tyre text. The GLB's static wheels can show at the edges at extreme steer angles.
- Pitch and roll are kinematic gains, not a suspension model. The body does not heave with downforce or kerbs.
- Historical sessions use lap-average speeds, so their cars roll in corners but barely pitch.
- No measured frame rate this phase: the browser pane was in the background, so frames arrived only when screenshots were taken. Phase 2 measured 60 fps with the pane visible. The 80 added wheel meshes are small next to 20 GLB clones.

Files: `src/domain/carMotion.ts`, `src/components/cars/wheels/{wheelLayout,generatedWheels}.ts`, `src/components/circuit/DriverScene.tsx`, `tests/carMotion.test.ts`, this file.
