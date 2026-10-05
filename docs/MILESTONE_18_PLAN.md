# Milestone 18 plan: 3D driver simulation and UI refresh

This is a build brief for Claude Code. Work through the phases in order. Finish each phase with `npm run build` and `npm test` passing before starting the next, and commit per phase.

## Context

Sepang Vision Lab already has: the Sepang GeoJSON (`src/data/circuits/sepang.json`), a closed Catmull Rom `trackCurve`, React Three Fiber with an orthographic engineering camera, a GLB formula car, a synthetic 20 car replay, telemetry, inspector, strategy, Monte Carlo, weather and historical workspaces, and webcam hand gestures delivered through `useGestureReceiver`.

What is missing for a real 3D simulation:

1. Cars move at constant pace (`lapSeconds` in `syntheticCars.ts`, `advanceMotion` in `movement.ts`).
2. Only an orthographic engineering camera exists.
3. Both car GLBs are one merged mesh (single node, no textures), so wheels cannot spin or steer.
4. No environment: no kerbs, barriers, grandstands, pit building, trees or sky.

Reference implementation: `reference/sepang3d-demo.html` is a working single file three.js demo of the target experience (physics, generated environment, car with live wheels, chase, onboard, TV and heli cameras, rain). Port ideas from it; do not ship it.

## Guardrails

* Do not modify either GLB, the GeoJSON, or `public/vendor/mediapipe`.
* Keep every gesture action working. Keep `GestureAction` additive only.
* Keep all existing error boundaries and WebGL fallbacks.
* Keep the provenance and trademark notes in the README and docs. Everything new in the scene is generated in code, so no new licences are introduced.
* `tests/api-contract`, `historical`, `monte-carlo`, `stints` and `strategy` already fail in a clean checkout without the backend running. Do not try to fix them as part of this milestone; just make sure nothing else breaks.
* Node test runner uses `--experimental-strip-types`: no enums, no parameter properties, import with `.ts` extensions.
* Write `docs/MILESTONE_18.md` at the end in the same style as earlier milestone reports.

## Phase 1: physics pace (already started)

`src/domain/lapPhysics.ts` and `tests/lapPhysics.test.ts` are included and pass (7 tests, `tsc -b` clean). The model is a quasi steady state point mass: forward pass limited by power and grip, backward pass limited by braking, combined grip circle, downforce and drag from wing level. Baseline Sepang lap is about 1:30.

Tasks:

* Build one `TrackProfile` in metres: `buildTrackProfile(projectCircuit(coords, 1), 4, 5543)`.
* Give each `CarDefinition` a `setup: CarSetup` (vary power, wing, fuel and compound per car so the field spreads naturally). Keep `lapSeconds` as a derived value from `solveSpeedProfile(...).lapSeconds` so existing inspector and replay maths keep working.
* Replace constant pace movement with `sampleAtTime(track, profile, elapsed)`. It is deterministic, so replay rewind and forward stay exact. Do not integrate `s += v * dt`.
* Feed `throttle`, `brake`, `speed` and `lateralG` into `telemetry.ts` from the sample.
* Update `field.test.ts` and `replay` tests where they assert constant pace.

## Phase 2: metric scene and generated environment

* Introduce a metric scene for the driver views (1 unit = 1 m, Y up is fine inside the new scene) or apply a single scale group. The engineering view may keep `metersPerUnit = 60`.
* New `src/components/circuit/environment/` with generated geometry built from the track profile:
  * `ribbon.ts`: offset strips along the curve normal (asphalt, white lines, run off, kerbs, barriers).
  * Kerbs: red and white canvas texture, inside of each apex from `findCorners`, plus exit kerbs on the outside.
  * Barriers: clamp inside offsets to `0.8 × corner radius`, otherwise they self intersect at T9 and T15.
  * Grandstand between the main and back straights, pit building opposite, start gantry, corner number boards.
  * Oil palms as two `InstancedMesh` (trunk, crown), kept at least 45 m from the centre line.
  * Sky gradient, fog, hemisphere light, one sun that follows the selected car with a tight shadow camera.
* Depth: on mobile GPUs the asphalt z fights with the grass. Use camera near 0.3 or more, lift layers apart (ground below 0, track about 0.1, lines and kerbs about 0.16), and use `polygonOffset` on ground and run off.

## Phase 3: car that moves like a car

* Keep the GLB as the body. Add four generated wheel groups (tyre, rim, three spokes, compound coloured sidewall band using the existing tyre colours) positioned at the GLB's wheel locations so they cover the static wheels.
* Spin wheels by `speed × dt / radius`, steer the fronts from the heading change a few metres ahead (clamp about ±0.38 rad), pitch from acceleration, roll from lateral g, all eased.
* Add a `wheels: "generated" | "model"` switch so a future GLB with named `wheel_FL`, `wheel_FR`, `wheel_RL`, `wheel_RR` nodes can be used instead.

## Phase 4: camera rig and gestures

* New `src/components/circuit/cameraRig.ts`: a ref based state `{ mode, targetCarId, yaw, targetYaw, dist, targetDist }` read in `useFrame`. Buttons and gestures only change targets; the frame loop eases toward them.
* Modes: Engineering (existing ortho), Chase, Onboard, TV, Heli, Inspect (orbit around the selected car).
* Chase: lock position to the car and smooth only the heading vector. Lerping position lags 15 to 20 m at 300 km/h.
* TV: fixed trackside points every ~220 m and at each corner, nearest one wins, FOV from distance.
* Gesture mapping through `useGestureReceiver`:
  * select (pinch): next driver, camera follows it
  * inspect (point up): open inspector and switch to Inspect orbit, replay to 0.5×
  * rotateLeft / rotateRight: orbit yaw ±0.4 rad
  * zoomIn / zoomOut: distance in Chase and Inspect, FOV in TV
  * rewind, forward, cancel: unchanged
  * new `cycleCamera` action, victory pose (index and middle ratios above 1.2, ring and pinky below 1.05). Add it to `gestureActions`, `classifyPose`, the M15 recorder labels and tests.
* Performance with the webcam on: canvas DPR cap 1.5, shadows only on the followed car, hand inference about 15 fps while a 3D mode is active.

## Phase 5: UI refresh

Direction: a broadcast pit wall. The 3D viewport is the hero and fills the workspace; information sits on it as docked overlays rather than in a column of cards.

Layout:

```
┌─ identity (SVL logo) ─────────────── session, replay speed ─┐
│ timing tower │                                    │ mini map │
│ (standings)  │        3D viewport (full bleed)    │          │
│              │                                    │ inspector│
│              │                                    │ drawer   │
├─ telemetry dash ──── camera modes ──── replay timeline ─────┤
└─ workspace tabs: Strategy, Monte Carlo, Weather, Historical, Hands (bottom sheet) ─┘
```

Tokens (keep the brand teal):

* `--accent: #00a19c`, `--carbon: #111818`, `--silver: #dce3e2`, `--panel: rgba(14,22,24,.78)` with backdrop blur, `--warn: #e8b400`, `--danger: #d1243a`, `--good: #3fc18a`.
* Type: Barlow Condensed for numbers and headings with `font-variant-numeric: tabular-nums`; Inter for body. Retire IBM Plex Mono for data labels.
* Sentence case labels instead of all caps eyebrows ("Race workspace" not "RACE WORKSPACE").

Rules:

* Every existing panel keeps its function and its gesture hooks; only placement and styling change.
* Mobile under 760 px: viewport on top, telemetry dash under it, drawers become bottom sheets.
* Visible keyboard focus, `prefers-reduced-motion` respected, contrast at least 4.5:1 on overlays.
* Add a car setup drawer: power, wing, fuel, compound, dry or wet, predicted lap, speed trace, and "Save as ghost" with a live gap readout.

## Done when

* All phases committed, `npm run build` clean, all previously passing tests still pass, new tests for physics, camera rig maths and the new pose.
* Chase, Onboard, TV, Heli and Inspect work with buttons and with gestures.
* 60 fps on a mid range laptop in Chase with webcam off; no worse than 30 fps with hand tracking on.
* `docs/MILESTONE_18.md` documents the model, assumptions, limitations and file changes.
