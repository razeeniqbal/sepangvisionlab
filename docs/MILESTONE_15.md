# M15 — gesture dataset and offline training

Implemented the local landmark recorder and reproducible four-model experiment. This milestone is **awaiting real labeled recordings and evaluation**; no gesture model has been trained on real examples or installed in live controls.

## Collect examples

1. In Hand tracking lab, enable your camera yourself. Check the hand overlay.
2. Select Collection mode to consent to landmark recording and disable gesture commands. No images or audio are saved, and nothing is uploaded.
3. Choose neutral, point, pinch, grab, rotate, zoom, swipe left, or swipe right. Follow the displayed instructions. Click Record 2-second clip: a one-second preparation countdown precedes recording.
4. Use one hand for static poses and swipes; two hands for rotate/zoom. Swipes follow the mirrored preview. For zoom, include apart and together examples; for rotate, include both directions. These combined labels do not infer action direction on their own.
5. Collect at least two clips per label in each of at least five independent recording sessions. Vary lighting, distance, background and hand position between sessions. New recording session generates a grouping ID, not a new camera connection. Do not give one continuous burst multiple IDs to manufacture holdout data.
6. Export landmark dataset before switching race session, reloading or closing. Clips only live in memory. Exports include all clips in memory; later cumulative exports can be combined safely because identical clip IDs are deduplicated. Remove last clip if you made a labeling mistake. Limit: 240 clips in memory. Save exported files locally.

Tracking interruption, identity changes, low confidence, small hands, invalid coordinates, frame gaps over 350 ms, fewer than 12 frames, or under 1.5 seconds of coverage reject clips. Hiding the tab, Escape, disabling collection or stopping the camera cancels pending capture. Camera remains user-controlled. Clips record normalized camera coordinates, handedness estimates, confidence, relative timestamps, aspect ratio, explicit label, clip ID and session ID. They contain no participant names or images. Session IDs are not participant IDs.

## Train and inspect

From the project directory, with existing backend requirements installed:

```powershell
npm run train:gestures -- path/to/session-a.json path/to/session-b.json --output backend/data/gesture-experiment-01
```

Supply as many export files as needed to cover at least five sessions. The output directory must be new. No files are uploaded. Existing output is never overwritten. Malformed data, duplicate recordings under new IDs and insufficient class coverage stop the experiment.

The fixed seed (42) assigns complete sessions to approximately 60% training, 20% validation, 20% test. No frame-level split is used. Every split needs at least two examples of every class. Record complete sessions to meet this requirement rather than changing IDs after seeing results.

Features resample each complete clip to 20 frames. For each of two handedness slots, they include presence, mirrored wrist position, palm scale and wrist-relative landmarks normalized by palm span. This preserves motion and pair separation while normalizing local pose size. There are 2,720 features per clip. It is a small classical sequence baseline, not an LSTM or live sliding-window detector.

Random Forest, scaled SVM, XGBoost and scaled MLP are fit only on training sessions. Highest validation macro F1 selects the model; ties use the listed order. Only the winner is evaluated on test sessions. The experiment writes report.json with accuracy, macro/per-class precision, recall, F1, supports, confusion matrices (rows actual, columns predicted in report label order), prediction latency median/p95, convergence warnings, split membership, source SHA-256 hashes and library versions. Timing uses 30 single-clip predictions after warmup and excludes landmark detection and feature extraction. model.joblib contains the selected estimator and feature/label metadata. Only load model files you trust.

The app continues using experimental gesture rules. Model output is not automatically connected to replay actions. Session-level evaluation does not establish cross-person accuracy; the dataset needs participant grouping before making that claim. Review test errors, class coverage, convergence warnings and latency, then separately validate live operation before considering deployment. Do not use synthetic unit-test fixtures as training data or accuracy evidence.

## Files

- src/domain/gestureDataset.ts: capture validation and export contract.
- src/components/handtracking/GestureRecorder.tsx: consent, countdown, labels, counts, export, removal and session grouping.
- HandTrackingPanel.tsx: collection-mode isolation from gesture controls.
- backend/gesture_training.py: input validation, motion features, session split, model comparison and report/artifact output.
- tests/gestureDataset.test.ts and backend/test_gesture_training.py: quality, export, normalization, split, deduplication and model API tests.

Next step: collect real examples and run the experiment, review the held-out report, then plan live inference. M16 is not started.

## Verification

68 frontend tests and 37 backend tests passed (105 total). Four-model fitting was exercised only on explicitly synthetic test vectors; no real accuracy claim or deployed gesture model was produced. Browser checks verified all labels, zero-count display, session reset, disabled recording/export with camera off, and the recorder beside the preview. Camera recording was not activated; live capture and evaluation await user examples.
