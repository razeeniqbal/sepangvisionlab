# Sepang Vision Lab

A 3D broadcast-style replay of the 2026 Sepang weekend (the 2026 Bahrain Grand Prix held at Sepang, 2 to 4 October 2026): FP1, FP2, FP3, Qualifying and the Race, from public OpenF1 data. Real driver names, team colours, positions, telemetry, race control and weather; cars move on an aligned 3D model of the circuit with chase, onboard, TV, heli and inspect cameras, optional webcam hand gestures, and an SVL or Broadcast theme.

Live: https://sepangvisionlab.madebyrazeen.com/

## Run

Requires Node.js 22.12+ (tested with Node 24). No backend service is needed.

```sh
npm install
npm run dev
```

Open the localhost URL printed by Vite. Add `?perf` to show a frame-rate meter (development only).

```sh
npm run build
npm test
```

## Data

Data via OpenF1 (unofficial, https://openf1.org). Not associated with Formula 1. Driver and team names are shown for identification only; no team, series or sponsor logos are used, and OpenF1 `headshot_url` images are never downloaded or used.

The replay files in `public/sessions/1308/` are committed. To rebuild them (Python 3.12, standard library only):

```sh
npm run data:fetch    # OpenF1 meeting 1308 into data/raw/openf1/ (gitignored, resumable, throttled)
npm run data:build    # compact replay files into public/sessions/1308/
npm run data:align    # fit OpenF1 positions to the track (public/sessions/1308/alignment.json)
npm run test:pipeline
```

Positions are aligned to the circuit model with a DERIVED similarity transform (RMS 3.09 m, p95 5.69 m to the centre line, which includes the real racing line). Between OpenF1 samples (about 4 Hz) cars are interpolated along the circuit; gaps in the data hold the last sample and mark the car stale after 2 s. Details: docs/MILESTONE_19.md.

## Provenance and licences

- Circuit geometry: Tomislav Bacinger, f1-circuits (MIT), unchanged in `src/data/circuits/sepang.json`; provenance, verification and limitations in docs/CIRCUIT_DATA.md. The track is rescaled to the official 5.543 km and has flat elevation.
- Spatial references (pit building, main grandstand, timing anchors): `src/data/circuits/sepangSpatialReferences.ts`, with accuracy classes and sources; docs/VISUAL_V2_5A_SPATIAL_REFERENCE.md.
- Scenery (kerbs, barriers, buildings, trees, sky) is generated in code and illustrative; the car is a stylized SVL model, not a replica of any race car.
- Hand tracking: MediaPipe Hands, vendored in `public/vendor/mediapipe` (licence and provenance there); runs locally, no frames leave the browser.
- Fonts: Barlow Condensed and Inter, bundled through @fontsource and served locally, SIL Open Font License 1.1.
- Header artwork: the owner's SVL logo.

Independent project; no official affiliation with or endorsement by Formula 1, any team, the circuit or OpenF1. Trademark rights remain with their owners.

## Deploying (Vercel, static)

`vercel.json` builds the site (`npm run build`, then `scripts/prune-dist.mjs` drops an unused 28 MB authoring model from the output) and caches the session files. Everything runs in the browser.

## History

Earlier milestones built the circuit, a synthetic physics session, the 2017 Malaysian Grand Prix replay, strategy and Monte Carlo tools and a race engineer (docs/MILESTONE_3.md to docs/MILESTONE_19.md). Milestone 20 removed the 2017 and synthetic sessions and their Python service to focus on the 2026 replay; they remain in the git history. The gesture-model trainer is still in `backend/` (`npm run test:api`, `npm run train:gestures`).
