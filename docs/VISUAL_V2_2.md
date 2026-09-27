# Visual V2.2 — SVL livery and material system

Completed 2026-09-26. Visual-only change to the existing generic Formula-style model. No claim of an exact real chassis or official team/F1/FIA affiliation. V2.3 is not started.

## Asset inspection

`public/assets/models/cars/svl-formula-car-v1.glb` remains 28,870,892 bytes, SHA-256 `7350a5feaa9aa6afcfa874b85c06f257bb57f1544fd5d75e3b8fe3dd9fe7ed3b`.

One static mesh/node (`node_0`), one primitive and one double-sided material (`Material.001`) cover bodywork, tyres and mechanical parts. All driver instances previously shared this material. There are no separate tyre/body material groups, skins or animations. Geometry has 30,518 vertices and 40,006 triangles; position, normal, UV and index buffers total 1,216,612 bytes.

The material references three embedded PNG images, all 4096 × 4096:

| Map | Texture index | Compressed image bytes | Purpose |
| --- | --- | ---: | --- |
| Base colour | 1 | 12,551,993 | Generated painted surface and pseudo-sponsor lettering |
| Normal | 0 | 5,125,272 | Generated surface detail |
| Metallic/roughness | 2 | 9,975,047 | Packed PBR surface response |

The source also contains `KHR_materials_specular`, with specularColorFactor [2,2,2]. It is left intact in the GLB; the development override uses standard PBR response instead.

Visual inspection of the base-colour atlas confirmed baked lettering across body and wing islands. Multiplying its colour would retain that lettering. Replacing the material is safe for geometry and silhouettes but removes the original baked colour, normal-map and roughness variation. Vertex normals remain intact.

UVs are finite and within approximately [0.000411, 0.999589] × [0.000414, 0.999586]. None of the 40,006 UV triangles has zero area. They are usable inputs for future livery authoring; this is not certification of non-overlapping islands, seam quality or sufficient texel density. Review the atlas in an authoring tool before painting a custom livery.

## Architecture and appearance

`FormulaCar` accepts an optional typed livery ID, defaulting to `svl-development`. `formulaLivery.ts` owns the profile, palette and shared material factory/cache. Only the development profile is implemented. Future historical-team, digital-twin, prediction and simulation profiles belong at this visual boundary, independently of race-domain data. Selection remains an external marker treatment rather than another asset or texture set.

`createFormulaVisual(scene, material?)` clones only the static object hierarchy and assigns the supplied material to cloned meshes. Geometry, UVs and the original cached scene/material remain unchanged. V2.1 normalization, orientation correction, grounding, heading, movement and selection scale are unchanged.

The development finish uses one `MeshStandardMaterial` with a small `onBeforeCompile` surface-colour/roughness/metalness patch. Object-space calibration is specific to this asset; it does not alter vertex positions, UVs or track calculations. Approximate outer axle regions receive matte rubber; lower surfaces receive a dark mechanical finish; the central nose receives a narrow turquoise accent.

| Surface | Colour | Roughness | Metalness |
| --- | --- | ---: | ---: |
| Graphite body | #323a3c | 0.62 | 0.20 |
| Dark mechanical | #202527 | up to 0.78 | up to 0.30 |
| Neutral rubber | #191b1c | 0.96 | 0 |
| Restrained turquoise accent | #008e88 | body response | body response |

No emissive/neon effect or decorative sponsor logos were added. The source maps are not bound to the rendered material, suppressing base-colour lettering and avoiding any possible generated markings in normal/roughness detail. The original maps and GLB remain unmodified. Close-up inspection showed a clean graphite silhouette, matte tyres and turquoise nose accent.

## Sharing, selection and memory

One cached GLB URL, shared geometry and one cached development material serve all cars. There are no per-driver texture or material clones. `dispose={null}` keeps one unmount from disposing shared resources. Material ownership is application-level; driver selection never edits the shared finish. Existing coloured rings, labels, hover enlargement and selection enlargement remain the identity/selection mechanisms.

Three uncompressed RGBA8 4K maps with mipmaps would use approximately 256 MiB total (85.3 MiB each). Decoded image storage can add approximately 192 MiB. These are format-based estimates, not measured allocation. A fresh V2.2 renderer reported zero uploaded textures because the override does not reference the source maps. However, `useGLTF` still downloads and decodes the unchanged embedded images and retains the source asset cache. V2.2 does not eliminate their transfer or CPU/image-cache cost.

At full-circuit scale none of the three maps demonstrably needs 4K; labels are the primary identity mechanism and body detail is tiny. Future 2K alternatives are technically reasonable: three RGBA8 mip chains would be about 64 MiB total, with about 48 MiB decoded image storage. Normal-map edges and roughness highlights need close-camera comparison before accepting any reduction. No production texture resizing, compression, GLB repacking or LOD was performed.

## Performance observations

Windows in-app-browser development preview, actual 20-car scene, approximately 1290 × 910 viewport. Temporary diagnostic tools were removed afterward. These are local frame-interval observations including UI/dev/probe overhead, not controlled GPU-only or production benchmarks.

| Sample | Mean FPS | p95 frame interval | Draw calls | Scene triangles | Uploaded textures |
| --- | ---: | ---: | ---: | ---: | ---: |
| Recorded V2.1 baseline | 39–42 | 63–68 ms | 53 | 836,520 | 3 |
| Original material recheck, visible preview | 41.8 | 64.6 ms | 53 | 836,520 | 3 |
| V2.2 finish, visible preview | 54.6 | 45.5 ms | 53 | 836,520 | 0 |

The original-material recheck sampled 721 frames; V2.2 sampled 450 frames, after a five-second warmup. This supports no material performance regression in the checked scene; it is not a guarantee of stable 60 FPS. An earlier background/unstable preview sample measured 25.4 FPS, and another throttled to ~1 FPS. Those are not comparable to the visible baseline and are disclosed rather than treated as material cost.

One V2.2 initial historical load recorded a single GLB request at 1,566 ms and first mesh appearance at 4,060 ms, versus V2.1's 1,121 ms / 2,100 ms. Later fresh preview resource duration was 659 ms; cached synthetic remount was 40 ms with no second GLB request. Loading remains variable and still incurs the original 28.9 MB asset cost; no loading-time improvement is claimed.

## Validation and limitations

74 frontend and 43 backend tests pass (117 total). TypeScript and production build pass. Added tests cover shared material identity, absence of generated maps, untouched source material/geometry/UVs, independent transforms and shader integration with the installed Three.js standard shader. The existing build emits its large-chunk advisory.

Browser checks cover 20 moving synthetic cars, historical reconstruction, standings and circuit-label selection, inspector/telemetry updates, pause/rewind, readable labels and unchanged external selection treatment. A forced missing model URL exercises the development-car fallback; the real URL is restored. The binary hash is unchanged. No shader/console errors occurred with the real asset.

Surface masks are approximate, not semantic mesh segmentation. They can cover rims or adjacent suspension and allow the nose stripe onto aligned raised geometry. Fine carbon weave and source normal-map detail are intentionally absent. At full-circuit zoom the graphite silhouette remains small and dark; labels are essential. Shader hooks are tied to Three.js chunks and should be checked on dependency upgrades. The shared material is mutable as a Three.js object, so future code must not mutate it per driver.

No changes to RaceState, historical timing, simulation, laps, replay providers, backend, strategy/weather, hand tracking, ML, circuit rendering or environment assets are part of this milestone.

## Files and next milestone

- `src/components/cars/formulaLivery.ts`: profile and shared procedural material.
- `src/components/cars/formulaVisual.ts`: optional material assignment on cloned meshes.
- `src/components/cars/FormulaCar.tsx`: livery selection at visual boundary.
- `tests/formulaLivery.test.ts`: isolation, sharing and shader tests.
- `docs/VISUAL_V2_2.md`: this record.

Recommended Visual V2.3: texture and asset delivery investigation. Benchmark a production build on target devices, evaluate clean 2K maps and appropriate GPU texture compression, and determine how to avoid downloading unused embedded images while preserving the validated geometry and original source asset. Compare close-up normal/roughness quality, seams, load time and memory before choosing a delivery format. This is a recommendation only; V2.3 and LOD are not implemented.
