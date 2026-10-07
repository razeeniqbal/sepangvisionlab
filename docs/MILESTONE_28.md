# Milestone 28: faster load, physics from the data, compare, links, rain and sound

- **Faster first load:** 988 KB → 259 KB (267 → 85 KB gzipped). The theme runtime no longer imports three.js, hand tracking loads on first open, and the 3D engine is fetched in parallel with the session data.
- **G-forces (`gForcesAt`):** derived from each car's recorded motion. They drive body pitch and roll, and a friction-circle g-meter on the driver card and HUD. Across six cars in the race: braking p1 −2.65 g, acceleration p99 2.18 g, cornering p99 5.77 g.
- **Gear shifts and brakes:**
  - Upshifts under throttle kick the body pitch.
  - An illustrative brake temperature (heat ∝ deceleration × speed, cooling faster at speed) makes discs glow above about 550 °C. OpenF1 has no brake temperatures.
- **Pit stops on TV:** illustrative pit-lane cameras every ~60 m on the garage side. A car in the pit lane is filmed from them instead of from behind the pit wall.
- **Compare tab:**
  - same-lap times, speed against distance for both drivers, and the live time gap at the followed driver's position (`src/domain/compare.ts`);
  - an optional ghost car shows the rival at the same moment of their own lap.
- **Shareable links:** `#s=…&t=…&d=…&cam=…` opens a session at a time, following a driver in a camera, and skips the tour. The menu copies a link to the current moment.
- **Rain and wetness:**
  - Only the race had rain: the first 44 minutes of its recording, before the delayed start.
  - While it rains, rain streaks fall and the sky and fog turn grey.
  - Wetness then dries over 90 minutes (illustrative, fitted to the intermediate stint and lap times). It drives the asphalt sheen and the spray behind cars above about 90 km/h.
- **Engine sound (off by default):** Web Audio oscillators at the V6 firing frequency (rpm ÷ 60 × 3), brightness and volume from the throttle, silent when paused.
- **Not done: track width.** OpenF1 positions cluster within about 0.2 m across cars at any point (cars share the racing line), so they cannot measure the real 16–22 m width. The OFFICIAL 16 m minimum stays.
- **Housekeeping:** merged branches were deleted, and the dev server moved to port 5180.
