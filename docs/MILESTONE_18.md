# M18 — 3D driver simulation and UI refresh

> **Historical document.** It describes the project as it was at the time; parts refer to views, sessions or tools that have since been removed. For the current app see README.md, docs/CIRCUIT_DATA.md and docs/GESTURE_CONTROLS.md.

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

## Phase 4 — camera rig and gestures

`src/components/circuit/cameraRig.ts` is a pure, tested rig: a ref-held state `{ mode, yaw, targetYaw, dist, targetDist, zoom, targetZoom, heading }`. Buttons and gestures only change targets (`applyRigAction`, `setMode`); the frame loop eases toward them (`stepRig`, exponential and frame-rate independent). The selected car is the rig's target, so selecting the next driver moves the camera with it.

Modes (toolbar group "Camera mode"; Engineering is the unchanged orthographic Track view, the five others share one metric Canvas):

- **Chase**: position locked to the car; only the heading is eased, snapping after seeks. Distance 7–30 m.
- **Onboard**: T-cam above the roll hoop (1.32 m), 72° FOV, look-around limited to ±1.2 rad.
- **TV**: fixed trackside points every ~220 m plus one outside each detected apex, 36 m off the centre line (behind the 27 m barrier line) at 7 m height (raised to 10 m in M19). The nearest point wins and the lens keeps an ~18 m frame on the car, so distant shots zoom in. Zoom gestures change the lens.
- **Heli**: high orbit, 40–220 m.
- **Inspect**: low orbit around the car, 5–24 m.

Gestures go through the existing `useGestureReceiver`. The mapping is in `docs/GESTURE_CONTROLS.md`. New action `cycleCamera` on a victory pose, added to `gestureActions`, `classifyPose`, the M15 recorder labels (appended) and the Python trainer's `LABELS`, which you approved because the trainer validates clip labels against it. Inspect now also sets the replay to 0.5× in both workspaces.

Performance:

- Canvas DPR is capped at 1.5 in the 3D modes; only the followed car casts a shadow; the sun's 120 m shadow camera follows it.
- Hand inference was already capped at 15 fps whenever the camera is on (`useHandTracking`: `1000 / 15` ms between frames), so no change was needed.
- Camera near plane 0.3 m, so Onboard does not clip the cockpit.

Checks: every mode was switched by button and through the gesture command path (the camera-free "Test actions" buttons); "Next camera view" cycled Engineering → Chase → Onboard → TV → Heli → Inspect → Engineering; "Show selected inspector" switched to Inspect and set 0.5×. The 2017 historical workspace renders in Chase. No console errors.

Limitations:

- **Frame rate not measured this phase.** The browser pane rendered only when screenshots were taken, so neither the 60 fps (webcam off) nor the 30 fps (webcam on) target could be measured here. Phase 2 measured 60 fps in the earlier chase camera with the pane visible.
- The victory pose has the same caveats as the other rule poses: synthetic fixtures only, no live accuracy figure.
- TV points sit on a fixed offset and do not avoid scenery, so some may land in the infield or behind a building; not checked point by point.
- Switching between Engineering and a 3D mode remounts the Canvas (about a second while the GLB and environment rebuild). Switching among the 3D modes is instant.
- Onboard shows the selected car's own bodywork in the lower part of the frame; the T-cam position is illustrative.

Files: `src/components/circuit/cameraRig.ts`, `DriverScene.tsx` (rig in the frame loop, near 0.3), `CircuitScene.tsx` (mode toolbar, gesture routing), `src/domain/gestures.ts`, `src/domain/gestureDataset.ts`, `App.tsx` and `HistoricalWorkspace.tsx` (inspect at 0.5×), `backend/gesture_training.py`, `backend/test_gesture_training.py`, `tests/cameraRig.test.ts`, `tests/gestures.test.ts`, `docs/GESTURE_CONTROLS.md`, this file.

## Phase 5 — broadcast UI refresh

The synthetic workspace is laid out like a TV broadcast pit wall. The 3D viewport is the hero and the information sits on it as glass overlays (`--panel` with backdrop blur). All of it is scoped under `.bc`, so the historical workspace keeps its layout and only picks up the shared tokens and fonts.

- **Identity bar**: SVL logo, circuit name, the "Simulated session · physics pace" pill, session clock and replay speed, on a teal rule.
- **Camera strip** across the top of the viewport: the six camera modes plus zoom and orbit (Phase 4 controls, restyled).
- **Timing tower** (`Standings.tsx`, same selection behaviour): lap counter `Lap n / total`, an Interval / Leader toggle, gain and loss arrows against positions 10 s earlier, team colour bar, geometric team glyph, three-letter code and a round tyre marker. Gaps are still estimates from distance.
- **Mini map**: the metric profile outline with every car, the selected car ringed, the ghost as a dashed ring; clicking a dot selects the car.
- **Lower third**: position block, team glyph and name, driver name, number, lap and last lap, speed, throttle and brake bars, and the live ghost gap.
- **Floating car tags** in the 3D view (`P18 SVL`) for cars within 240 m of the camera; the selected car's tag is teal. Hidden for the onboard car.
- **Right drawer** with Inspector and Car setup tabs. The inspect gesture opens the Inspector tab.
- **Car setup drawer**: power, wing, fuel, compound, dry or wet; predicted lap, delta to the original setup and top speed; a one-lap speed trace with the ghost dashed over it; "Save as ghost", "Clear ghost", "Reset setup"; a live gap readout. Changes re-solve the car's lap and apply to the simulated car immediately.
- **Ghost**: the same car replayed with the saved setup from the car's own starting point (`ghostCarAtTime`, `ghostGap` in `physicsField.ts`, tested). Positive gap means the car is behind. It is drawn as a translucent teal car in the 3D view.
- **Telemetry dash and replay timeline** sit under the stage, restyled, with sentence-case labels.

Fictional grid (`src/data/fictionalGrid.ts`): invented driver names and codes, ten generic teams marked by circle, square, triangle, diamond or hexagon glyphs (filled or outlined) in the entry colour. Car 07 remains the SVL development car. No real drivers, teams, sponsors or logos are added. The footer states that the names and teams are fictional.

Tokens and type: `--accent #00a19c`, `--carbon`, `--silver`, `--panel`, `--warn`, `--danger`, `--good` added to `:root`. Barlow Condensed (numbers and headings, tabular figures) and Inter (body) are bundled locally (SIL OFL 1.1, noted in the README) and the Google Fonts `@import` is removed, so the app no longer calls a font CDN. IBM Plex Mono data labels (23 rules) now use Barlow Condensed. Labels in the synthetic workspace are sentence case.

Accessibility and layout:

- Contrast was computed for the overlay colours. White on `#00a19c` is only 3.2:1, so filled controls with small white text use `#007a76` (5.2:1); `#00a19c` stays for lines, rings and large figures. Muted text on panels is 8.1:1.
- Visible `:focus-visible` outlines; `prefers-reduced-motion` removes transitions.
- Up to 1100 px the drawer drops below the viewport. Under 760 px the viewport sits on top, and the tower, lower third, drawer, telemetry and replay stack below it; the mini map is hidden. Checked at 375 px with no horizontal overflow.

Checks: the setup drawer re-solved car 07 from 1:31.477 to 1:29.754 with +100 kW, and after 200 s the live ghost gap read −3.84 s (≈1.72 s/lap × 2.2 laps). Chase and Heli screenshots show every overlay in place. The historical workspace still renders.

Limitations:

- Gap, interval and position-change values are estimates from distance and from positions 10 s earlier, not timing loops.
- The ghost starts from the car's starting point at session time 0. Editing the live setup after saving a ghost shifts that start slightly, because start offsets are a phase of the car's own lap time.
- Setup edits and the ghost are held in memory and lost on reload.
- The floating tags are not occluded by scenery.
- The plan's bottom workspace tabs (Strategy, Monte Carlo, Weather, Historical, Hands) are not built for the synthetic workspace. Those panels live in the historical workspace; the existing workspace navigation stays.
- No visual comparison against `docs/reference/raceview/`, which is still absent.
- Frame rates with the full overlay set were not measured: the browser pane only rendered on screenshots.

Files: `src/App.tsx`, `src/main.tsx`, `src/styles.css`, `src/components/broadcast/{TeamGlyph,MiniMap,LowerThird,SetupDrawer}.tsx`, `src/components/standings/Standings.tsx`, `src/components/driver/CarInspector.tsx`, `src/components/telemetry/TelemetryPanel.tsx`, `src/components/timeline/Timeline.tsx`, `src/components/circuit/{CircuitScene,DriverScene}.tsx`, `src/data/fictionalGrid.ts`, `src/domain/physicsField.ts`, `tests/physicsField.test.ts`, `package.json`, `package-lock.json`, `README.md`, this file.
