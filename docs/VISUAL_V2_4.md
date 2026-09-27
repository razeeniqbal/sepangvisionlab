# Visual V2.4 — Formula Car Asset System

## Overview

V2.4 establishes reusable asset, livery, identity and tyre interfaces around the V2.3 standard Formula car. It retains the existing circuit, camera, representation thresholds, replay, selection, telemetry and race domain. No environment work or V2.5 implementation is included.

The standard car now has configurable shared surface parameters, a restrained SVL finish, and data-driven sidewall compound accents. A hero request explicitly resolves to the standard model while an externally authored hero asset remains pending. No replacement hero geometry is claimed.

### Files changed

- `src/components/cars/formulaAssets.ts` — new asset manifest and explicit standard/hero resolver.
- `src/components/cars/carVisualState.ts` — new visual compound normalization and identity types.
- `src/components/cars/formulaLivery.ts` — shared configurable material library, SVL palette and sidewall shader.
- `src/components/cars/formulaVisual.ts` — runtime URL comes from the manifest; transform adapter unchanged.
- `src/components/cars/FormulaCar.tsx` — resolve presentation and apply shared livery/compound material.
- `src/components/cars/CarRepresentation.tsx` — pass visual identity and compound to NEAR only.
- `src/components/cars/CarMarker.tsx` — read compound from the existing field, update only when it changes, expose identity metadata on the existing label.
- `src/components/circuit/CircuitScene.tsx` — supply `tyresKnown={!historical}`; no scene/circuit/camera geometry changes.
- `tests/formulaSystem.test.ts` — six additional tests.
- `docs/VISUAL_V2_4.md` — this report.

An SHA-256 audit of pre-existing `src` files found changes only in the six existing component files above. Both GLBs remain byte-for-byte unchanged. Temporary inspection/measurement pages are removed after validation and are not product features.

## Formula Car Architecture

| Boundary        | Responsibility                                | Current behavior                                                                     |
| --------------- | --------------------------------------------- | ------------------------------------------------------------------------------------ |
| LOD0 / hero     | Explicit future inspection or promotional use | `presentation="hero"` resolves to LOD1 with `heroPending: true`; no hero URL/request |
| LOD1 / standard | Normal NEAR race visualization                | Existing optimized runtime GLB via cached Drei `useGLTF`                             |
| LOD2 / distant  | Overview readability and lightweight geometry | FAR marker/number; MEDIUM existing 96-triangle silhouette plus marker                |

`CarMarker` owns race placement and application selection. `CarRepresentation` chooses the existing size tier. `FormulaCar` resolves the asset and shared visual material. `createFormulaVisual` adapts model coordinates without changing the race path. Identity and tyre data do not select another chassis GLB.

V2.3 projected-size switching and hysteresis are unchanged. There is no automatic hero promotion for selection or the 20-car grid. No preload was added: FAR and MEDIUM do not request the runtime GLB.

## Master Car

The existing generated generic Formula-style car remains the master standard vehicle, including its wings, nose, open wheels, suspension, cockpit/halo, sidepods, floor and rear bodywork. It is not represented as an exact real Formula 1 chassis or an officially affiliated vehicle. Generated topology is retained rather than re-authored during this task.

- Reference: `public/assets/models/cars/svl-formula-car-v1.glb`.
- Runtime: `public/assets/models/cars/svl-formula-car-runtime-v1.glb`.
- One mesh / one shared geometry; 30,518 position vertices and 40,006 triangles.
- Coordinate correction remains quaternion `(0.5, 0.5, 0.5, 0.5)`; normalized length remains 1.05 units (approximately 0.918823 scale).
- Existing 0.48 body scale / 0.7 active scale, centering, bounding-box grounding, track anchor and tangent heading are unchanged.
- No new shadow, lighting, post-processing, compression dependency or texture asset.

The current filenames/URLs are preserved to avoid churn. Future authoring assets can use `models/cars/source-reference/`, validated exports `models/cars/runtime/`, and optional livery/tyre textures `textures/cars/`. Team branding should remain separately owned under `brands/teams/` and referenced by a replaceable profile.

SHA-256:

```text
Source:  7350a5feaa9aa6afcfa874b85c06f257bb57f1544fd5d75e3b8fe3dd9fe7ed3b
Runtime: d67e120423989e4b94b8ec725e5f849f85728f89323da1835b8728bd955f32bf
```

## Material System

`FormulaLiveryDefinition` separates a profile ID, palette (body, secondary, mechanical/carbon, rubber, accent, technical detail), roughness, metalness and an optional shared body map from the chassis geometry. `createFormulaMaterialLibrary` accepts a finite profile registry and a fallback profile. Unknown profile IDs resolve to the fallback; arbitrary driver names cannot grow the cache.

The material cache is keyed only by resolved profile ID and normalized compound, at most six variants per configured profile. Twenty cars with the same compound/profile share the same material object. Different compounds require independent uniform values but share shader code/program configuration. Selection, driver IDs and numbers are not material keys.

The optional texture is caller-owned, prepared for glTF UVs (`flipY=false`, sRGB), and shared by all compound variants of its profile. No texture is loaded by the default implementation. Future profiles are configured centrally in the material library; this milestone does not add a livery editor, upload UI or real-team pack.

## SVL Livery

The default `svl-development` profile uses graphite `#323a3c`, secondary graphite `#293235`, dark mechanical/carbon `#202527`, rubber `#191b1c`, restrained turquoise `#008e88`, and a small white-grey technical nose tick `#b5bfbe`. Body/carbon/rubber roughness is 0.62/0.78/0.96; body/mechanical metalness is 0.2/0.3. Tyres are non-metallic.

The existing narrow turquoise nose treatment remains. Secondary shoulders and the tiny technical tick do not add geometry or textures. No glowing panels, sponsor marks or new real-world logos are added. Existing application identity/branding UI outside the car asset is unchanged.

## Tyre System

| Compound     | Sidewall accent                  |
| ------------ | -------------------------------- |
| SOFT         | Restrained red `#b54e52`         |
| MEDIUM       | Muted yellow `#c9b35d`           |
| HARD         | White-grey `#c6cdca`             |
| INTERMEDIATE | Green `#4a996d`                  |
| WET          | Blue `#4387bb`                   |
| UNKNOWN      | Neutral rubber; no compound ring |

The marker reads the existing field's compound each frame, but updates React visual state only when its normalized value changes. The standard car selects the shared material for that compound. A thin asset-local sidewall ring is masked in the existing shader, adding no meshes, textures, transparent layers or draw calls. The whole tyre remains dark rubber.

Historical timing data has no reliable compound. Its existing adapter contains a MEDIUM placeholder; `tyresKnown=false` explicitly prevents that placeholder from becoming a claimed tyre choice. Domain/adapters are unchanged. Synthetic SOFT/MEDIUM/HARD remain driven by their existing data. INTERMEDIATE/WET are supported by the visual interface and tested independently; this does not add weather or race-state simulation for those compounds.

## Identity

`CarVisualIdentity` supports number, driver ID, optional short driver ID, team ID and livery ID. Current integration uses the existing car number/ID. Optional short/team values become label title text through `carIdentityText`; the existing visible number remains authoritative and readable at distance. The livery ID chooses a registered profile or fallback.

No per-number geometry, tiny painted number requirement, separate driver GLB or invented historical team livery. Actual historical driver/team information remains in the established application panels.

## Selection

The existing turquoise marker, ground ring, label border and active enlargement remain outside `FormulaCar`. Selecting a car does not recolor its chassis, choose a different asset, create a material variant or change compound. Standings and circuit labels continue selecting the same application entity for inspector/telemetry/replay.

## Resource Sharing

- One cached GLB load by URL, shallow resource sharing through cloned scene transforms; all 20 detailed cars reference the same BufferGeometry.
- No independent texture copies; zero car textures in the default runtime path.
- Shared finite material cache, rather than one material per driver. The live resource observer confirmed 20 instances sharing exactly one car geometry and three dry-compound material objects (six shader programs for the whole scene).
- Existing merged lightweight silhouette, marker geometry and marker materials stay shared.
- `dispose={null}` prevents per-car unmounts from disposing resources still used by other cars. GLTF/cache resources are intentionally retained for the application lifetime.
- A custom material library exposes `dispose()` for its owner to call after all users unmount. It disposes owned materials and clears the cache, but never disposes borrowed textures. No per-frame material/geometry construction.
- Changing compound/profile can rebuild the lightweight object hierarchy; expensive geometry remains shared. This is a state-change cost, not a frame-loop allocation.

## Asset Metrics

| Asset                  |                    Size | Vertices | Triangles |        Textures | Purpose                                            |
| ---------------------- | ----------------------: | -------: | --------: | --------------: | -------------------------------------------------- |
| Original source GLB    |        28,870,892 bytes |   30,518 |    40,006 | 3 embedded PNGs | Preserved reference; not requested by car renderer |
| Standard runtime GLB   |         1,217,688 bytes |   30,518 |    40,006 |               0 | Shared LOD1 / NEAR                                 |
| Lightweight silhouette | Procedural; no download |      192 |        96 |               0 | Existing MEDIUM / loading / error fallback         |
| Hero GLB               |            Not supplied |        — |         — |               — | Explicit pending boundary; resolves to standard    |

Runtime remains 95.78% smaller than the source. V2.4 does not change asset sizes, vertex/index data, UVs or node transforms. Original AI-generated pseudo-sponsor textures remain only in the untouched reference asset; they are absent from the runtime GLB and default rendering.

## Rendering Metrics

Structural observations on 2026-09-27, same local Windows/Chromium 153 IAB session, 1280 × 720 CSS viewport, DPR 1, synthetic 20-car field at 5×. These are individual renderer snapshots after representations settled, not average FPS benchmarks. Camera zoom controls were used without changing camera code.

| View           | Draw Calls | Triangles | Geometries | Textures |
| -------------- | ---------: | --------: | ---------: | -------: |
| FAR / 1.00×    |         33 |    36,240 |         34 |        0 |
| MEDIUM / 1.44× |         49 |    37,952 |         35 |        0 |
| NEAR / 2.49×   |         19 |   316,058 |         36 |        0 |

Whole-scene counts include the circuit and selection. Zoom and moving-car frustum culling change draw calls/triangles; NEAR's lower draw-call count does not mean all 20 cars are on-screen. All 20 standard instances were present at NEAR. Geometry memory counts can retain the shared lightweight representation used during loading. The new material/tyre treatment adds no geometry, texture or per-car draw call over V2.3; its extra fragment-shader arithmetic is not claimed to be free.

Network check used a temporary local no-store server. FAR and MEDIUM had no GLB request. NEAR made one runtime request: 1,217,688 encoded body bytes / 1,217,988 transferred bytes including reported overhead; observed local resource duration approximately 9.9 ms (not a portable load-time benchmark). No original GLB or car image/texture requests occurred. The existing 1,271,356-byte SVL concept image is application branding, not a car texture, and was not changed.

FPS acceptance remains deferred. A spot check showed 46% total CPU and approximately 1.22 GiB free physical memory of 15.75 GiB, with intermittent browser-control delays. This does not establish a sustained idle/low-load test condition. The background validation observer also saw approximately one-second frame scheduling despite page focus flags, so its automated timing samples were excluded as throttled. No controlled V2.4 FPS certification or comparison against the historical V2.2 54.6 FPS result is claimed. Prior pressure-affected V2.3 measurements remain diagnostic, not evidence requiring a renderer redesign.

## Regression

- **125 tests passed:** 82 frontend tests and 43 backend tests; original 119 preserved plus six new V2.4 tests.
- **TypeScript passed** (`tsc -b`).
- **Production build passed**; existing large-chunk advisory remains, with no new dependency.
- Tests cover asset resolution, unknown compounds, five compound accents, bounded material reuse, independent uniforms, optional borrowed maps/disposal, and identity labels. Existing geometry-sharing, runtime asset, transform/heading, representation, race/replay/telemetry tests remain intact.
- Browser checks: moving 20-car synthetic replay; FAR → MEDIUM → NEAR; standings selection of car 88; circuit selection of car 75; inspector and telemetry follow selection; pause and rewind reduce 06:29 to 06:19 while paused.
- Historical labels all report UNKNOWN compound rather than the placeholder MEDIUM.
- Isolated visual inspection confirmed thin SOFT red and WET blue sidewall rings, neutral UNKNOWN tyres and explicit hero-to-standard fallback. No shader errors occurred in the normal inspection view.
- A temporary server-induced runtime GLB 404 produced the existing lightweight fallback with 20 selectable labels, ongoing replay and a working car-88 inspector. No source asset or application URL was edited for this failure test. Failure injection was removed afterwards; a fresh load again confirmed 20 detailed instances sharing one geometry and three materials.

No race-state, track progress, lap, replay, telemetry, backend, weather, strategy, ML or gesture implementation was modified.

## Limitations

1. LOD0 asset creation is pending external modeling. The current standard is deliberately retained, not relabeled a new high-detail hero.
2. The standard asset is one merged generated mesh. Body/carbon/tyre and ring masks are calibrated to its local geometry, not semantic material slots. They must be revalidated for a replacement mesh. This is a restrained compound indicator, not an engineering-accurate tyre construction or rotating sidewall simulation.
3. Wet/intermediate tread geometry, tyre deformation/wear, authored carbon weave and fully authored UV livery packs are not implemented. No claim of measured physical material accuracy.
4. Only SVL is registered in the production default library. Alternate profile and optional-map support is tested, but a real-team/historical livery library and application selection UI remain future work.
5. Runtime resources intentionally stay cached for the application lifetime. Any future cache eviction must coordinate GLTF and material ownership across all users.
6. Overall performance acceptance remains pending a stable controlled foreground run. Structural resource sharing is verified; stable FPS is not certified.

### External hero asset specification

Provide a neutral, professionally authored generic open-wheel car as a static glTF 2.0 binary. Include believable front wing/nose/suspension/open wheels/cockpit/halo/sidepods/floor/rear bodywork/rear wing/diffuser. No copied exact real chassis, official logos or embedded sponsor text. Supply editable source separately from the runtime export.

Use semantic mesh/material slots for body primary/secondary, carbon, metal and rubber/sidewalls, clean normals and UVs, and documented units, forward/up axes and wheel-contact bounds. Prefer the standard asset's coordinate convention or supply an explicit asset adapter; never recalibrate race-domain coordinates. Keep texture use optional and modest. Validate silhouette, grounding and material masks at existing camera scales. Establish a measured polygon/texture budget before adding the hero to the manifest; load it only for explicit inspection, never automatically for the whole grid. LOD1 remains the race default and fallback.

## Next Recommendation

Commission and review that external hero asset against the existing standard before a dedicated inspection milestone. Separately, repeat controlled foreground performance acceptance when machine load is demonstrably stable. V2.4's asset/livery/tyre boundaries are ready for that work; no V2.5 or environment asset generation has been started.
