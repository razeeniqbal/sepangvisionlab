# Milestone 7 — backend and normalized race state

FastAPI serves a stateless, versioned synthetic session over REST. The frontend loads one bounded, gzip-compressed replay (601 one-second snapshots), validates its contract, and interpolates cumulative lap distance for smooth rendering. Circuit, standings, inspector and telemetry all consume the same provider snapshots. Playback stays local after loading; no per-frame network traffic, network catch-up, or hidden fallback to a second simulation. Reload obtains a new session; this deterministic demo does not need live updates.

## Run

From the project root, install `python -m pip install -r backend/requirements.txt` (Python 3.12 tested). In separate terminals run `npm run dev:api` and `npm run dev -- --port 5174`. The API listens only on 127.0.0.1:8000. Vite proxies /api in development and preview; a production host must route /api to the service. No credentials or database required.

REST routes: GET /api/health, GET /api/v1/session/state?time=120, GET /api/v1/session/replay. Interactive API documentation: http://127.0.0.1:8000/docs. Invalid or non-finite times return 422; valid times are 0–600 session seconds. Pydantic models define the schema, ranges, source label and session identity. The browser rejects unsupported versions, missing frames, invalid values and inconsistent car identities/ranks; failed loading shows Retry. Requests time out after 15 seconds and unmounted requests are cancelled.

RaceState v1: schemaVersion, sessionId, source, time, cars. Each car carries identity, position, completedLaps, normalized progress [0,1), speedKph, tyre compound/age, throttle and brake percentages. Replay adds circuit identity, entries, duration, sample interval and interpolation policy. Entry lapSeconds retains the prototype's nominal 5× wall-clock unit for compatibility with the inspector; actual lap time is lapSeconds × 5. No external API shapes reach rendering components.

The backend's synthetic adapter and JSON seed own this session. Older frontend simulation utilities remain as regression references; the running UI uses backend snapshots. Constant pace, estimated gaps, empty event lists and synthetic inputs remain intentional. This interpolation policy applies only to this continuous constant-pace demo; pit stops, discontinuities and real telemetry need a future provider contract. Historical data, WebSockets and persistence are out of scope.

Validation: npm test; npm run test:api; npm run build. Next milestone: historical race integration through a normalization adapter.
