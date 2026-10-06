# Milestone 23: smooth cornering, a real pit lane, and the missing race data

## Race data: a 15-minute hole, now filled
Every driver's position and telemetry were missing from 09:30 to 09:45 UTC in the race (laps ~31-39). Cars froze, were marked stale, and several pit stops never showed.

**Cause.** `scripts/fetch_openf1.py` caches each 30-minute window. The first run ended at the scheduled finish (09:30), so the 09:15 window held only 15 minutes. When the end moved later, that short file was reused as if complete.

**Fix.** A cached window now counts only if its stored URL matches the planned one. The 45 affected windows were re-fetched: location rows went from 1,184,590 to 1,260,314, car data from about 1.16 M to 1,235,916, and intervals from 18,075 to 21,445. Laps, stints, pits, race control and the classification are unchanged, and the four other sessions rebuild byte-for-byte identical. No session has a gap over 60 s.

## Cornering and jitter, checked against physics
`scripts/physics-check.ts` samples every car at 50 Hz across the race and measures the acceleration the rendered motion implies.

| | Before | After |
|---|---|---|
| Frames over 6 g, braking/acceleration | 8.7% | 0.2% |
| Frames over 6 g, cornering | 6.9% | 0.9% |
| Braking/acceleration, 99th percentile | — | 3.7 g |
| Cornering, 95th / 99th percentile | — | 3.5 / 5.9 g |

The remaining extremes happen across genuine data gaps, where a car is held and marked stale.

What changed:
- **Track direction** was constant along each 4 m piece of the profile, so cars and steering snapped by up to 12° at every joint. Position now follows a Catmull-Rom curve and direction a smooth cubic.
- **Timestamp jitter:** OpenF1 sample times jitter, for example 0.5 m in 160 ms at 200 km/h, and a few samples step backwards. Distance and across-track offset are refitted with a Gaussian-weighted local straight-line fit against time (σ 500 ms and 600 ms), and distance is kept non-decreasing.
- **Racing line:** cars point along their actual path, including the racing line across the track: up to ±0.4 rad off the centre line, faded in above 8 m/s.
- **Steering and roll** come from the curvature of the car's own path.

## Pit lane
- **Derived from the race:** `scripts/derive-pit-lane.ts` builds the lane from where cars drove during all 73 race pit stops (median offset per 4 m sample) into `src/data/circuits/sepangPitLane.json` (DERIVED). It is about 600 m long, beside the main straight, about 12 m right of the centre line and 17 m at the entry.
- **Drawn:** an asphalt lane with an edge line, a concrete apron out to the garages, and a concrete pit wall with catch fencing where it runs separate from the track. The start gantry stands on the track edge and pit wall, not in the lane.
- **Motion:** cars in the pit lane follow it with the same smooth motion as on track and show "In pit lane".
- **On-track band:** now 10 m (was 12 m). The lane sits right at 12 m, which made pit cars flicker between snapped and raw motion.
