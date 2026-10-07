# Sepang Vision Lab — agent instructions

A static React app: a 3D broadcast-style replay of the 2026 Sepang weekend from OpenF1 data (FP1, FP2, FP3, Qualifying, Race). README.md describes the features, the data pipeline and the accuracy limits. docs/CIRCUIT_DATA.md describes what the 3D circuit is built from and how accurate each part is; docs/GESTURE_CONTROLS.md covers hand gestures. The milestone notes (docs/MILESTONE_18.md to docs/MILESTONE_29.md) explain why things are the way they are. Documents marked "Historical document" (PRD, VISUAL_V2_*, older milestones) describe removed features.

## Stack

- React 19, TypeScript (strict, no `any`), Vite, Three.js through React Three Fiber and drei.
- No backend at runtime. The optional gesture trainer in `backend/` is offline Python. The race engineer may call the Anthropic API from the browser, only with a key the viewer enters; never ship or commit a key.
- Tests run with `node --experimental-strip-types --test`. That means no enums, no parameter properties, and `.ts` extensions on relative imports in anything a test or script loads.

## Architecture rules

- Keep domain logic pure and in `src/domain/` (replay, recorded-session sampling, motion and g-forces, elevation, pit lane, wetness, compare, share links, engine tone, separation, race engineer).
- The dev server runs on port 5180 (`vite.config.ts`, strict), not Vite's default 5173.
- Keep the first download small: three.js and MediaPipe must stay out of the entry chunk (the theme runtime takes a `set(colour)` object, not a three.js Color; hand tracking is lazy). Rendering lives in `src/components/`.
- The 3D scene is memoised and reads the replay clock from a ref every frame. Do not pass values that change every clock tick as props to it.
- Circuit geometry is data-driven from `src/data/circuits/`. Derived data (alignment, pit lane) is produced by scripts in `scripts/` and labelled DERIVED with its source.
- Prefer small focused components and avoid new dependencies.
- The guided tour (`src/components/recorded/QuickGuide.tsx`) points at controls by CSS selector. If you rename or move `.sv-sessions`, `.sv-replay`, `.bc-tower`, `.sv-dock`, `.sv-engineer-fab`, the Laps button or the app menu button, update its `STEPS`.
- Derived data is rebuilt with `npm run data:align`, `data:pitlane` and `data:elevation`; never hand-edit the generated JSON.

## Data honesty

- Show only real recorded channels. Never invent telemetry, positions or results. Gaps hold the last sample and mark the car stale.
- Label accuracy honestly: DERIVED, SOURCED, OFFICIAL, illustrative. Never approximate geometry and call it accurate.
- If OpenF1 contradicts itself (for example race tyre stints), show unknown (`?`) rather than guess, and document it.
- After changing the pipeline, run `npm run check:physics` and the session gap checks described in docs/MILESTONE_23.md.

## Guardrails

- Never modify the car GLBs in `public/assets/models/cars/`, the circuit GeoJSON `src/data/circuits/sepang.json` (a test checks its bytes), or `public/vendor/mediapipe`.
- Never use F1, team or sponsor logos, the "F1" or "Formula 1" wordmark as branding, F1 proprietary fonts, or OpenF1 `headshot_url` images.
- Keep the footer attribution: "Data via OpenF1 (unofficial). Not associated with Formula 1."
- Never commit `data/raw/` (OpenF1 downloads) or `docs/reference/` (third-party screenshots), and never copy branding, driver names or team names from those screenshots into the app.

## Visual direction

The owner chose a clean, modern glass-panel interface over a full-window 3D stage, and wants it to look realistic and feel like a racing game.

- Floating glass panels (soft blur, rounded corners, subtle borders and shadows), readable type, and icons on controls.
- Theme colours are CSS tokens: `:root` for SVL teal and `:root[data-theme="broadcast"]` for red. `tests/theme.test.ts` checks their contrast.
- High quality must never look worse than Balanced: add detail, not colour grading.
- No emojis in the production UI.

## Workflow

1. Inspect the relevant files before changing them.
2. Make the smallest change that does the job, and preserve working features.
3. Run `npx tsc -b`, `npm test` and `npm run build`. For 3D changes, check the result visually.
4. Commit with a clear message. Pushing to `main` deploys production on Vercel, so push only when the owner asks.
5. Report what changed, how it was verified, and known limitations.
