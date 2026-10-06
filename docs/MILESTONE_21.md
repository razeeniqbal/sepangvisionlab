# Milestone 21: more realistic 3D

The car model files (GLB), the circuit GeoJSON and the vendored MediaPipe files are unchanged. Everything below is materials, lighting, code-built geometry and motion.

## Motion
- Positions between the ~4 Hz OpenF1 samples follow a smooth monotone curve instead of straight lines, so speed no longer jumps at every sample. The curve still passes through every recorded point and never runs backwards.
- Cars point where they are going: a lane change yaws the nose (up to 0.3 rad) instead of sliding sideways.
- The body sits on a damped spring: it dives under braking, squats under power and rolls in corners with a small overshoot, then settles. It runs about 2 cm lower at top speed, with a faint road vibration.
- Wheels get a motion-blur disc that fades in above about 55 km/h.
- A rear rain light blinks in the wet and in the pit lane.

## Look
- The sky now lights the scene (a prefiltered environment map), so paint, glass and wet asphalt reflect it.
- The car paint has a clear coat on the bodywork only, not on the tyres or the dark carbon.
- Every car has a soft contact shadow. On High, every nearby car also casts a sun shadow.
- Textured asphalt with rubber streaks, mown grass with large-scale variation, gravel and steel guardrails.
- Oil palms with drooping fronds, rounder broadleaf trees and low hills on the horizon (illustrative, not survey data).
- High quality adds a camera pass: a gentle glow on the brightest highlights, a light colour grade and a vignette.

## Quality presets
| | Low | Balanced | High |
|---|---|---|---|
| Grass texture, hills | no | yes | yes |
| Sun shadows | none | followed car | all nearby cars |
| Camera effects pass | no | no | yes |

Contact shadows, sky lighting, paint and motion apply at every level.
