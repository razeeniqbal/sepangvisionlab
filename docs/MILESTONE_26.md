# Milestone 26: elevation, a real debris fence, a step-by-step guide and a proper hand-tracking panel

## Track elevation (DERIVED)
- **Source:** `scripts/derive-elevation.ts` bins the OpenF1 location z of about 790,000 on-track 2026 race samples by 4 m profile sample, takes the median, scales it like x and y, and smooths it over about 40 m (`src/data/circuits/sepangElevation.json`, `npm run data:elevation`).
- **Result:** about 22 m from the lowest point (near T2-T3) to the highest (near T10-T11). The steepest slope is about 6%. These are car-reference heights, not a survey.
- **Track and scenery:** the track profile carries the height, so asphalt, kerbs, run-off, gravel, barriers, fences and the pit lane follow it. The flat ground is replaced by a terrain grid that takes the nearest track height (0.25 m below the surfaces) and fades to a level plain 600 m out. Trees, palms, boards, the gantry, tyre walls, grid marks and every building stand on that terrain. The distant hills sit on its average level.
- **Cars and cameras:** cars ride the profile and pitch nose-up on climbs. Trails follow the surface. Cameras, the sun's shadow box, label fading and TV line-of-sight checks all use the car's real height.

## Debris fence, after Sepang's Geobrugg system
Sepang replaced part of its debris fence with a Geobrugg system (4.5 m at Turn 1, steel posts every 4 m, heavy cables, fine high-tensile mesh). The fence now matches:
- 4.5 m tall, with a post at every 4 m profile sample;
- five horizontal cables;
- a fine diamond mesh (about 10 cm, blended so it fades to a haze at distance).

Broadcast cameras film through holes cut in real fences. Here the mesh is cut along the sight line from the camera to the followed car, and within 14 m of the camera. TV cameras also keep 14 m clear of every stand and building, including K1 and the C2 hillstand.

## Infield
Palms and tree clumps no longer grow inside the circuit loop (`insideCircuit`, even-odd test over the centre line).

## Quick guide, step by step
The guide now opens every time the app does, unless "Don't show again" is ticked (it is off by default). It shows one step at a time, with Back/Next, progress dots and arrow keys. The browser's plain tooltip over the 3D view is replaced by a styled hint that fades after a few seconds or on first use, with touch wording on phones.

## Hand tracking panel
- **Redesign:** in the glass style, with a status pill and close button, and the camera preview beside one clear "Turn on camera" button. A gesture-control switch, the last action, and the gestures as icon cards sit alongside. Landmark readouts, the dataset recorder and technical notes are under Advanced.
- **Gestures:** the two-palms gesture, still mapped to the removed "Strategy Lab", now plays or pauses the replay. Action labels match today's app.
- **Menu:** the app menu closes when you pick Hand tracking or Quick guide.

Sources: [Geobrugg project at Sepang](https://www.geobrugg.com/project_tr,,5193.html), [PMW Magazine on the FIA-approved debris fence](https://pmw-magazine.com/news/safety/new-track-debris-fencing-gets-fia-approval.html).

## Follow-up: sunken track and a steady gear box
- **Sunken road:** the flat plain around the circuit sat at the mean track height (~13 m), so wherever the track runs lower (the T2-T3 dip goes to 0 m) the plain cut across the road. It now sits at the lowest track point.
- **Terrain under roads:** the terrain is now a lower envelope: no higher than any road within 150 m, rising at most 15% beyond each road's 26 m run-off. Ground between two sections at different heights can never cover the lower one.
- **Draping:** run-off, gravel, barriers, fences and tyre walls drape onto that terrain beside a lower section, so the slope between the T1 and T2 legs reads as a grass bank. A test checks the terrain never rises over a road.
- **Gear box:** the driver card's speed, gear and RPM sit in fixed-width columns with even-width digits, so the gear box no longer shifts as the numbers change.
