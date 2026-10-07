# Milestone 25: team-style liveries and a quick guide

## 2026 team-style liveries
- **Colour schemes:** each team has a scheme approximating its public 2026 colours: body, secondary panels (sidepods, nose tip, engine-cover fin), wings, centre stripe and number colour. Examples: McLaren papaya with black, Ferrari red with white, Red Bull navy with red and a yellow stripe, Mercedes black with silver and teal, Aston Martin green with lime. Colours only, with no team, sponsor or series logos or marks. A team without a scheme falls back to its single OpenF1 colour. Schemes live in `TEAM_SCHEMES` (`src/components/cars/formulaLivery.ts`) and are illustrative.
- **Race numbers:** each car carries its number as a decal on top of the nose. The decal is placed by casting a ray down onto the model once, so it sits on the surface and follows the nose slope. The number is drawn heavy and alpha-blended rather than alpha-tested, because from a distance it covers only a few pixels and mipmapping would otherwise thin it away.
- **Car data:** `CarDefinition` gains the team name so the 3D scene can pick the scheme.

## Quick guide
- A first-visit guide covers five steps: playing a session, following a driver, cameras and mouse control, pick your winner, and display options.
- "Start watching" closes it, and "Don't show again" (on by default) remembers that in this browser (`svl-guide-seen`).
- It can be reopened from the app menu (Quick guide).

## Phone layout cleaned up
Below 760 px the app is one scrolling column in viewing order:
1. A sticky slim header: logo and icon-only buttons, with the session tabs underneath. The big clock is dropped because the replay bar shows the time.
2. The race-control message, without its timestamp.
3. The 3D view (52% of the screen height, capped at 460 px).
4. Replay controls in one row (buttons, time, speed) with the scrubber below.
5. The followed driver's card.
6. Track map and weather, which were hidden on phones before.
7. The timing tower.

In Chase and Onboard, wide screens swap the driver card for the game gauge as before; phones keep the card and hide the gauge. Safe areas on notched phones are respected, and nothing overflows sideways.
