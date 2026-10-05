# Sepang Vision Lab

Milestone 14: optional local webcam hand tracking and a landmark debug overlay, alongside weather scenarios, Monte Carlo and historical analysis. Header branding uses the owner’s SVL artwork.

## Run

Requires Node.js 22.12+ and Python 3.12 (tested with Node 24).

```sh
npm install
python -m pip install -r backend/requirements.txt
npm run dev:api
# In another terminal:
npm run dev
```

Open the localhost URL printed by Vite. Use Pause / Resume and Reset in the vehicle panel.

```sh
npm run build
npm test
npm run test:api
```

The orthographic React Three Fiber scene reads coordinate data from src/data/circuits/sepang.json. A closed Catmull–Rom curve supplies arc-length positions and headings. Domain movement uses elapsed seconds and wraps normalized progress with lap counting. Mesh transforms update per frame; React readouts refresh at 10 Hz. CAR 07 takes 24 real seconds per demonstration lap; the other cars have independent paces. The replay stops at ten minutes; Play restarts it. No real speed or race data is implied.

PETRONAS logo source: https://www.petronas.com/sites/default/files/uploads/content/2023/petronas-logo.svg (accessed 2026-09-19). Branding is isolated in src/data/brand.ts and public/assets/brands; the app continues with its text identity if the logo is removed. Car geometry is a stylized development marker, not an exact replica of a specific race car. Independent project; no official affiliation or endorsement. Trademark rights remain with their owner.

Geometry provenance, verification and limitations: docs/CIRCUIT_DATA.md.

Field behavior and limitations: docs/MILESTONE_3.md.

Selection and inspector behavior: docs/MILESTONE_4.md.

Telemetry behavior and limitations: docs/MILESTONE_5.md.

Replay behavior and limitations: docs/MILESTONE_6.md.

Backend setup, API contract and limitations: docs/MILESTONE_7.md.

Historical data provenance, import instructions and reconstruction limits: docs/MILESTONE_8.md.

Lap-time experiment, training command and evaluation: docs/MILESTONE_9.md. Cached model results are included; run npm run train:ml to reproduce them.

Stint regression method and limitations: docs/MILESTONE_10.md. The observed pace trend is not an isolated tyre-degradation measurement.

Strategy Lab equations, assumptions and limitations: docs/MILESTONE_11.md.

Monte Carlo sampling assumptions and reproducibility: docs/MILESTONE_12.md.

Weather scenarios, tyre penalties and crossover assumptions: docs/MILESTONE_13.md.

Hand tracking setup, privacy, engine check and limitations: docs/MILESTONE_14.md.

Rule-based gesture controls and limitations: docs/GESTURE_CONTROLS.md.

M15 landmark recorder and offline four-model training workflow: docs/MILESTONE_15.md. Awaiting real labeled recordings and evaluation; no trained gesture model is installed. Pedal/GPS telemetry and actual tyre data remain unavailable.

M16 race engineer: docs/MILESTONE_16.md. Local simulator explanations are available; optional AI needs backend configuration. M15 real-data evaluation is deferred.

M17 interface and loading polish: docs/MILESTONE_17.md. M15 real-data evaluation and M16 live AI verification remain open.

M18 3D driver simulation and broadcast interface: docs/MILESTONE_18.md (plan: docs/MILESTONE_18_PLAN.md). The synthetic workspace is a simulated session with physics pace and fictional driver names, teams and glyphs; it is not recorded or live data. All driver-view scenery is generated in code; the car GLB, circuit GeoJSON and MediaPipe files are unchanged.

Fonts: Barlow Condensed and Inter are bundled through @fontsource/barlow-condensed and @fontsource/inter and served locally (no font CDN request). Both are licensed under the SIL Open Font License 1.1 (Barlow: The Barlow Project Authors; Inter: The Inter Project Authors).

Recorded session data (M19): `npm run data:fetch` downloads OpenF1 meeting 1308 into `data/raw/openf1/` (gitignored, resumable, throttled to 25 requests per 10 s); `npm run data:build` writes compact replay files to `public/sessions/1308/`; `npm run test:pipeline` tests both scripts. Data via OpenF1 (unofficial, https://openf1.org). Not associated with Formula 1. OpenF1 `headshot_url` images are never downloaded or used.

## Deploying to Vercel (static)

The frontend deploys as a static site; `vercel.json` sets the build. On a static host there is no Python service, so:

- **Recorded 2026 Sepang (OpenF1)** works fully (static files in `public/sessions/`) and is the starting session (`VITE_DEFAULT_SESSION=recorded`).
- **Synthetic session** works from `public/data/synthetic-replay.json`, a static copy of the deterministic replay (`python scripts/export_static_session.py` regenerates it after backend changes).
- **2017 historical race, Strategy Lab, Monte Carlo, the lap-time report and the race engineer** need the Python service and show their "unavailable" messages. To enable them, host `backend/` on a Python platform and add a Vercel rewrite from `/api/:path*` to it.

`scripts/prune-dist.mjs` drops the unused 28 MB authoring model from the build output (the source file is kept). `.vercelignore` keeps raw data, reference screenshots and the backend out of uploads.
