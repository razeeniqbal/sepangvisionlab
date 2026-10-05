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
