# Milestone 10 — tyre/stint pace analysis

The historical replay now includes a replay-aware stint pace panel, robust regression chart, segment selector and lap inclusion table. It supplies the first regression-based pace trend layer for the tyre milestone. It cannot isolate tyre-specific degradation from the currently available data. The UI labels every numerical slope as observed pace, leaves compound/true tyre age unknown, and explicitly reports tyre-only degradation as not identifiable.

## Method

Pit-stop lap records define provisional stint boundaries: a new segment starts on the following lap. A pit stop does not confirm a tyre change, nor whether fitted tyres were new. The race's first lap, each recorded pit lap and the following lap are excluded from the regression. Excluded points remain visible in amber and are listed in the inspectable table. Other slow laps remain in the data; no outcome-based outlier deletion.

Five usable completed laps are required. The robust slope is the median of all pairwise lap-time differences divided by lap-number differences. The intercept is the median of lapTime − slope × lapNumber. Positive seconds/lap means slower observed pace; negative means faster. The line is drawn only over the used observed laps, never extrapolated. Fit residual MAE summarizes in-sample scatter, not forecast accuracy, confidence, or statistical significance.

Fuel burn, traffic, track evolution, weather and tyre condition are not separately identified. No compound, tyre age or weather data is fabricated. This is a provisional stint model, not a calibrated tyre wear model. Supplying verified tyre/stint data and controlling confounders is required before claiming tyre-specific degradation.

## Replay behavior

Only completed laps at the selected driver's replay cursor are included. Future pit boundaries are hidden until the associated pit lap completes. At a pit boundary the new segment can be empty, then remains unfitted until it has five usable observations. Selecting a previous segment is supported; seeking backward cannot retain a future segment or future fit. Nonstarters show no analysis. Retired drivers stop accumulating samples at their last recorded lap.

GET /api/v1/analysis/stints?driver_id=max_verstappen&completed_laps=33 returns a validated StintAnalysis. Unknown drivers return 404; invalid or out-of-coverage lap counts return 422; missing cache returns 503. Backend computes from cached Parquet and retains at most 128 analyses. No new packages, remote queries, model training or persistence are required.

The browser requests only when driver or completed-lap count changes, cancels superseded requests, rejects stale or inconsistent responses, applies a 15-second timeout and supports Retry. Chart and summary use the same response. Synthetic replay and the prior ML experiment remain unchanged.

## Changes and checks

Added backend/stint_analysis.py, backend/test_stints.py, src/services/stints.ts, src/components/historical/StintAnalysisPanel.tsx and tests/stints.test.ts. Updated backend/main.py, the historical workspace, styles, test script and README.

Tests cover exact positive/negative/flat slopes, small samples, outlier robustness, pit boundaries and exclusions, future-data independence, unknown tyre fields, nonstarters, retired-driver coverage, API errors and frontend response validation.

Run npm test, npm run test:api and npm run build. Next milestone: Strategy Lab; strategy assumptions must remain explicit where historical tyre information is unavailable.
