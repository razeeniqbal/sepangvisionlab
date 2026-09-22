# Milestone 4 — Selection, standings and inspector

The selected car ID lives in App and is shared by the scene, standings, and inspector. Clicking a car body or its number badge selects that car. Hover and keyboard focus highlight the marker; selection adds a ring, larger body and active badge. Standings rows and track badges are native buttons with aria-pressed, supporting Enter and Space. Selecting a different car clears the prior selection. Reset keeps the selection and restores the whole field.

The standings show position, number, estimated gap to leader, and tyre compound. The inspector shows the selected car's position, current lap, normalized progress, speed, tyre compound, tyre age, estimated gap and last full lap. PETRONAS branding appears only for CAR 07.

The field still uses independent constant paces, with 5x synthetic time. Speeds are synthetic average speeds. Gap is an estimate: cumulative lap-distance difference multiplied by the current leader's constant synthetic lap duration. It is not a timing-loop measurement and includes virtual starting offsets. No last lap is shown until a complete lap is available; an initial partial lap is excluded.

The header uses the owner's asset/logo/SVL Concept.png, displaying its horizontal lockup through a CSS viewport. The image is copied without pixel edits to public/assets/brands/svl-concept.png. Original artwork in asset/logo remains intact. No generated car asset was present there.

Verification: existing circuit/field tests plus gap, full-lap availability and time formatting tests; browser checks for selection in both directions, keyboard selection, reset and responsive layout.

Next milestone: telemetry. No telemetry charts, backend, external race feed or strategy features are added.
