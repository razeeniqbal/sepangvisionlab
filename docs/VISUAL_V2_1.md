# Visual V2.1 — Formula car integration

## Scope and inspection

Visual replacement only. RaceState, simulation, progress, laps, replay, track geometry, backend, ML, strategy, Monte Carlo, weather and hand tracking code were not changed. AGENTS.md was read; its historical M1 restriction is superseded by the explicit Visual V2.1 request. V2.2 has not started.

Previously CarMarker.tsx created CarBody from boxes with MeshBasicMaterial: silver chassis, per-driver coloured nose/wings, dark wheels and carbon cockpit. CarMarker reads field.current[index].progress; trackCurve.getPointAt supplies XY and getTangentAt supplies heading via atan2(t.y,t.x). CircuitScene samples the existing provider and maps driver definitions to keyed CarMarker instances. Selection is supplied as selectedId/onSelect from the existing workspace; it controls ring, HTML label, inspector/standings and 0.48 normal / 0.7 selected-or-hovered body scaling. These pathways remain intact.

## Loading and transforms

FormulaCar uses Drei useGLTF with the single URL /assets/models/cars/svl-formula-car-v1.glb. Each static scene hierarchy is cloned for independent transforms; geometries, material and textures are shared through the loader cache. No per-driver material recolouring, texture duplication, GLB mutation, decimation or LOD was introduced. dispose=null prevents an individual driver unmount from disposing shared resources. Local Suspense and an error boundary show the existing development body during loading or failure.

Imported model is +Y up and +Z nose after its embedded node rotation. Visual correction quaternion (x,y,z,w)=(0.5,0.5,0.5,0.5) maps +Z to race-local +X and +Y to track-normal +Z. Equivalent nested rotations: +90 degrees about X followed by +90 degrees about Z. Existing tangent heading is then applied by the parent body group, unchanged.

Bounds are centered horizontally and grounded at minimum Z, then normalized to length 1.05 scene units. For this asset (imported length approximately 1.142766), normalization scale is approximately 0.9188233. Existing 0.48 / 0.7 display scaling gives lengths 0.504 / 0.735. This remains deliberately enlarged Race Control marker scale, not a claim of physical chassis dimensions. Visual anchor is Z=0.015 + index*0.0001; selection no longer lifts the whole car to Z=0.4. Ring sits 0.003 below that visual anchor. XY positions and tangent headings were not changed.

One hemisphere light (intensity 2.2) and one directional light (intensity 3) illuminate the original PBR material; existing unlit circuit geometry remains unchanged. No environment downloads or shadow passes were added.

## Asset findings

- 28,870,892 bytes; SHA-256 7350a5feaa9aa6afcfa874b85c06f257bb57f1544fd5d75e3b8fe3dd9fe7ed3b, unchanged after integration.
- One static mesh, 30,518 vertices, 40,006 triangles; no skin or animation requiring skeleton cloning.
- One double-sided PBR material, three embedded 4096×4096 PNGs: colour, normal and packed metallic/roughness.
- KHR_materials_specular contains specularColorFactor [2,2,2]; retained as supplied. Dark/metallic texture and small screen footprint limit detail at full-track zoom.
- Generated texture/pseudo-sponsor artwork remains untouched. Every driver shares that generic generated livery; driver identity remains in labels, rings, standings and inspector. This is not an exact real chassis or an official team/F1/FIA asset.

## Validation and measured observations

71 frontend tests and 43 backend tests passed (114 total); TypeScript tsc -b and production build passed. New tests cover visual bounds, grounding, axis correction, shared geometry/material references, independent instance transforms and invalid bounds.

Local Windows in-app-browser development preview, actual application scene, temporary probe removed afterward:

- Initial historical load: exactly one GLB resource request, 1,121 ms resource duration; first model appearance approximately 2,100 ms after scene mount. These are one local-run observations, not network guarantees.
- Switching to the synthetic scene reused the loaded model, approximately 36 ms until instances appeared, no additional GLB request.
- Historical 19-car paused scene after warmup: approximately 60 FPS, p95 frame interval 18.6 ms.
- Twenty moving synthetic cars: approximately 39–42 FPS over sampled windows, p95 frame intervals 63–68 ms; approximately 836,520 scene triangles/frame, 53 draw calls, three textures. Movement is usable but not consistently 60 FPS on this test setup. Includes normal app UI, dev overhead and temporary measurement overhead; not a GPU-only or production benchmark. No aggressive degradation was applied.
- Three shared 4K RGBA texture chains would occupy roughly 256 MiB including mipmaps if stored uncompressed; decoded image memory can add roughly 192 MiB plus buffer/driver overhead. These are estimates, not measured GPU allocation. Geometry buffers are about 1.22 MB, shared; 20 transform hierarchies do not multiply texture/geometry storage.
- Full-circuit view: body silhouette is small; coloured labels and selection remain the primary identification. At ~2.49× circuit zoom the Formula silhouette is clearer; texture lettering is not useful at this camera distance. No chassis-scale or texture redesign was attempted.

Browser checks: historical and synthetic models; replay motion and lap increments; standings and circuit-label selection (paused for stable targeting); inspector/telemetry updates; pause and rewind; Strategy Lab Max lap 30 (+22.000 s pit-now, +18.550 s delayed); Weather Lab results. Forced missing-URL test showed zero GLB meshes and working development cars with selection; real URL restored afterward. The test never modified the binary asset. Existing numerical/backend tests cover simulation regressions.

## Files changed

- src/components/cars/FormulaCar.tsx — cached loader, suspension and failure fallback.
- src/components/cars/formulaVisual.ts — shared-resource instance creation and visual transform.
- src/components/cars/CarMarker.tsx — visual replacement and ground-level marker placement.
- src/components/circuit/CircuitScene.tsx — lights for PBR cars only.
- tests/formulaVisual.test.ts — transform/resource-sharing tests.
- docs/VISUAL_V2_1.md — this inspection and validation record.

Recommended next task: Visual V2.2 SVL livery/material system, explicitly scoped separately. Consider a later production/device benchmark before choosing texture compression or a performance budget; no LOD work is included here.
