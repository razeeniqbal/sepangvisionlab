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

Next: gesture controls and labeled data for M15 gesture ML. Pedal/GPS telemetry and actual tyre data remain unavailable.
