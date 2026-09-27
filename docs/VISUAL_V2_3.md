# Visual V2.3 — Runtime asset optimization and car readability

Completed 2026-09-26. V2.2 is the visual baseline. Geometry, camera behaviour, circuit, race state, replay, telemetry, backend, strategy/weather and ML were not changed. V2.4 is not started.

## Runtime asset

V2.2 overrides the material only after `useGLTF` has parsed the asset. Its embedded PNGs are part of the same GLB response and are decoded as dependencies of the original material. Removing maps from the runtime material cannot remove those bytes from the request or loader cache.

`scripts/optimize_formula.py` creates `public/assets/models/cars/svl-formula-car-runtime-v1.glb`. It retains accessor-referenced buffer views, copies their bytes losslessly, repacks aligned offsets, retains nodes/scenes/mesh primitives, and removes unused material/image/texture/sampler data and the material-only extension declaration. It makes no geometry simplification, quantization, texture resizing or compression. It rejects unsupported asset structures rather than silently attempting a general GLB conversion.

The original `svl-formula-car-v1.glb` is untouched. Its SHA-256 remains `7350a5feaa9aa6afcfa874b85c06f257bb57f1544fd5d75e3b8fe3dd9fe7ed3b`. The source stays in the project as the editable reference; it is not requested by the car renderer.

| Property | Source GLB | Runtime GLB |
| --- | ---: | ---: |
| File/body bytes | 28,870,892 | 1,217,688 |
| Approximate decimal MB | 28.87 | 1.22 |
| Embedded textures | 3 × 4096² PNG | 0 |
| Authored materials | 1 | 0 (application override) |
| Mesh geometries | 1 | 1 |
| Vertices | 30,518 | 30,518 |
| Triangles | 40,006 | 40,006 |
| Geometry buffer bytes | 1,216,612 | 1,216,612 |

The saving is 27,653,204 bytes, approximately 95.78%. An automated regression test compares every accessor descriptor and buffer-view payload byte, all scene/node transforms and every primitive except its removed material assignment. UVs and normals are preserved exactly.

V2.1/V2.2 visual normalization remains 1.05 units long, approximately 0.9188233 asset scale, correction quaternion (0.5,0.5,0.5,0.5), and existing 0.48/0.7 normal/active display scale. The V2.2 graphite/turquoise shared material is unchanged. The loader's default material is replaced before the model is rendered.

## Readability and future LOD boundary

`carDetail.ts` selects a display tier using projected CSS-pixel length, independent of device-pixel ratio and selection enlargement. The renderer reads the existing camera projection and distance; it never changes the camera. Orthographic zoom and perspective depth are supported. Hysteresis avoids repeated switching near thresholds:

- Far to medium at 18 px; medium returns to far below 16 px.
- Medium/far to near at 28 px; near stays near until below 24 px.
- Large zoom changes can jump directly between tiers.

At the tested viewport, normal length is ~15.78 px at 1×, 22.73 px at 1.44× and 39.27 px at 2.49×, so every tier is reachable with the existing controls.

Far uses a neutral, eight-pixel diamond marker plus the existing car number. Medium adds a restrained graphite silhouette made from eight merged boxes (96 triangles, one shared geometry/material), with a smaller marker. Near uses the optimized GLB and removes the ordinary marker so the detailed car dominates. Labels remain available in every tier. Selected cars retain the label/enlargement and use a turquoise marker/ring and turquoise label border; selection does not recolour or clone the shared car material.

The old transparent picking disk remains raycastable but its material is not rendered, avoiding 20 otherwise invisible draw calls. All hit handling still calls the existing `onSelect` path. Labels, standings, inspector and telemetry retain driver IDs and existing behaviour.

`CarRepresentation` separates display policy from geometry and race data. `CAR_LOD_SLOT` maps the lightweight far/medium representations to LOD2 and the standard near model to LOD1. A future LOD0 hero model can be added at this boundary; no new hero asset or automatic LOD0 tier is implemented. This is a lightweight representation policy, not a new asset-generation pipeline.

The GLB loads only when the near tier is first needed, through one shared `useGLTF` URL/cache. Far/medium views do not request it. Scene hierarchies remain independent, while geometry and livery material stay shared. Returning to near reuses cached resources. The lightweight geometry, marker geometry and materials are module-owned shared resources; driver unmounts do not dispose them. Loading/failure in the near tier uses the same lightweight silhouette and retains selection/labels.

## Transfer, loading and performance

Local Vite server, Windows in-app browser, approximately 1280 × 900, synthetic 20-car replay at 5×. Temporary diagnostics were removed after validation. Network body bytes exclude HTTP headers.

Direct local HTTP reads with no client cache measured 28,870,892 bytes / 1,585 ms for the source and 1,217,688 bytes / 29 ms for the runtime asset. Both responses were uncompressed and Content-Length matched the received body. These are individual localhost transfer measurements, not internet or end-to-end rendering guarantees.

The browser reported one optimized GLB resource with encoded body size 1,217,688 bytes, 80 ms duration and transferSize 300 bytes on a cache-revalidated request. The 300-byte result is cache/header accounting, not the uncached asset size. First observed mesh availability was about 160 ms after entering the near tier in that sample. A fresh far-tier visit made no GLB request. There are no image requests from the optimized car.

Both V2.2 and V2.3 shared overrides upload zero car textures. V2.3 additionally removes the original embedded-image download/decode/cache cost. It avoids the source's estimated 192 MiB decoded image data; actual process/GPU memory was not profiled. Source-material V2.1 used three GPU textures, estimated at 256 MiB including uncompressed RGBA8 mipmaps. Mesh/geometry counts do not multiply by driver count.

The accepted V2.2 visible-preview baseline remains 54.6 FPS (original textured material: 41.8 FPS). During V2.3 testing, the preview repeatedly throttled to approximately one frame per second despite reporting document visibility. A fresh-tab, pre-final far-tier sample reached 48.0 FPS, but later samples included long throttled intervals. These readings are not a reliable same-condition comparison. The user explicitly requested finishing with this measurement limitation documented. **The 54.6 FPS target is not certified as met; no stable FPS improvement or regression is claimed.**

Final rendering counters are recorded below separately from unreliable timing. They include the unchanged circuit, labels and selection, and vary with frustum culling/hover. Near zoom naturally shows fewer cars inside the camera than the full-circuit view, although all 20 instances exist.

| Scene sample | Draw calls | Triangles/frame | Renderer geometries | Textures |
| --- | ---: | ---: | ---: | ---: |
| V2.2 recorded 20-car overview | 53 | 836,520 | 34 | 0 |
| V2.3 far overview, fresh load | 33 | 36,240 | 34 | 0 |
| V2.3 medium, 1.44× | 52 | 38,152 | 36 | 0 |
| V2.3 near, 2.49×, 20 loaded GLB instances | 20 | 356,064 | 36 | 0 |

Geometries here are renderer-wide counts, not unique car mesh counts. The near figure reflects frustum culling at 2.49×; it must not be read as a reduction of the retained 40,006-triangle car geometry. The medium sample was taken before the final hysteresis return threshold was tightened from 14 to 16 px so Reset view returns to far at this viewport; that change does not change medium geometry.

Reduced asset bytes/triangles and removed invisible draw calls are confirmed; they do not substitute for a future foreground frame-time benchmark on the same machine. Retest 20 moving cars after warmup with the preview continuously foregrounded, consistent viewport and playback speed, and compare both full-track and near views. Do not add cosmetic rendering expense before that check.

## Regression validation

76 frontend tests and 43 backend tests pass (119 total). The new tests cover tier hysteresis/direct jumps and lossless runtime-asset preservation; existing tests cover shared materials, grounding/orientation, replay, simulation, telemetry and backend contracts. TypeScript and production build pass; the existing large bundle warning remains.

Browser validation covers far markers, medium silhouettes, near GLB loading, synthetic movement/lap advancement, standings selection, keyboard circuit-label selection, inspector/telemetry updates, replay pause/rewind and historical replay/selection. Forced missing-runtime-URL validation showed zero GLB meshes, visible lightweight fallback cars and a working selected-car inspector; the real URL was restored. No camera permission was requested.

Final real-asset checks showed no unexpected console errors; the expected missing-URL errors were confined to the forced fallback test. Temporary diagnostics and the missing URL were removed. Direct pixel-tier changes preserve the original getPointAt/getTangentAt/atan2 path and anchor. No model or camera scaling was changed to improve readability.

## Files changed

- `scripts/optimize_formula.py` — deterministic source-preserving runtime generation.
- `public/assets/models/cars/svl-formula-car-runtime-v1.glb` — optimized delivery asset.
- `src/components/cars/formulaVisual.ts` — runtime asset URL only.
- `src/components/cars/FormulaCar.tsx` — resource-ownership comment.
- `src/components/cars/carDetail.ts` — projected-size tier policy and future LOD slots.
- `src/components/cars/CarRepresentation.tsx` — shared markers/silhouette/standard-car rendering and fallback.
- `src/components/cars/CarMarker.tsx` — visual tier selection, marker scaling and turquoise selection; existing progress/heading source preserved.
- `tests/carDetail.test.ts`, `tests/formulaAsset.test.ts` — new regression checks.
- `docs/VISUAL_V2_3.md` — this record.

## Remaining limitations and next recommendation

Labels can still overlap when cars are colocated; standings and keyboard selection remain available. The lightweight silhouette is intentionally approximate. Tier transitions are discrete, with hysteresis rather than costly crossfades. The standard asset remains 40,006 triangles, and a future LOD0 hero is only an architectural extension point. The retained source file is still copied into a normal Vite public build, increasing deployment storage even though clients do not request it; packaging it separately can be considered later without deleting the source.

Next recommended work is a controlled foreground performance acceptance pass before choosing V2.4 scope. No V2.4, new circuit material, environment asset, backend change or race-logic change is included.


## Performance Acceptance

Validation pass: 2026-09-26–27. **Final status: performance acceptance NOT ESTABLISHED.** Functional, asset/network and automated regression checks passed, but the observed timing is not stable enough across the session to certify a trustworthy V2.3 baseline. No application implementation or asset was changed, and V2.4 was not started.

### Conditions and method

Same Windows machine and Codex in-app browser throughout; reported browser Chrome 153.0.0.0, viewport 1280 × 900 CSS pixels, DPR 1. Synthetic replay, 20 moving cars, 5× speed, existing camera at 1.00× / 1.44× / 2.49×. Tests/build completed before measurement. No DevTools throttling was enabled by the test.

A temporary Vite measurement server at localhost:5176 loaded the existing main entry unchanged. An observer used R3F's after-frame hook and existing renderer information; it did not insert scene objects, change the camera, change race state or alter materials/assets. Reports were written to a hidden diagnostic DOM element and local test log. The temporary observer and server were removed afterward. Hash comparison confirmed every existing `src` file, both GLBs, package.json and vite.config.ts remained unchanged.

Each view had 10 seconds of warm-up followed by two independent 20-second windows. Sampling required document focus, visible state, 20 labels in the expected tier, active synthetic replay and 5× speed on every sampled frame; near additionally required all 20 detailed GLB instances. Blur/hidden/paused states would discard the incomplete windows and restart warm-up. Completed windows recorded zero focus/visibility interruptions. The replay was reset between views using existing controls. The original source GLB was never removed or renamed.

The rows below aggregate both windows by total frames / elapsed seconds; frame time is elapsed time / frames. Draw calls and triangles are per-frame averages, not fixed budgets. Near zoom culls off-camera cars, so its draw count and triangles vary with position even though all 20 models are loaded.

| View | FPS | Frame Time | Draw Calls | Triangles/frame | Geometries | Textures |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Far | 36.13 | 27.68 ms | 33.00 | 36,240 | 34 | 0 |
| Medium | 23.37 | 42.78 ms | 47.54 | 37,909 | 35 | 0 |
| Near | 17.48 | 57.19 ms | 19.80 | 318,013 | 36 | 0 |

Far uses the latest repeat control sample. The initial far sample, recorded before the task continuation, was 55.44 / 57.26 FPS. The current repeat was 34.71 / 37.54 FPS with identical 33 calls and 36,240 triangles. Medium was 23.26 / 23.48 FPS. Near was 14.98 / 20.03 FPS. Within-window p95 frame times were 72.1 / 69.2 ms for the far repeat, 137.9 / 105.5 ms for medium and 203.4 / 138.1 ms for near. Maximum intervals reached 123.2 ms, 377.1 ms and 825.3 ms respectively. These are real captured intervals; slow frames were not trimmed to improve the averages.

Far representation was confirmed by all 20 DOM tier attributes and zero GLB instances. Medium likewise showed 20 lightweight representations and zero detailed instances. Near showed 20 detailed meshes, each with the preserved 30,518-vertex geometry. Medium calls ranged 41–53 and triangles 37,536–38,160; near calls ranged 15–25 and triangles 156,034–476,154. Renderer geometry counts include the unchanged circuit and retained shared resources, not 34–36 separate car models.

### Stability investigation

The initial far pair was reasonably consistent; the medium pair was consistently slow, while near varied materially. Repeating far with exactly the same rendering counters produced substantially worse timing than the initial pair. Windows performance diagnostics then reported total CPU utilization of 96–100% and only 532,928 KiB (~520 MiB) free physical memory out of 16,509,728 KiB. Active CPU consumers included System, OneDrive, Node, ChatGPT, Edge, Memory Compression and the diagnostic PowerShell process. Per-process CPU percentages can exceed 100% because they aggregate cores; they were not interpreted as system percentages.

This provides evidence of significant resource pressure and a confounded comparison. It does not prove that every slow frame came from background activity or exclude application costs. No processes were terminated, no system settings were altered, and no rendering changes were made to obtain a passing result. The application's controls responded in the regression checks, but the captured frame-time spikes prevent a claim of consistently smooth rendering. V2.2's 54.6 FPS remains a historical reference only.

### Network validation

The fresh test origin and `Cache-Control: no-store` responses provided an uncached runtime transfer. The browser resource entry recorded:

- `svl-formula-car-runtime-v1.glb`: 1,217,688 encoded body bytes, **1,217,988 transferred bytes** including browser-reported response overhead, 158.4 ms duration.
- FAR-only and MEDIUM operation produced no GLB request. The runtime request first appeared when NEAR was entered.
- `svl-formula-car-v1.glb` was never requested by the renderer.
- No car texture/image resources were requested; renderer texture count stayed zero. The existing SVL brand PNG is UI artwork and was recorded separately, not mistaken for a car texture.

The transfer duration is a single localhost measurement, not an internet loading guarantee. No embedded maps exist in the runtime asset, and its geometry/source-preservation test passed.

### Regression and final disposition

All **119 automated tests passed** (76 frontend + 43 backend). TypeScript (`tsc -b`) and production build passed; only the existing large-bundle advisory remains. Browser checks confirmed movement/lap advancement, changing standings, standings selection, circuit-label keyboard selection, matching inspector/telemetry, pause/resume, a 10-second backward seek (08:52 → 08:42), and all three visual tiers.

The measurement server temporarily returned HTTP 404 for the runtime GLB, without changing its URL, the source code or either asset. NEAR then reported zero detailed meshes and displayed lightweight fallback cars. Selecting car 88 updated the inspector and preserved its turquoise marker/label. The interception was removed and a fresh load restored all 20 detailed instances. No unexpected console errors occurred outside the deliberate failed-load check.

**Do not mark V2.3 performance accepted from this pass.** Its functional and network checks pass, but a stable performance baseline requires a repeat when CPU and memory pressure are low, with the same foreground conditions and no unrelated workloads competing for resources. This recommendation is investigation only; no V2.4 work was begun. The only retained project change from this acceptance task is this documentation section.
