# Milestone 12 — Monte Carlo strategy simulation

After comparing strategies in Strategy Lab, the Monte Carlo panel runs 1,000, 5,000 or 10,000 paired scenarios from the same frozen branch. User controls set the seed and assumed standard deviations for lap pace, degradation, pit loss and post-pit traffic. These are hypothetical sensitivity inputs, not uncertainties calibrated from the race archive.

## Sampling model

NumPy default_rng(seed) supplies reproducible draws. Lap pace is zero-mean normal noise independently drawn by scenario and remaining lap. Existing/fresh degradation rates are independently drawn once per scenario around their deterministic assumptions; they persist through their respective stints. Pit loss is drawn once per scenario. Traffic is drawn per scenario and lap, applied only after stopping. Nonnegative rates/costs are clipped at zero, not resampled; this can shift realized means near zero. Projected lap time has a one-second lower bound, and the single pit charge is added separately.

Each candidate plan shares the same hypothetical race's pace, existing/fresh rates, pit loss and calendar-lap traffic draws. This common-random-number design avoids noise from unrelated races when comparing strategies. Common pace noise cancels in paired deltas unless clipping is reached; it still broadens absolute remaining times. Fresh and existing degradation draws are independent. Correlation choices are assumptions, not fitted relationships. No weather changes, safety cars or incidents are sampled in this milestone.

## Outputs

For each plan: mean, standard deviation, P10/P50/P90 for remaining time and paired delta to stay-out, fastest share, strict probability of beating stay-out, and a 20-bin delta histogram. Histograms share bin boundaries and contain every scenario. Negative delta means faster. Fastest share splits equal outcomes evenly within an absolute 1e-8-second tolerance, avoiding first-plan tie bias. P10–P90 is the middle 80% of simulated outcomes, not a confidence interval for real-world performance. No real-race success probability is claimed.

Zero uncertainty reduces to the deterministic strategy model. The report embeds the exact deterministic branch, assumptions, runs, seed and spread settings for reproducibility. Results are calculated on explicit submit; changing inputs clears old results. Editing or replacing the Strategy Lab branch unmounts the old simulation and cancels its browser request. A 30-second timeout supports recovery and rerun. Browser cancellation discards stale results; it does not stop an already-running bounded server calculation.

## API and validation

POST /api/v1/strategy/monte-carlo takes {strategy, runs, seed, uncertainty}. Pydantic enforces finite bounded inputs, integer runs 1,000–10,000 and unsigned 32-bit seed. Existing driver/branch validation is reused. No additional dependencies or remote calls are needed; NumPy was already installed by the ML requirements. The browser validates the echoed request, deterministic totals, ordered quantiles, probability sums and histogram counts.

Tests cover deterministic equivalence, same-seed reproducibility, changed-seed variation, equal-plan tie splitting, paired pace cancellation, full 10,000-run support, final-lap branches, bounds, API behavior and malformed/stale frontend responses.

Changed backend/monte_carlo.py and its tests, API routes, src/services/monteCarlo.ts, MonteCarloPanel, StrategyLab integration, styles, package test script, README and documentation. Run npm test, npm run test:api, npm run build.

Next milestone: Sepang weather scenarios (M13).
