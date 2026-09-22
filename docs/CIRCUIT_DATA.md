# Sepang circuit geometry

Milestone 2 uses the geographic circuit path from Tomislav Bacinger's f1-circuits dataset, circuits/my-1999.geojson:
https://github.com/bacinger/f1-circuits/blob/master/circuits/my-1999.geojson

Retrieved 2026-09-19. The original coordinates are retained in src/data/circuits/sepang.json. MIT license retained beside the dataset. See provenance.json for the original file hash.

Verification reference: circuit operator's Daily Safety Briefing, circuit details map (page 3):
https://www.sepangcircuit.com/media/wysiwyg/pdf/Daily_Safety_Briefing.pdf
Published length: https://www.sepangcircuit.com/ (5.543 km).

The coordinate path matches the operator's Grand Prix layout: turns 1/2 at the west end, upper loop through 3–6, east turns 7/8, lower loop through 9–14, and the parallel straights joined at 15. Its projected polyline length is approximately 5549 m (about 0.11% above published length). This is a community geographic dataset cross-checked for layout, not official engineering survey data. No claim of survey-level accuracy is made.

Progress zero uses the dataset's opening/closing point [101.735641, 2.760529], on the main straight; source order heads west toward turn 1. Start/finish is a source-derived marker, not a newly surveyed timing line. Local projection maps longitude east to X and latitude north to Y, with a latitude cosine correction and one uniform scale (60 metres per scene unit). Elevation is omitted.

Straight sections are subdivided at a maximum 8 m spacing before a closed centripetal Catmull–Rom spline is built, keeping interpolation close to the source. Bounds are measured from the resulting path for viewport fitting. The road width and car dimensions are visual aids, not measured geometry. No pit lane is implemented.

The 24-second lap, CAR 07, progress, and lap counts remain a synthetic development simulation, not recorded race data. Next milestone: multiple synthetic cars.
