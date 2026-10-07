# Sepang circuit data

What the 3D circuit is built from, and how accurate each part is. Accuracy classes are used throughout:

- **OFFICIAL:** published by the circuit.
- **SOURCED:** taken from a cited source.
- **DERIVED:** computed from data, with the method stated.
- **ILLUSTRATIVE:** drawn to look right, with no data behind it.

Every item is registered in `src/data/circuits/sepangSpatialReferences.ts`.

## Centre line (SOURCED, unchanged)

The geographic path is from Tomislav Bacinger's f1-circuits dataset, `circuits/my-1999.geojson` (MIT, retrieved 2026-09-19): https://github.com/bacinger/f1-circuits/blob/master/circuits/my-1999.geojson

- **Storage:** the coordinates are kept byte-for-byte in `src/data/circuits/sepang.json`, and a test checks the file's hash. The MIT licence sits beside it.
- **Layout check:** cross-checked against the operator's Daily Safety Briefing map (https://www.sepangcircuit.com/media/wysiwyg/pdf/Daily_Safety_Briefing.pdf). Turns 1/2 are at the west end, the upper loop runs through 3–6, turns 7/8 are at the east, the lower loop runs through 9–14, and the parallel straights join at 15.
- **Survey status:** a community geographic dataset, not an engineering survey.

## Track profile

`src/data/sepangPace.ts` projects the path to metres (x east, y north) and resamples it every 4 m. It is rescaled to the OFFICIAL 5.543 km lap (the raw polyline is about 5,549 m). Positions between samples follow a Catmull-Rom curve, and direction follows a smooth cubic.

Width is a constant 16 m, the OFFICIAL minimum. The real track varies from 16 to 22 m, but there is no local width profile.

## Elevation (DERIVED)

`scripts/derive-elevation.ts` (`npm run data:elevation`) builds `src/data/circuits/sepangElevation.json`:

- **Method:** bin the OpenF1 location z of about 790,000 on-track 2026 race samples by profile sample, take the median, scale it like x and y by the alignment, and smooth over about 40 m.
- **Result:** about 22 m from the lowest point (around T2–T3) to the highest (around T10–T11). The steepest slope is about 6%.
- **Caveat:** these are car-reference heights, not a survey.

The terrain around the circuit is ILLUSTRATIVE:
- **Lower envelope:** it is no higher than any road within 150 m, rising at most 15% beyond each road's 26 m run-off.
- **Draping:** run-off, gravel, barriers and fences drape onto it beside lower sections.
- **Outer plain:** it fades to a level plain at the lowest track height 600 m out.

## Alignment to OpenF1 (DERIVED)

`public/sessions/1308/alignment.json` (`npm run data:align`) holds an ICP similarity fit of OpenF1 positions onto the centre line:
- **Transform:** scale 0.10031668 m per unit (OpenF1 uses decimetres), rotation −0.016°, no mirror.
- **Residual:** RMS 3.09 m, p95 5.69 m over 2,638 samples. This includes the real racing-line offset.

## Pit lane (DERIVED)

`scripts/derive-pit-lane.ts` (`npm run data:pitlane`) builds `src/data/circuits/sepangPitLane.json` from where cars drove during all 73 race pit stops: the median across-track offset per profile sample, smoothed.

The result is about 600 m long beside the main straight, about 12 m right of the centre line and 17 m at the entry. Its width, the pit wall, fence and apron are ILLUSTRATIVE.

## Turns, buildings and scenery

- **Turn boards (DERIVED):** 22 curvature peaks grouped into the official 15 turns, accepted only when the left/right sequence matches.
- **Start/finish line (SOURCED):** placed at the timing-line anchor. The replay's progress origin is separate.
- **Pit building (SOURCED floor plan):** 33 garages, each 8 × 24 m, at the SOURCED pit-building anchor. Heights and finishes are ILLUSTRATIVE.
- **Main grandstand (SOURCED/OFFICIAL):** double-fronted, on the OFFICIAL east–west alignment, at the SOURCED anchor. The hibiscus-inspired roof shape is ILLUSTRATIVE.
- **K1 stand and C2 hillstand (ILLUSTRATIVE):** a covered stand at T1 and a grass bank over T9–T11, placed after spectator guides.
- **Debris fence:** 4.5 m tall, posts every 4 m, cables and mesh, after the Geobrugg system Sepang installed (https://www.geobrugg.com/project_tr,,5193.html). Its line follows the illustrative barrier offset.
- **Everything else (ILLUSTRATIVE):** kerbs, gravel, tyre walls, crowd, trees, palms and hills. There are no trees in the infield.
