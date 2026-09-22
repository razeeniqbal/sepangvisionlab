# Milestone 11 — Strategy Lab

Strategy Lab creates a frozen hypothetical branch from the selected historical driver's last completed timing line. It does not modify the replay, recorded results, tyre analysis or ML experiment. Capture is enabled after three usable completed non-pit laps (opening lap excluded), only while recorded coverage remains. A retired/finished/nonstarting driver cannot branch beyond that coverage.

## Model and controls

The baseline pace is the median of the last three available completed non-pit laps, excluding each recorded pit lap and its following lap. No future timing, future pit schedule, ML target or race result influences baseline pace. The UI identifies the exact baseline laps and branch time. Planned finish is race lap 56 for every branch; this is a hypothetical single-driver finish, not a projected classification.

Compare stay out, pit at the branch boundary, and an optional delayed stop after a chosen lap. The form exposes existing-tyre pace loss, new-tyre pace loss, new-tyre pace delta, total pit loss, constant post-pit traffic cost, compound label and optional uniform weather penalty. Defaults are illustrative: .05s/lap pace loss, zero fresh pace delta, 22s pit loss, zero traffic/weather penalties. None are calibrated tyre measurements. Compound is a scenario label only; changing its name does not secretly change model coefficients.

At offset i after the branch, old-tyre lap pace is baseline + currentDegradation × i. After a stop, pace is baseline + freshPaceDelta + freshDegradation × lapsSinceStop + trafficPenalty. Uniform weatherPenalty applies to every projected lap. PitLoss is charged once at the boundary before the first lap after the stop. Thus the projected first new-tyre lap's elapsed time includes the stop loss. A stop cannot occur at/after the final lap.

Output includes per-lap elapsed/cumulative times, total remaining time, finish time on the branch clock, deltas versus stay out, and the fastest plan under the entered assumptions. Ties select the first equal plan deterministically. The chart compares cumulative deltas, with negative meaning faster. No stochastic uncertainty, interaction with other drivers, position predictions, safety cars, incidents or weather transitions are included; those belong to later milestones.

## Interaction and API

Capturing freezes driver, completed lap and timing-line timestamp. Subsequent replay movement or driver selection does not move an existing branch; use the capture button to replace it. Form edits invalidate prior output. Comparisons run on explicit submit, cancel superseded requests, time out after 15 seconds and can be retried. The browser validates identity, assumptions, plan lengths and summed totals before display.

POST /api/v1/strategy/compare receives a StrategyRequest and returns a StrategyResult, both Pydantic validated. Invalid parameters or insufficient/ended coverage return 422, unknown driver 404, missing archive 503. This stateless local calculation neither writes race data nor sends it to an external service. There is no branch persistence yet.

Changed backend strategy engine/API, frontend service and StrategyLab panel, workspace integration, styles, tests and docs. Tests cover hand-calculated two-lap plans, pit charging, equal strategies, cost terms, label-only compounds, future-data independence, coverage limits, request bounds and cross-language contract consistency.

Run npm test, npm run test:api and npm run build. Next milestone: Monte Carlo simulation (M12), followed by weather, hand tracking, gesture ML, AI race engineer and final polish (M13–M17).
