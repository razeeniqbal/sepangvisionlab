# Milestone 27: a guided tour, and the docs brought up to date

## Guided tour
- **What it does:** the quick guide is now a tour of the real interface. Each step dims the page, draws a lit outline around one control and puts a short tip beside it. The steps are:
  1. Welcome (centred).
  2. Session tabs.
  3. Replay bar.
  4. Timing tower.
  5. Camera bar.
  6. Laps button.
  7. Pick winner (Race only; skipped elsewhere).
  8. Menu.
- **Placement:** the tip goes below the control if it fits, otherwise above, otherwise beside it (the tall timing tower), and it always stays on screen.
- **Scrolling on phones:** the control is scrolled to just below the sticky header. The camera step scrolls the 3D view, not the small bar inside it. The spotlight follows its control every frame and is clipped to the screen.
- **Controls:** it opens each time the app does unless "Don't show again" is ticked, and the app menu reopens it. Back/Next, the dots, the arrow keys and Escape work.

Checked in a headless browser on desktop (1440 × 900) and an iPhone 13 profile: every step frames its control and keeps the tip fully on screen. The only overlap is the timing-tower step on phones, where the tower is taller than the screen.

## Documentation
- **docs/GESTURE_CONTROLS.md:** rewritten for the current gestures. Two palms now play or pause, and pinch follows the next driver. The panel, thresholds and privacy notes are updated.
- **docs/CIRCUIT_DATA.md:** rewritten to cover the profile, the derived elevation, alignment, pit lane, turns, buildings and fence, with accuracy classes.
- **README:** adds the tour, the phone layout, the gestures and a documentation map.
- **Older documents** (PRD, VISUAL_V2_*, M14, M15, M18, M19) carry a "historical document" note.
