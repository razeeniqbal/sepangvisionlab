# Milestone 9 — lap-time ML experiment

The historical workspace includes a selected-driver forecast panel, a four-model evaluation table, an availability explanation, and a jump to the first eligible forecast. The experiment uses the cached 2017 Malaysian Grand Prix only. It is not validated on unseen races.

## Reproduce

Install backend/requirements.txt, then run `npm run train:ml` (or `python -m backend.train_lap_model`). Training is explicit, never performed in HTTP handlers. Artifacts are cached in backend/data/lap-model-v1: features.parquet, models.joblib and report.json. The report records source Parquet SHA-256, software versions, creation time, split counts, metrics and selected-model forecasts. The service reads validated JSON, not pickle/joblib; serialized model artifacts are only for local research. Restart the backend after retraining to refresh its in-memory report cache. Changed source data causes a 503 until retraining.

## Target and features

Predict the duration of lap N from the three preceding completed laps, upcoming lap number and the most recently recorded timing-line position. No target-lap timing, future positions, tyre compounds, weather or pit plans are inputs. Driver histories with fewer than three laps provide no examples. All eligible recorded laps, including pit and slow laps, are retained; no target-based outlier filtering. Features are constructed using only driver.timing[:completed].

## Evaluation design

Splits use elapsed race time globally across all drivers, not random row or driver-local lap splits:

- Train: target lap completed by 2,700s (45 minutes), 448 examples.
- Validation: forecast issued at/after 2,700s and target completed by 3,900s (65 minutes), 207 examples.
- Test: forecast issued at/after 3,900s, 275 examples.
- 37 target laps crossing split boundaries are excluded.

Thus training labels exist before validation forecasts, and validation labels exist before test forecasts. Models are fit on training only. Lowest validation MAE selects the model; test data is not used for fitting, selection, hyperparameter changes or refitting. The previous-lap baseline is included as a selectable candidate. Recent observed test laps may become inputs to later forecasts, as they would in a rolling one-lap prediction; they never refit the model.

Models: previous-lap baseline, LinearRegression, RandomForestRegressor (200 trees, depth 8, leaf size 5), XGBRegressor (200 trees, depth 3, learning rate .04, subsample .9). Tree models use random_state=42 and one worker. Exact code defines all parameters. Chronological evaluation rationale: https://sklearn.org/stable/modules/cross_validation.html

## Results

| Model | Validation MAE (s) | Test MAE (s) | Test RMSE (s) | Test R² |
|---|---:|---:|---:|---:|
| Previous-lap baseline | 1.584 | 0.795 | 2.162 | -0.368 |
| Linear Regression | 1.634 | 1.098 | 1.709 | 0.145 |
| Random Forest | 1.505 | 1.160 | 1.731 | 0.123 |
| XGBoost | 1.843 | 1.566 | 1.934 | -0.095 |

Random Forest was selected by validation MAE. It does not improve test MAE over the naive baseline; this is displayed prominently. Its lower RMSE indicates fewer/lower large errors but does not establish broad superiority. No confidence interval is inferred from MAE. Scores are retrospective summaries of the entire held-out period and remain labeled as such during replay.

## Runtime

GET /api/v1/ml/lap-times/report serves Pydantic-validated metrics and cached forecasts. The browser loads once with a 15-second timeout, validates the response, and provides Retry on failure. This is a historical experiment, not an inference service for arbitrary new races. Forecasts appear only when their issue time is reached and are keyed by selected driver and target lap. Before the 65-minute selection cutoff, the panel explains why no forecast is available. Nonstarters/ended histories have no future forecast. The previous completed forecast error is calculated only after its recorded lap ends. The response contains no future actual targets.

Tests verify chronological boundaries, unchanged features after mutating future laps, baseline-aware selection, exact metric reconstruction from predictions and API payload safety. Historical and synthetic tests remain passing.

Next milestone: tyre degradation. Current historical data has no tyre compounds or ages, so any future stint model must make that limitation explicit or acquire suitable data first.
