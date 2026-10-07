# Hand-gesture controls

Optional webcam control of the replay. Open it from the app menu (⋯ → Hand tracking). Everything runs in the browser: frames are never uploaded or recorded, and no microphone is used.

## Using it

1. **Turn on camera.** The preview is mirrored and shows the detected hand skeleton, the number of hands found and the inference time.
2. **Switch on "Gesture control".** The camera alone never controls the app. Gestures are off at the start of every camera session, and the switch is disabled until tracking is live.
3. **Make a gesture.** Hold each pose for about half a second, then relax your hand (or take it out of view) before the next one. The last recognised action is shown under the switch.
4. **Stop.** A held fist pauses the replay and switches gestures off. Escape, switching browser tab, switching session or closing the panel turns the camera off.

| Gesture | Action |
|---|---|
| One open hand swipes left | Rewind 10 seconds |
| One open hand swipes right | Forward 10 seconds |
| Hold a thumb–index pinch | Follow the next driver |
| Hold the index pointing up | Open laps for the followed driver (also switches to the Inspect camera at 0.5×) |
| Hold two open palms still | Play or pause the replay |
| Hold a fist | Pause and switch gestures off |
| Move two open hands apart / together | Zoom in / out (camera distance; the lens in TV) |
| Rotate the line between two open hands | Orbit left / right (Onboard: look around; TV is fixed) |
| Hold a victory sign (index and middle up) | Next camera view |

Swipes follow the mirrored preview, so a swipe to your left on screen rewinds. Rewind and forward keep the replay playing if it was playing. Every action also has an ordinary control. "Try the actions without a camera" in the panel fires each action through the same path, to check the wiring; it does not test recognition.

## How recognition works

Rule-based landmark heuristics (`src/domain/gestures.ts`), not a trained model:

- **Hands:** handedness score ≥ 0.8; palm span ≥ 0.025 of the image height after aspect correction.
- **Pinch:** thumb–index distance < 0.28 palm widths.
- **Open hand and fist:** open when four tip-to-wrist / PIP-to-wrist ratios are > 1.2, a fist when all are < 0.95.
- **Point and victory:** point is index > 1.2 with the others < 1.05. Victory is index and middle > 1.2 with ring and little < 1.05.
- **Hold times:** poses dwell 500 ms; two still palms dwell 900 ms, with < 8° and < 8% distance variation.
- **Swipes:** horizontal displacement > 0.18 and vertical drift < 0.12, within 100–700 ms.
- **Two-hand zoom and rotate:** separation ≥ 0.12 and a 150 ms observation, then a distance ratio > 1.3 / < 0.75 for zoom, or > 20° for rotation.
- **One action per pose:** each action fires once, then needs 250 ms of neutral pose (or the hand leaving view) and a 1-second cooldown. A held fist bypasses the latch, so cancel is always available.
- **Stale frames:** gaps > 350 ms reset pose continuity, and frames with inference > 350 ms are ignored.

Commands reach the replay, driver selection and camera through a per-session React context (`GestureContext`), never through synthetic clicks.

## Engine and privacy

MediaPipe HandLandmarker (`@mediapipe/tasks-vision` 1.0.1) runs in a web worker on the CPU, tracking up to two hands with 21 landmarks each, capped at 15 frames a second. The model and WASM are vendored in `public/vendor/mediapipe` (licence and hashes there), so no third-party CDN is contacted. Startup, permission and no-frame watchdogs release the camera if anything stalls. The Advanced section of the panel has a camera-free engine check, live landmark readouts and the dataset recorder.

## Limits and training

Accuracy has not been measured on real hands. Occlusion and ambiguous poses can misclassify, there is no full 3D hand rotation, and there is no pointing cursor. The optional dataset recorder and the offline trainer (`backend/`, `npm run train:gestures`) are described in docs/MILESTONE_15.md. No trained model is used in live controls.
