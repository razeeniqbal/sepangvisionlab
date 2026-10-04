# Visual V2.4 — Sepang 3D Digital Twin Foundation

## Overview

The circuit now uses a physical world-space road mesh, shallow pavement sides, a ground foundation, edge paint, shoulders, raised kerbs, sparse gravel zones and short barrier runs. A default oblique engineering camera reveals the spatial layers. Top view, orbit increments, pan, focus-selected and overview reset remain controlled engineering interactions.

This is a foundation, not a photorealistic scene or a surveyed digital twin. The existing horizontal circuit path remains authoritative for this application. The viewport explicitly states **“Flat elevation · illustrative track surroundings.”** No buildings, grandstands, vegetation props, advertising or V2.5 work were added.

The immediately preceding Formula Car Asset System work already existed when this brief arrived. It is preserved without further car/livery/tyre development. Its separate `VISUAL_V2_4.md` report remains intact. This report covers the newly requested 3D foundation only.

### Files changed

- `src/components/circuit/Circuit.tsx`: replace screen-width circuit lines/grid presentation with shared physical surface meshes and ground.
- `src/components/circuit/CircuitScene.tsx`: engineering camera pose/framing and local camera controls; remove the old grid.
- `src/components/circuit/surfaceGeometry.ts`: new elevation-compatible surface frame and cross-section sweep utility.
- `src/components/circuit/foundationConfig.ts`: new visual dimensions, explicitly illustrative normalized surface ranges, and absent pit-lane metadata boundary.
- `src/components/circuit/foundationMaterials.ts`: new shared surface materials and lightweight shader grain.
- `src/components/circuit/cameraView.ts`: new pure engineering-camera pose calculation.
- `src/styles.css`: local viewport accuracy annotation and selected-view button treatment only.
- `tests/foundation.test.ts`: five new regression tests.
- `docs/VISUAL_V2_4_3D_FOUNDATION.md`: this document.

A pre/post SHA-256 audit of existing `src` files and car GLBs confirms that only `Circuit.tsx`, `CircuitScene.tsx` and `styles.css` changed among existing files. The circuit dataset, projection, spline, car renderer, race domain, replay, telemetry, backend, strategy, weather, ML and gesture implementations remain unchanged.

## Existing Geometry

`src/data/circuits/sepang.json` remains the coordinate source. Its provenance identifies Tomislav Bacinger’s MIT-licensed `f1-circuits` community dataset. `docs/CIRCUIT_DATA.md` records the earlier layout cross-check and length comparison. This is not official engineering survey data.

The existing local longitude/latitude projection at 60 metres per scene unit, straight densification, closed centripetal Catmull–Rom curve, 10,000 arc-length divisions, progress-zero point and tangent direction are untouched. Cars and surfaces use the same `trackCurve.getPointAt` / `getTangentAt` parameterization.

The repository file's exact pre/post SHA-256 is `a9b410f19db91d398f5b1bc034e875086b8fc8ee1178da9fd9ee2c2f80ad8bd6`. The older provenance record contains a different upstream/retrieval hash (`79b46…`); this pass does not assert those byte streams match or silently alter the provenance. The new regression pins the actual pre-change repository bytes. No claim of newly verified geographic detail is made.

## 3D Track

`surfaceRibbon` sweeps offset/height cross-sections along the existing normalized curve. The main road uses 1,600 intervals and a four-point section: right pavement side, right surface edge, left surface edge, left pavement side. Indexed triangles, computed normals and longitudinal/lateral UV coordinates form real geometry whose width is independent of viewport pixels.

The visual road width is 0.30 world units (18 metres at the projection scale), with 0.025 units of shallow foundation depth. These are constant visual approximations, not measured local road width or construction thickness. The road top remains at Z=0 to preserve the existing car anchor. Boundary paint sits at Z=0.002, and shoulders slightly below the road at Z=-0.004. Road edges now remain spatially attached while the camera zooms or tilts.

The cross-section utility also supports normalized subranges and alternate profiles, allowing future sourced surface zones or independent telemetry overlays without baking data into track textures.

## Elevation

**Authoritative elevation is unavailable. Current road elevation is neutral/flat.** No hills, banking or invented Sepang altitude have been added.

The existing Three.js curve already uses XYZ vectors. `TrackSurfaceFrame` adds an explicit position, tangent, lateral and surface-normal frame. Ribbon offsets follow that frame and accept a future curve with nonzero Z; a synthetic elevated curve is covered by a unit test. This extension does not silently add elevation to current race paths.

Future measured elevation/banking integration must coordinate the shared curve, road frame, car Z/pitch/roll and normalized-distance semantics, with regression coverage. Current cars retain their original Z offset and heading. This is an elevation-compatible rendering foundation, not complete elevated-race support.

## Terrain

A lightweight rectangular grass plane surrounds the circuit bounds with a 2.2-unit margin. A shallow dark box underneath gives it a visible edge in oblique view. The ground is at Z=-0.035, below the pavement; the box top is separated slightly to avoid coplanar flicker discovered and corrected during visual inspection.

The neutral flat foundation is not a geographic terrain model, land-cover survey or circuit property boundary. It provides context and a future environment-placement surface. No displaced terrain, individual grass blades or vegetation geometry.

## Track Zones

| Zone                       | Implementation                                                                                  | Accuracy                                          |
| -------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| Edge paint                 | Continuous narrow world-space ribbons                                                           | Visual approximation                              |
| Shoulder/runoff foundation | Continuous restrained concrete shoulder                                                         | Generalized; not verified runoff classification   |
| Kerbs                      | Three sparse normalized ranges, raised cross-section, alternating muted red/white vertex colors | Illustrative placement; not exact Sepang kerbs    |
| Grass                      | Shared muted ground plane                                                                       | Generalized surroundings, not surveyed land cover |
| Gravel                     | Two narrow normalized-range regions, rough material with subtle shader grain                    | Illustrative zoning; not verified gravel traps    |
| Pit lane                   | Explicit nullable XYZ path metadata boundary; currently absent                                  | No spatial source available; not rendered         |

Ranges and side choices are isolated in `foundationConfig.ts` so sourced zone metadata can replace the illustrative configuration. They do not alter the path. Detailed runoff is intentionally sparse. Pit timing records are not treated as pit-lane coordinates; no invented entry, exit or pit complex is shown.

## Barriers

Two short visual-only concrete barrier runs use the same profile-sweep utility, merged into one static geometry and one material. They have shallow vertical faces and sit outside the visual road/shoulder. This gives a lightweight boundary/depth cue without thousands of independent objects, transparent fence grids or prop downloads.

Their placement, dimensions and type are illustrative, not a verified Sepang safety-barrier inventory. The profile/range mechanism can later support other barrier sections. Detailed tyre stacks, catch fencing and accurate placement remain deferred.

## Cars

The optimized 1,217,688-byte runtime GLB is untouched, as is the 28,870,892-byte reference GLB. The standard model still has 30,518 vertices and 40,006 triangles, with zero embedded textures. The source is never requested by the car renderer.

`CarMarker` still uses the original progress position, tangent heading, Z=0.015 plus the small per-index separation, visual scale, selection marker and screen-facing labels. Keeping road top Z=0 allows the same grounding without altering race calculations. Close inspection confirmed cars above the road rather than buried in the terrain; model scale remains the existing visual aid, not physically scaled survey geometry.

FAR marker, MEDIUM silhouette, NEAR GLB, projected-size hysteresis, lazy loading, shared resources and error/loading fallback remain intact. The oblique overview has a different fitted scale, so the former 1.44× reference can still be FAR: this pass observed MEDIUM at 1.73× and NEAR at 2.49×. Thresholds were not weakened to force particular zoom labels.

## Camera

The default remains orthographic engineering projection, now tilted 48° from vertical with a -20° orbit angle. Neutral elevation plus this view reveals road sides, kerb height, barrier faces and the ground foundation. Camera fitting accounts for rotated width and projected height while retaining the existing overview scale ceiling.

- **3D view / Top view:** switch between 48° tilt and vertical inspection.
- **Rotate ±15°:** controlled orbit around the current target.
- **Zoom:** existing 0.75–2.5 range and 1.2 step.
- **Pan arrows:** move the target in ground-plane camera directions.
- **Focus selected:** center once on the current selected-car position and use close zoom. It does not follow/chase the car; pause replay for stationary inspection.
- **Reset view:** restore the full-circuit engineering overview, target, orbit and zoom.

The pure `EngineeringView` target/angle/tilt structure can later accommodate sector focus or other input devices. No gesture recognition, gesture mapping, navigation or race-game driving camera was added. Existing zoom/rotate gesture receivers remain connected.

## Lighting

The existing neutral hemisphere and single directional light are retained. Standard rough materials and geometric normals reveal depth without cinematic color or post-processing. No dynamic shadow maps, expensive contact-shadow pass, extra lights or bloom. Road/ground separation provides inexpensive grounding; physically accurate car contact shadows remain a possible later measured enhancement.

## Materials

Module-owned shared materials cover asphalt, edge paint, concrete shoulder, grass, terrain sides, gravel, barrier and kerb vertex colors. Asphalt and gravel use a very small procedural grain modulation in their standard shader. No image download, displacement, 4K texture, transparency layer or per-segment material instance is added.

Static ribbons are created once and merged by purpose. Temporary merge inputs are disposed. Shared geometries/materials are retained for application lifetime with `dispose={null}` so session changes do not invalidate resources used by the other scene. Normal per-instance JSX geometries such as the start-line squares retain R3F ownership. Development hot reload can retain module caches until page reload; renderer memory counters should be measured from a fresh load and interpreted as resident allocations rather than only visible objects.

## Performance Structure

Final clean-reload structural snapshots from the local Chromium preview, 1280×720 CSS viewport, DPR 1, synthetic 20-car replay at 5×. Whole-scene counts include labels' markers, hit geometry allocations, start-line squares, terrain and selection. Counts are not FPS certification.

| View               | Draw calls | Triangles/frame | Renderer geometries | Textures |
| ------------------ | ---------: | --------------: | ------------------: | -------: |
| FAR — 1.00×, 3D    |         37 |          24,478 |                  38 |        0 |
| MEDIUM — 1.73×, 3D |         57 |          26,398 |                  39 |        0 |
| NEAR — 2.49×, 3D   |         35 |         704,428 |                  40 |        0 |

These are sampled frames, not averages. The earlier development hot-reload snapshots retained seven extra geometry allocations; the table uses the subsequent clean-reload values. Frustum culling, selection, session transitions and resident allocations affect counts; lower NEAR draw calls do not mean all 20 cars are visible. All 20 detailed instances shared exactly one car geometry. The physical foundation adds a small fixed number of meshes, not one object per road sample. No new asset download or texture allocation is introduced by the environment.

FAR and MEDIUM requested no car GLB. NEAR made one runtime request: 1,217,688 body bytes / 1,217,988 reported transfer bytes on the temporary no-store validation server. No original GLB or embedded car images were requested. The existing SVL concept image is application branding and unchanged.

Overall performance acceptance remains **not established**. This pass used background browser automation with intermittent control delays; it did not establish continuous foreground visibility or a stable low-load machine baseline. It records structural metrics only and makes no new FPS comparison with historical V2.2/V2.3 results. Do not treat this as accepted sustained multi-car performance.

## Regression

- **130 tests passed:** 87 frontend + 43 backend. The actual starting repository had 125 tests from the completed car work; all remain, plus five foundation tests. The brief's older 119-test baseline was not used to discard tests.
- New tests pin the pre-change coordinate file; verify identical neutral position/tangent/progress, closed road seam, width/depth, normals/UVs, elevated surface-frame compatibility, raised kerb output and camera orthogonality.
- Existing movement, lap advancement, replay, telemetry, selection-related contracts, model transforms/resource sharing and LOD transition tests remain passing.
- TypeScript and production build passed. The existing large-JavaScript-chunk advisory remains; no dependency was added.
- Browser: 20 moving synthetic cars, FAR/MEDIUM/NEAR, standings selection of car 88, circuit selection of car 75, inspector/telemetry following selection, pause and rewind from 05:48 to 05:38, top/3D toggle, panning, focus-selected and reset overview.
- Normal browser rendering produced no shader/runtime errors during the checked scene.
- A server-induced GLB 404 verified the lightweight fallback: 20 NEAR labels, zero detailed meshes, continued replay and working standings selection/inspector. Failure injection was removed, and a clean reload restored all 20 detailed instances with one shared geometry. Neither GLB nor the application model URL was modified.

## Accuracy Matrix

| Element           | Status                                                          | Source/method                                                                             |
| ----------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Circuit path      | EXISTING / previously layout-cross-checked; not survey-verified | Unchanged Bacinger community coordinates, projection and spline; local verification notes |
| Elevation         | UNAVAILABLE; neutral Z=0                                        | No elevation dataset in repository                                                        |
| Track width/depth | VISUAL APPROXIMATION                                            | Constant configured mesh cross-section                                                    |
| Kerbs             | ILLUSTRATIVE                                                    | Sparse normalized ranges, raised procedural profiles                                      |
| Runoff            | GENERALIZED / ILLUSTRATIVE                                      | Continuous shoulder plus two gravel regions; no classification survey                     |
| Pit lane          | UNAVAILABLE / deferred                                          | Null spatial metadata; no fabricated path                                                 |
| Terrain           | SYNTHETIC FLAT FOUNDATION                                       | Bounds-based plane and shallow base, not measured topography                              |
| Barriers          | ILLUSTRATIVE                                                    | Two merged profile runs, no placement inventory                                           |

## Screenshots / Visual Findings

Browser screenshot inspection covered the oblique full-circuit overview and selected-car close view. The foundation now presents a rotated ground slab with visible boundaries rather than the former empty grid. Road width, thin side faces, raised alternating kerbs, concrete shoulder, gravel patches and short barrier faces form separate spatial layers. Cars and turquoise selection rings occupy the same world-space road, while labels remain screen-facing annotations.

The first inspection exposed coplanar ground flicker; the ground plane/base separation corrected it. The camera framing was then adjusted to expose foundation corners and fit rotated views. At full-circuit distance, intentionally small surface details are subtle; close focus and top/3D switching make their physical relationships clearer. Screenshots were inspected through the browser tool; no generated circuit image or external Sepang GLB was substituted for data-driven geometry.

## Remaining Limitations

- No measured elevation, banking, variable width, detailed runoff/kerb/barrier map or pit lane. This is not yet an engineering-survey digital twin.
- Illustrative ranges may differ substantially from real site layouts and must be replaced with sourced spatial metadata before any accuracy claim.
- The terrain is a flat rectangular foundation; no real earthworks, drainage, curbs beyond the samples, buildings or vegetation.
- Cars retain the pre-existing visual scale and flat heading model. Measured elevation requires a coordinated car-surface adaptation; no suspension simulation is implied.
- No dynamic/contact shadows, physically authored surface maps or wet-surface visuals. Surface grain is deliberately subtle.
- Labels can still overlap when cars cluster. Camera controls are discrete buttons; free dragging and sector-focus UI are future interactions.
- Barrier runs use lightweight profiles rather than detailed modular safety hardware. No catch-fence or impact-physics claim.
- Performance acceptance remains pending a controlled foreground run on a stable machine.

## V2.5 Recommendation

First obtain and document reliable spatial references for pit entry/lane/exit, widths, elevation and safety zones. Then add a small number of correctly placed, low-cost Sepang landmarks (pit building or a principal grandstand) with measured scale and shared resources. Keep verified data separate from illustrative props and measure cost incrementally. No V2.5 environment modelling, new car assets, liveries, weather, strategy overlays or gesture changes have been started.
