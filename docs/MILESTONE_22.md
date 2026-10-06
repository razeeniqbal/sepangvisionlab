# Milestone 22: game feel, wheels, track detail and "Pick your winner"

The GLB car model, the circuit GeoJSON and the vendored MediaPipe files are unchanged.

## Fixes
- **High looked worse than Balanced.** The High-only camera effects pass (bloom, grade, vignette) dulled the colours, so it was removed. High now means more shadows and detail, never a different grade.
- **Front wheels did not seem to steer.** The model's own wheels are part of one fixed piece and showed around the steering wheels. The paint shader now cuts them away, so only the code-built wheels show. The real steering angle is only a few degrees in most corners, so it is drawn at 1.8× (capped at 24°).

## Cars
- New wheels in the 18-inch style: low-profile tyres with rounded shoulders, dark wheel covers with a centre nut, the compound stripe, and two white sidewall marks that make rotation visible.

## Motion and cameras
- Across-track GPS wobble is smoothed (a short weighted average, on-track samples only), so cars hold their line instead of twitching.
- Chase and onboard feel: the lens widens with speed, the chase camera drops back under power and closes in under braking, and there is a light high-speed shake.

## Track
- Raised kerbs with a ridge that catches the light.
- A chequered start/finish line and 22 painted grid boxes.
- Tyre walls (black with red and white runs) in front of the barriers at gravel traps.
- Catch fencing on posts along the barriers (Balanced and High). It is cut away near the camera so TV shots stay clear.
- A crowd in the main grandstand.

## Game HUD
In the chase and onboard cameras, the telemetry card becomes a racing-game gauge: rev arc with shift flash, speed, gear, throttle and brake arcs, position, lap, tyre and DRS. It uses recorded channels only.

## Pick your winner (race only)
- A header button opens a driver grid. Picks are open until lights out and lock at the start. Rewinding before the start reopens them.
- The picked driver is outlined in the timing tower and their live position shows in the header.
- After the chequered flag, a card reports the official result: won, podium, points, finished or out (DNF/DNS/DSQ).
- The pick is stored in this browser only, per session.
