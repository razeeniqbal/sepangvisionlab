# Milestone 8 — historical race integration

The default session is the 2017 Malaysian Grand Prix at Sepang (2017-10-01). The session switch retains the synthetic development workspace. Original race numbers, drivers and constructor identities come from race results, not current driver profiles (Max Verstappen raced as 33). Generic colored marker meshes are visualization aids, not exact historical liveries.

## Source and ingestion

Jolpica F1, the Ergast-compatible API: https://github.com/jolpica/jolpica-f1/blob/main/docs/README.md

Endpoints: https://api.jolpi.ca/ergast/f1/2017/15/results/ , https://api.jolpi.ca/ergast/f1/2017/15/laps/ , https://api.jolpi.ca/ergast/f1/2017/15/pitstops/

Run `python -m backend.ingest_historical` explicitly to ingest. It uses an identifying User-Agent, paginates at 100 records, paces requests and reuses raw JSON cache. Raw response hashes and retrieval time are in backend/data/malaysia-2017/provenance.json. The cached 20 entries, 1,024 lap times and 20 pit records are stored in three Parquet files. Ingestion verifies contiguous lap sequences, duplicate keys, circuit/date, result lap totals and winner summed elapsed time against 5,401.290 seconds. No external calls occur during replay.

## Normalization and rendering

GET /api/v2/sessions/malaysia-2017/replay returns a Pydantic-validated sparse historical replay: session identity, duration, source, driver identities, cumulative lap crossings, recorded timing-line positions and pit records. The frontend validates these normalized records; it never consumes Jolpica JSON directly. The v1 synthetic API is preserved.

Duration is 5,479.920 seconds, the latest recorded driver's finish rather than the winner's finish. The clock supports the complete race, speed changes, backward seeks, lap-start jumps and clickable lap completion records. Selecting a driver synchronizes the circuit and inspector. The driver list stays in grid order; latest timing-line positions are individually labeled and are not presented as simultaneous race order. Final classification is revealed at session end.

Movement is a linear reconstruction between each driver's cumulative lap crossings, with a common time-zero race origin. It is not measured GPS; it does not model the starting grid's spatial offsets or pit-lane geometry. A car with no recorded laps (Räikkönen) is never placed on the track. After the last recorded lap, markers disappear; a retirement's exact time/location during the next lap is unknown. Retired cars are not extrapolated around the track indefinitely. Source status and final classification remain available at the end.

Lap-average speed is derived from circuit distance divided by recorded lap duration, including pit laps. Instantaneous speed, pedal telemetry, tyre compound/age and race-control messages are unavailable and never fabricated. The historical panel shows recorded lap times instead of synthetic telemetry charts. Pit-stop durations/lap numbers are displayed as source records; no invented entry/exit timestamps or tyre changes.

## Running and validation

Install backend/requirements.txt (now includes pyarrow). Start the backend and Vite as in README. Cached Parquet is included; importing again is unnecessary for normal use. Missing cache returns a recoverable 503, with a Retry option in the historical workspace. Synthetic mode remains available.

Run `npm test`, `python -m unittest backend.test_api backend.test_historical`, and `npm run build`. Historical tests cover source identity, winner duration, complete normalization, nonstarter/retirement handling, lap boundaries, fractional reconstruction, full-race clock and malformed input.

Next milestone: lap-time ML. Historical position reconstruction remains an approximation and should not be treated as measured racing trajectories.
