# M19 — recorded Sepang 2026, broadcast polish and theme

Branch `m19-recorded`, from `m18-broadcast`. Reference screenshots stay in `docs/reference/` (gitignored); nothing from their branding, driver names or team names is copied.

Pre-check (2026-10-05): OpenF1 `/meetings?meeting_key=1308` returns "FORMULA 1 GULF AIR BAHRAIN GRAND PRIX IN MALAYSIA 2026", circuit key 12 (Kuala Lumpur), 2026-10-02 to 2026-10-04. `/sessions?meeting_key=1308` lists Practice 1 to 3 (11727 to 11729), Qualifying (11730) and Race (11731). OpenF1 is unofficial and not associated with Formula 1.

## Step 1 — broadcast must-fixes

**Livery readability.** `teamLivery(colour)` in `formulaLivery.ts` builds a livery on the existing shader: body in the team colour (lifted to at least 32 % lightness so dark colours still read), shoulders at 70 %, a lighter mechanical grey, a pale centre stripe and a glossier body. Materials are cached per colour and compound. The driver view passes each car's entry colour; recorded mode will pass the OpenF1 `team_colour` (Step 4). The GLB is unchanged, and the engineering view keeps the SVL development livery.

**TV camera occlusion.** Trackside cameras now:

- start from the Phase 4 points (every ~220 m plus each apex), at 10 m instead of 7 m: a tower height that keeps 3–5 m boards below a tight TV frame;
- are dropped if within 6 m of a corner board, a gantry post or the barrier line, or inside a building footprint plus 6 m (`clearTvPoints`);
- are re-picked four times a second by `pickTvCamera`: the nearest camera whose line of sight to the car is clear wins, the current camera is kept while clear and within 1.35 × the nearest clear distance (no flicker), and a camera with a board inside a 25° cone toward the car counts as blocked. The line-of-sight test raycasts against scenery tagged as an occluder (pit building, grandstand, gantry, boards, palms).

Before and after at the slow right-hander (car 07, t = 22 s): the shot was framed past a board post in the foreground; it now cuts to a clear camera on the corner.

**Full-bleed screen.** At 1101 px and wider the synthetic workspace is one screen with no page scroll (checked at 1440 × 900: 0 px overflow). The layout is the session switch, a 52 px header, the viewport and a 340 px drawer, then a docked replay bar and a one-line footer. Telemetry moved into the drawer as a third tab (Inspector, Car setup, Telemetry). Hand tracking is a bottom sheet opened by the header's Hands button; it stays mounted while closed, so a running camera and gestures keep working. The section nav is hidden at this width. Tablet and phone widths keep the scrolling layout from Phase 5.

**Collapsible overlays.** The timing tower, the track map and the driver lower third each collapse to their header with a chevron (`aria-expanded`). The tower keeps about ten rows when space is tight and scrolls the rest.

**Labels and Trails.** Two switches on the camera strip (3D modes). Labels hides the floating car tags. Trails draws a line in the team colour along the road behind each car for about 2.5 s of travel (12 to 260 m). Tags fade to 18 % opacity when scenery blocks the camera's view of them. Each car is re-checked every sixth frame with the same occluder raycast.

**Corner numbers T1 to T15: proposal for approval (not built).** `findCorners` returns 22 curvature peaks. Grouping peaks that belong to one corner gives fifteen, in the official order and directions (five lefts: T2, T5, T9, T12, T15). Distances are along the profile from the sourced finish anchor.

| Turn | Detected peaks (from finish, radius, direction) | Board at |
|---|---|---|
| T1 | 701 m, R34, right | 701 m |
| T2 | 798 m, R24, left | 798 m |
| T3 | 905 m R115, 1042 m R150, 1098 m R149, 1158 m R145, all right (one long right-hander) | 905 m (tightest) |
| T4 | 1607 m, R28, right | 1607 m |
| T5 | 1899 m R113, 1987 m R107, 2059 m R109, all left | 1987 m |
| T6 | 2167 m R98, 2251 m R85, right | 2251 m |
| T7 | 2596 m, R44, right | 2596 m |
| T8 | 2703 m, R47, right | 2703 m |
| T9 | 3195 m, R21, left (hairpin) | 3195 m |
| T10 | 3309 m, R77, right | 3309 m |
| T11 | 3549 m, R38, right | 3549 m |
| T12 | 3877 m, R60, left | 3877 m |
| T13 | 4022 m R141, 4146 m R99, right | 4146 m |
| T14 | 4245 m, R34, right (onto the back straight) | 4245 m |
| T15 | 5186 m, R32, left (onto the main straight) | 5186 m |

Approved on 2026-10-05 and built: `officialTurnBoards` groups the peaks as above and accepts the mapping only if exactly 22 peaks are detected and their directions read RLRRLRRRLRRLRRL; otherwise the boards fall back to unnumbered chevrons rather than showing wrong numbers. Each board shows its number and a chevron in the turn direction, 22 m outside the apex. Register entry `env-turn-boards` is DERIVED, citing this table; the old unnumbered `env-corner-boards` entry is removed.

Checks: build clean; 129 tests pass (7 camera rig tests, including blocked, hold and clearance cases); Python gesture tests pass. FPS overlay (`?perf`) read 60 fps in Chase and TV at 800 × 600 earlier; not re-measured full screen.

Limitations:

- Tag fading uses a ray to the tag point only, so a tag can stay visible while most of its car is hidden.
- Trails follow the centre line, because simulated cars drive the centre line.
- The board cone test is two-dimensional; on rare camera and corner combinations every nearby camera may be rejected and the nearest is used anyway.
- The hands sheet covers the replay bar while open.
- Not checked on a real phone; layout checked in the browser pane at 375, 800 and 1440 px earlier and now.

Files: `src/components/cars/{formulaLivery.ts,FormulaCar.tsx}`, `src/components/circuit/{cameraRig.ts,DriverScene.tsx,CircuitScene.tsx}`, `src/components/circuit/environment/Environment.tsx` (occluder tags), `src/components/broadcast/{Chevron,MiniMap,LowerThird}.tsx`, `src/components/standings/Standings.tsx`, `src/App.tsx`, `src/styles.css`, `tests/cameraRig.test.ts`, `docs/MILESTONE_18.md` (camera height note), this file.

## Step 2 — OpenF1 data pipeline (offline)

`scripts/fetch_openf1.py` downloads meeting 1308 into `data/raw/openf1/1308/<session_key>/` (gitignored), with `scripts/openf1_common.py` holding the shared, tested helpers. Standard library only.

- Sessions come from `/sessions?meeting_key=1308`. Per session, one request each for `drivers`, `laps`, `stints`, `pit`, `position`, `race_control`, `weather`, `session_result` and `starting_grid`. `intervals` (all drivers) and per-driver `location` and `car_data` are fetched in 30-minute windows from 75 minutes before the session clock to 30 minutes after.
- Every response is cached as gzip JSON, written atomically, and skipped on the next run, so an interrupted download resumes. OpenF1's empty answer (HTTP 404 "No results found.") is stored as an empty list.
- **Rate limit.** The first run used 10-minute windows at 25 requests per 10 s (under the published 30 per 10 s). It drew steady HTTP 429 and managed only ~16 files a minute; one request exhausted its retries. The pipeline now throttles to 25 requests per minute with 30-minute windows (about 7,000 rows each), backs off from 15 s on a 429, logs every retry with its cause, and finishes the run with failures listed instead of aborting. The full download then took about an hour with 2 retries in total.
- `provenance.json` per session records the endpoint URLs, retrieval times, row counts and the attribution, and notes that `headshot_url` is excluded.

| Session | Key | Requests | location rows | car_data rows | race_control | intervals |
|---|---|---|---|---|---|---|
| Practice 1 | 11727 | 279 | 402,380 | 394,460 | 18 | 0 |
| Practice 2 | 11728 | 279 | 419,034 | 410,124 | 48 | 0 |
| Practice 3 | 11729 | 279 | 403,920 | 396,770 | 43 | 0 |
| Qualifying | 11730 | 279 | 373,582 | 363,792 | 26 | 0 |
| Race | 11731 | 369 | 1,001,308 | 979,968 | 328 | 11,444 |

OpenF1 publishes intervals for the race only, and `starting_grid` is empty for this meeting. Raw cache: 41 MB.

`scripts/build_recorded_session.py` writes `public/sessions/1308/<slug>/session.json` plus `drivers/<number>.json`, and `public/sessions/1308/index.json`:

- Driver identity: number, acronym, full, first, last and broadcast name, team name and team colour. `headshot_url` (formula1.com images) is never copied; checked with a test and a grep of the output (0 matches).
- Per driver, columnar integer arrays: location `t, x, y, z` and car data `t, speed, rpm, gear, throttle, brake, drs`, with time, x, y and z delta-encoded. Exact (0, 0, 0) samples (OpenF1's "no fix") are dropped; a null DRS is stored as -1, never guessed. Positions stay in OpenF1's own frame; Step 3 measures the units.
- Events with millisecond offsets from `t0`: laps, stints, pit, position, intervals, race control, weather, result. The label "Recorded session · interpolated motion · data via OpenF1" and the attribution are in every `session.json`.
- Replay window: the session clock minus 5 minutes to plus 3 minutes, stretched to cover every timed lap.

| Session | Window | Uncompressed | Gzip |
|---|---|---|---|
| FP1 | 73.8 min | 12.3 MB | 2.41 MB |
| FP2 | 76.8 min | 13.1 MB | 2.68 MB |
| FP3 | 80.4 min | 11.1 MB | 1.86 MB |
| Qualifying | 75.2 min | 10.8 MB | 1.50 MB |
| Race | 207.7 min | 32.0 MB | 5.20 MB |

Every session is far under the 15 MB gzip budget, so the processed files (116 files, 13.7 MB gzip in total) are committed and the raw downloads are not.

**Correction found in Step 3.** The first build stopped race positions and telemetry at 09:30 UTC: the fetch window ended 30 minutes after the race's *scheduled* end, but the delayed race ended at 10:20 UTC, so about 50 minutes of racing were missing (race laps had no location samples). `fetch_openf1.py` now fetches the session-level data first and extends the window to the last timed lap or race-control message plus 30 minutes. The window grid stays anchored at the same start, so the existing cache was reused and only 135 race and 45 Practice 3 requests were added. Race coverage is now 06:55 to 10:21:45 UTC, past the chequered flag.

The race window is long because of a real delayed start: "DELAYED START" before the scheduled 15:00 local time, the start procedure suspended at 15:40, "RACE WILL START AT 16:33", then green at 98 minutes into the window. It includes a safety car on laps 9 to 12, a VSC at lap 43, a second safety car on laps 45 to 51 and the chequered flag on lap 55 at 205 minutes. Step 4 will open the replay at the race start by default.

Tests: `npm run test:pipeline` runs 11 Python tests (time parsing, half-open windows, the 404-as-empty rule, cache round trip, the rate limiter, delta encoding, headshot exclusion, the (0, 0, 0) filter, null DRS, window stretching). npm scripts: `data:fetch`, `data:build`, `test:pipeline`.

Limitations: OpenF1 is unofficial, and its data may be revised; re-running the fetch on a clean cache can give different rows. Location is sampled at about 4 Hz and car data at about 3.6 Hz, so fast transients between samples are not recorded. Practice and qualifying have no intervals feed, so gaps there will come from timing (`laps`) rather than `intervals`.

Files: `scripts/{openf1_common,fetch_openf1,build_recorded_session,test_openf1_pipeline}.py`, `public/sessions/1308/**`, `.gitignore` (`data/raw/`), `package.json`, `README.md`, this file.

## Step 3 — coordinate alignment

OpenF1 `location` x, y and z are in the series' own circuit frame. `src/domain/alignment.ts` fits a similarity transform (uniform scale, rotation, translation, optional mirrored axis) from that frame onto the metric profile used by the driver view and the physics:

- Closed-form least-squares similarity (Umeyama, 2D) for matched points, with an exact inverse.
- ICP against the closed centre line, with nearest-point queries on a 40 m grid of centreline segments.
- Global search: centroid and path-length scale as the start, twelve headings, with and without a mirrored y axis; ICP from each start and the lowest RMS wins. Deterministic.

`scripts/align_openf1.ts` (`npm run data:align`) chooses clean, fast laps: within 103 % of the session's best, not an out lap, one per driver, at least 200 samples, no sampling gap over 1 s. It fits on every third sample, refines on all samples and writes `public/sessions/1308/alignment.json` plus a small test fixture lap.

**Result (DERIVED).** Seven laps from six drivers and two sessions: Qualifying VER lap 11, HAM lap 14, LEC lap 11, NOR lap 11; Race ANT lap 39, PIA lap 41, NOR lap 41. 2,638 samples.

| Quantity | Value |
|---|---|
| Scale | 0.100317 m per unit, so **OpenF1 units are decimetres** (9.968 units/m; the 0.3 % is the community outline rescaled to the official 5.543 km) |
| Rotation | −0.016° (the frames share east and north) |
| Mirror | no |
| Translation | (−65.4, 83.1) m |
| Residual to centre line | **RMS 3.09 m**, p95 5.69 m, max 8.11 m (target RMS under 8 m) |
| Per lap RMS | 3.01 to 3.16 m; Qualifying alone gave 3.06 m, so adding race laps changes almost nothing |

The residual is the distance from each car position to the track's centre line, so it includes the real racing line (cars use the full 16 m road: apex to track-out), not only fit error. Pure fit error is smaller than these figures.

Recorded in the spatial register as `openf1-frame-transform` (DERIVED, new source `openf1`), citing the sessions, laps and residuals; the eight SOURCED anchors are unchanged.

Side finding, not used: OpenF1 z spans 277 to 494 decimetres on a qualifying lap, about 21.7 m of elevation change. The register keeps `elevation-profile` UNAVAILABLE. A future step could turn this into a DERIVED elevation profile, if wanted.

Tests (`tests/alignment.test.ts`, 6): apply and invert round trip with and without mirroring; exact recovery of a known transform; ICP recovering a noisy, rotated, rescaled copy of the centre line from a wrong start; nearest point on the road; the stored transform keeps the real fixture lap at RMS under 8 m and reports decimetre units; global alignment is deterministic and lands on the stored fit.

Limitations: the transform is fitted to the community centre line, not a survey, so its absolute accuracy is bounded by that outline. Pit-lane positions are not used in the fit; the pit centre line stays UNAVAILABLE.

Files: `src/domain/alignment.ts`, `scripts/align_openf1.ts`, `public/sessions/1308/alignment.json`, `tests/alignment.test.ts`, `tests/fixtures/openf1-lap.json`, `src/data/circuits/sepangSpatialReferences.ts`, `package.json`, this file.
