# Sepang Vision Lab — Codex Instructions

Read `docs/PRD.md` before making substantial architectural or product changes.

## Current Development Philosophy

Build incrementally.

Do not attempt to implement the entire PRD.

Current milestone takes priority over future requirements.

## Engineering Rules

* Use React + TypeScript + Vite for the frontend.
* Use Three.js through React Three Fiber for the circuit visualization.
* Keep circuit geometry data-driven.
* Keep race-state/domain logic separate from rendering.
* Use strict TypeScript.
* Avoid `any`.
* Prefer small focused components.
* Avoid unnecessary dependencies.
* Do not prematurely introduce backend infrastructure.
* Do not introduce authentication.
* Do not introduce an LLM unless specifically requested.
* Do not introduce ML until the ML milestone.
* Do not introduce MediaPipe until the computer-vision milestone.
* Do not claim synthetic race data is real.
* Do not approximate Sepang geometry and label it accurate.
* Preserve working functionality when implementing new features.
* Inspect existing code before modifying it.

## Visual Direction

The application should resemble professional motorsport engineering software.

Prefer:

* dark neutral surfaces
* sharp geometry
* thin borders
* compact typography
* technical layouts
* restrained turquoise accents
* high information density

Avoid:

* generic SaaS styling
* excessive rounded cards
* excessive gradients
* glassmorphism
* neon cyberpunk
* cartoon graphics
* decorative AI effects
* emojis in the production UI

## Development Workflow

For each task:

1. Inspect relevant existing files.
2. Identify the smallest implementation needed.
3. Implement the requested feature.
4. Run relevant type checks/tests.
5. Fix errors introduced by the change.
6. Do not implement unrelated future functionality.
7. Summarize the result.

At completion report:

* Files changed
* Implementation completed
* Validation performed
* Known limitations
* Recommended next milestone

## Current Milestone

Milestone 1:

**Test Circuit + CAR 07**

Required:

* Sepang Vision Lab application shell
* Three.js scene
* Coordinate-driven test circuit
* CAR 07 marker
* Normalized track progress
* Smooth movement
* Lap counting

Not required:

* Accurate Sepang geometry
* Multiple cars
* Telemetry
* Backend
* Database
* External race data
* Machine learning
* Strategy simulation
* Monte Carlo
* Weather
* Webcam
* MediaPipe
* Gesture ML
* LLM

Stop once Milestone 1 acceptance criteria from `docs/PRD.md` are satisfied.