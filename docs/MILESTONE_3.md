# Milestone 3 — Multiple synthetic cars

Twenty fictional entries now follow the sourced Sepang path. CAR 07 retains PETRONAS branding; CAR 88 uses amber and a separate number badge. Other cars have compact numbered markers. All cars remain on the same curve; label offsets and small depth offsets are presentation-only and do not change progress or rank. Nearby cars may overlap physically because collision physics is outside this milestone.

Domain state includes stable ID, number, position, normalized progress, completed laps, synthetic speed, tyre compound and tyre age. Rankings use completed laps plus progress, with car number breaking exact ties. No standings/selection UI has been added.

Each car has a deterministic starting progress and a different constant lap duration. CAR 07 still takes 24 real seconds per demonstration lap. Speed values are derived from the published 5543 m length at 5x demonstration time, not measured telemetry. Tyre age increases per completed lap; compound remains fixed.

A single animation loop advances the complete field. Meshes read refs every frame, while the CAR 07 readout refreshes at 10 Hz. Pause stops every car. Reset recreates the same entire field. Compact label lanes reduce crowding; dense packs can still occlude labels. The featured 07 badge has priority. No React state update is performed per animation frame.

Next milestone: car selection, standings, and inspector. No backend, real driver data, telemetry, overtaking physics, tyre performance model, or strategy features are included.
