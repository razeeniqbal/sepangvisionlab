# Milestone 25: team-style liveries and a quick guide

## 2026 team-style liveries
- **Colour schemes:** each team has a scheme approximating its public 2026 colours: body, secondary panels (sidepods, nose tip, engine-cover fin), wings, centre stripe and number colour. Examples: McLaren papaya with black, Ferrari red with white, Red Bull navy with red and a yellow stripe, Mercedes black with silver and teal, Aston Martin green with lime. Colours only, with no team, sponsor or series logos or marks. A team without a scheme falls back to its single OpenF1 colour. Schemes live in `TEAM_SCHEMES` (`src/components/cars/formulaLivery.ts`) and are illustrative.
- **Race numbers:** each car carries its number as a decal on top of the nose. The decal is placed by casting a ray down onto the model once, so it sits on the surface and follows the nose slope. The number is drawn heavy and alpha-blended rather than alpha-tested, because from a distance it covers only a few pixels and mipmapping would otherwise thin it away.
- **Car data:** `CarDefinition` gains the team name so the 3D scene can pick the scheme.

## Quick guide
- A first-visit guide covers five steps: playing a session, following a driver, cameras and mouse control, pick your winner, and display options.
- "Start watching" closes it, and "Don't show again" (on by default) remembers that in this browser (`svl-guide-seen`).
- It can be reopened from the app menu (Quick guide).
