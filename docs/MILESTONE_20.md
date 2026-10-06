# Milestone 20: 2026-only replay and modern glass UI

## What changed

- **Smoother 3D view.** The 3D scene no longer re-renders on every 10 Hz clock tick, and the palm trees are no longer used as label occluders (commit `20e2112`).
- **2026 only.** The 2017 historical mode, the synthetic physics session, the setup drawer and the Python API were removed. The app now opens straight into the recorded 2026 Sepang weekend (FP1, FP2, FP3, Qualifying, Race) from OpenF1.
- **New interface.** A full-window 3D stage with floating glass cards:
  - slim header with session tabs, clock, a Laps button and an app menu (theme, hand tracking, about);
  - timing tower top-left, track map and weather top-right, race-control toast top-centre;
  - camera dock bottom-centre, with display options (zoom, overlays, quality, fullscreen, Present) in a popover;
  - replay bar along the bottom, with race-control markers on the scrubber;
  - driver telemetry card bottom-right, and a slide-over panel for laps and session details.
- Both themes (SVL and Broadcast) still swap tokens only; contrast is still checked by `tests/theme.test.ts`.

## Data check (2026-10-06)

Every stored session in `public/sessions/1308` was compared with the live OpenF1 API: session keys and start times, drivers and teams, every lap time, stints, pit stops, race-control messages and the classification. All five sessions match exactly.

OpenF1's meeting record for key 1308 names the event "Bahrain Grand Prix" with country "Bahrain", although the location is Kuala Lumpur. The app never shows that field, so nothing is affected.
