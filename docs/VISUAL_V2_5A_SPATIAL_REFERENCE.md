# Visual V2.5A — Spatial Reference Integration

> **Historical document.** It describes the project as it was at the time; parts refer to views, sessions or tools that have since been removed. For the current app see README.md, docs/CIRCUIT_DATA.md and docs/GESTURE_CONTROLS.md.

## Overview

V2.5A adds a typed provenance register, eight sourced geographic anchors, fixed-frame projection diagnostics and an opt-in development overlay. It does not add environment models, change the circuit path, replace the V2.4 foundation or modify race behavior. V2.5B has not started.

Accuracy classes are `OFFICIAL`, `SOURCED`, `DERIVED`, `APPROXIMATE`, `ILLUSTRATIVE` and `UNAVAILABLE`. They describe evidence, not a promise of survey accuracy. `VERIFIED` is deliberately not an accepted class. Geographic coordinates remain nullable; absent data is not converted to `(0,0)` or invented samples.

### Files changed

- `src/data/circuits/sepangSpatialReferences.ts`: source register, validated reference records, facts, classifications and absent-profile interfaces.
- `src/domain/spatialProjection.ts`: reference projection calibrated to the existing circuit and deterministic nearest-path diagnostics. Existing domain modules are unchanged.
- `src/components/circuit/SpatialReferenceDebug.tsx`: eight development-only technical markers and labels.
- `src/components/circuit/CircuitScene.tsx`: gated lazy debug component only; camera, lights, road and car rendering remain unchanged.
- `src/vite-env.d.ts`: Vite compile-time environment types.
- `scripts/spatial-reference-report.ts`: reproducible JSON alignment report.
- `tests/spatialReferences.test.ts`: seven new tests.
- `docs/VISUAL_V2_5A_SPATIAL_REFERENCE.md`: this report.

## Sources

Sources were checked on **2026-09-28**. Unknown publication dates are `null`, distinct from the access date.

| Register key | Organization / document                                                                                                                                                                      | Data and classification                             | Limitations                                                                                                                    |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `sic`        | [PETRONAS SIC — Architecture](https://www.sepangcircuit.com/architecture)                                                                                                                    | OFFICIAL circuit facts and architectural references | Undated page; no local width profile or building footprint                                                                     |
| `timing`     | [SRO / SIC — 2025 supplementary regulations](https://www.gt-world-challenge-asia.com/documents/notice/882/2025%2BGTWCA%2BSupplementary%2BRegulation%2Bas%2B09042025.pdf), Appendix 3, PDF p6 | SOURCED GPS loops and pit configuration             | Document dated 2025-04-09; map bears `06-07-2023` (retained literally). Four-sector event configuration, not surveyed geometry |
| `pitMap`     | [OpenStreetMap contributors via Mapcarta — way 144362327](https://mapcarta.com/W144362327)                                                                                                   | SOURCED representative Pit Building point           | Rounded open-map location; revision date unknown; no footprint imported                                                        |
| `standMap`   | [OpenStreetMap contributors via Mapcarta — way 144247993](https://mapcarta.com/W144247993)                                                                                                   | SOURCED representative Main Grandstand point        | Rounded open-map location; revision date unknown; no orientation/envelope inferred                                             |
| `circuit`    | [Bacinger/f1-circuits](https://github.com/bacinger/f1-circuits/blob/master/circuits/my-1999.geojson); local `sepang.json`, `provenance.json`, `CIRCUIT_DATA.md`                              | Existing SOURCED race path                          | Community horizontal dataset, MIT; not an engineering survey. Existing retrieval date 2026-09-19                               |
| `foundation` | Local `VISUAL_V2_4_3D_FOUNDATION.md`                                                                                                                                                         | ILLUSTRATIVE existing surroundings                  | No exact placement evidence                                                                                                    |
| `audit`      | This milestone's repository audit                                                                                                                                                            | UNAVAILABLE profiles                                | Identifies evidence gaps, not measured zero values                                                                             |

Open-map attribution is retained in the register; OSM data is under ODbL. Future footprint imports need their own provenance/license records. No map tiles, photographs or detailed building geometry were imported here.

The regulation's main text (p2) says 5.542 km while its appendix and the operator's architecture page give 5.543 km. This discrepancy is recorded rather than silently reconciled. The operator's 5,543 m remains the requested overall fact; no existing geometry or race constant is rescaled.

## Circuit Facts

The register records 5,543 m length, 15 corners and an overall width range of 16–22 m as OFFICIAL operator information. These are reference facts, not spatial samples. The existing road remains its V2.4 constant visual width.

## Circuit Coordinate Dataset

Existing geographic coordinates, mean-latitude projection, centering, 60 metres/world-unit scale, densification, spline interpolation and arc-length divisions are unchanged. Exact pre/post coordinate-file SHA-256 remains `a9b410f19db91d398f5b1bc034e875086b8fc8ee1178da9fd9ee2c2f80ad8bd6`.

The earlier upstream provenance hash differs from local repository bytes, as already documented in V2.4. This milestone verifies preservation of the actual repository file and does not upgrade its confidence or alter its provenance. The current interpolated curve measures approximately 5,551.692 m, around 0.157% above the operator's reference; it is not forced to a new length.

## Pit Entry / Exit

The two published GPS references are integrated as SOURCED anchors. Their positions are projected without snapping to the main road. Nearest-path separations are approximately **18.633 m at entry** and **15.289 m at exit**. These are timing-loop locations and may lie on the pit lane; separation is not automatically a coordinate error or the location of a branching road junction.

## Pit Lane

The register retains sourced configuration values of **422.6 m** pit-lane length and **5,595.0 m** for a complete lap through the pit lane. The projected straight-line endpoint chord is approximately **416.908 m**. A similar chord length does not determine the actual road curvature, width, connections, timing-line boundaries or lane direction details.

`SEPANG_SPATIAL_PROFILES.pitLane` references the two anchor IDs but has `points: null`. The centreline record is UNAVAILABLE with partial evidence noted. The V2.4 `PIT_LANE` remains null. No approximate or authoritative pit spline is rendered.

## Intermediate Timing Points

All three intermediate points retain the supplied GPS and SOURCED classification. They belong to the regulation's four-sector configuration. Their nearest-path separations are **0.212 m**, **1.482 m** and **0.967 m** respectively. This supports broad alignment with the existing path but is not proof of survey accuracy, datum equivalence or applicability to every historical event. No race sector, timing boundary or spline control point was changed.

## Finish Reference

The sourced Finish point is only **0.056 m** from the sampled current spline, but is approximately **307.328 m straight-line distance from the existing application progress-zero point**. Its nearest normalized progress is approximately **0.944642**. The existing zero remains at the community dataset's first point (101.735641 E, 2.760529 N).

The debug label is therefore “Finish reference,” separate from the existing “START / FINISH” annotation. They must not be silently conflated. Changing the replay origin or historical timing alignment requires a separate, validated migration; this task makes no such change.

## Pit Building

The open-map point is an anchor only. The operator's architectural reference gives 33 pits and approximately 8 m × 24 m pit boxes. Those facts are stored separately from the SOURCED map point. They do not establish the full building length, external envelope, height, roof shape or surveyed bearing. No building is modeled.

## Main Grandstand

The open-map point is an anchor only. The operator describes approximately 1.3 km length, double frontage and east-west alignment. These qualitative/overall references are separate OFFICIAL records; they are not a footprint derived from one coordinate. No final placement transform or grandstand geometry is created.

## Track Width

**Overall range: OFFICIAL. Local width profile: UNAVAILABLE.** `SEPANG_SPATIAL_PROFILES.width.samples` is null. Its future sample interface supports normalized progress and metres, but contains no fabricated 16–22 m interpolation. V2.4's 0.30-unit road width is still a constant visual approximation and its mesh/materials remain unchanged.

## Elevation

**Elevation profile: UNAVAILABLE.** `SEPANG_SPATIAL_PROFILES.elevation.samples` is null. All anchor world coordinates have Z=0; the race surface stays neutral Z=0. No total-elevation-change value is converted into hills or banking. The existing elevation-compatible surface frame remains intact. The debug annotation is lifted 0.08 scene units purely for display; this does not assert physical altitude.

## Projection Validation

`createCircuitReferenceProjector` obtains the existing circuit's projected first point, then uses the same geographic origin, Earth radius, mean latitude (including the original closing coordinate), scale and centering. It never independently centers the anchor batch. Tests compare every circuit coordinate against the existing `projectCircuit` result within 1e-12 world units.

Nearest alignment uses a deterministic 10,000-segment arc-length polyline and closest-point-on-segment distance. This is DERIVED horizontal separation in the local projection, **not survey error** or a new authoritative position. Sub-metre numeric results must not be read as sub-metre source certainty. Adjacent straights can make the closest segment ambiguous for points between roads, especially building anchors.

| Reference              |     Lat |       Lon |   World X |   World Y | Classification              | Error/Notes                                  |
| ---------------------- | ------: | --------: | --------: | --------: | --------------------------- | -------------------------------------------- |
| Pit entry              | 2.76094 | 101.73881 |  1.858505 |  0.114902 | SOURCED; projection DERIVED | 18.633 m nearest-path separation; u=0.936158 |
| Pit exit               | 2.76062 | 101.73507 | -5.064611 | -0.478139 | SOURCED; projection DERIVED | 15.289 m nearest-path separation; u=0.011235 |
| Finish reference       | 2.76074 | 101.73840 |  1.099554 | -0.255749 | SOURCED; projection DERIVED | 0.056 m nearest-path separation; u=0.944642  |
| Intermediate 1         | 2.76383 | 101.73395 | -7.137843 |  5.470798 | SOURCED; projection DERIVED | 0.212 m nearest-path separation; u=0.157714  |
| Intermediate 2         | 2.76140 | 101.74238 |  8.466933 |  0.967397 | SOURCED; projection DERIVED | 1.482 m nearest-path separation; u=0.392007  |
| Intermediate 3         | 2.75782 | 101.73477 | -5.619941 | -5.667243 | SOURCED; projection DERIVED | 0.967 m nearest-path separation; u=0.675981  |
| Pit Building anchor    | 2.76094 | 101.73696 | -1.566031 |  0.114902 | SOURCED; projection DERIVED | 34.357 m nearest-path separation; u=0.973060 |
| Main Grandstand anchor | 2.76015 | 101.73840 |  1.099554 | -1.349167 | SOURCED; projection DERIVED | 38.619 m nearest-path separation; u=0.810448 |

All world Z values are zero. The building offsets (approximately 34.357 m and 38.619 m) are expected off-road placement references, not discrepancies to fix by moving the circuit.

Reproduce the full-precision report with:

```text
node --experimental-strip-types scripts/spatial-reference-report.ts
```

### Development visualization

Use `http://127.0.0.1:5176/?spatialRefs=1#race-view` on the Vite development server. Eight small fixed-size technical points/labels show names and nearest-path separations; marker points stay at their projected positions while labels are offset for readability. DOM attributes expose identity, XYZ and classification for inspection. They do not intercept car selection.

No query parameter means no overlay import or alignment calculation. `import.meta.env.DEV` additionally gates the lazy import and rendering. The production build contains neither the debug component/chunk nor the query/marker strings, so `?spatialRefs=1` cannot enable it in production. No normal UI controls or permanent confidence badges were added. Reload after changing the query; this is a developer validation mode.

## Spatial Accuracy Matrix

| Element                                      | Classification                                  | Evidence                                   | Current use                           |
| -------------------------------------------- | ----------------------------------------------- | ------------------------------------------ | ------------------------------------- |
| Circuit path                                 | SOURCED / existing                              | Community circuit dataset                  | Unchanged race path                   |
| Circuit length                               | OFFICIAL                                        | PETRONAS SIC                               | Reference validation                  |
| Track width range                            | OFFICIAL                                        | PETRONAS SIC                               | Overall metadata                      |
| Local width profile                          | UNAVAILABLE                                     | No position-dependent samples              | Constant approximation retained       |
| Pit entry / exit                             | SOURCED                                         | Motorsport regulation Appendix 3           | Spatial anchors                       |
| Finish / intermediates                       | SOURCED                                         | Motorsport regulation Appendix 3           | Debug/alignment references only       |
| Pit lane centreline                          | UNAVAILABLE / partial evidence                  | Endpoints and length only                  | Deferred; null path                   |
| Elevation profile                            | UNAVAILABLE                                     | No pointwise survey                        | Neutral Z=0                           |
| Pit Building                                 | SOURCED anchor; OFFICIAL dimensions separately  | Open map + operator architecture           | Future placement reference only       |
| Main Grandstand                              | SOURCED anchor; OFFICIAL description separately | Open map + operator architecture           | Future placement reference only       |
| Kerbs / gravel / runoff / barriers / terrain | ILLUSTRATIVE / generalized                      | V2.4 visual configuration                  | Existing visual layer unchanged       |
| Projected XYZ / closest-track distances      | DERIVED                                         | Fixed existing projection / sampled spline | Diagnostics, not confidence promotion |

## Regression

- **137 automated tests pass:** 94 frontend and 43 backend. All 130 previous tests are retained, with seven spatial tests added.
- Tests cover parser rejection, provenance/classification, every existing coordinate's projection consistency, all six motorsport GPS values, both building classes, missing elevation/width/pit paths, dataset fingerprint and non-mutating nearest-point diagnostics. Existing movement, lap, replay, telemetry and LOD tests remain unchanged and passing.
- TypeScript and production build pass. Existing large-chunk advisory remains; no new dependency.
- The pre/post existing-source hash audit reports only `CircuitScene.tsx` changed, solely to mount the opt-in debug component. Camera, surface generation, materials, car assets, race modules, backend and simulation systems are preserved.
- Normal-view browser smoke test confirmed zero reference markers, 20 moving synthetic cars, car-88 standings selection and matching inspector/telemetry, with no console errors.
- Browser debug inspection confirms all eight markers, their classifications and zero-Z metadata align with the reproducible report. The selected car remains a separate overlay and the circuit is unchanged.
- Production bundle scan confirms the debug component and strings are absent. This is a metadata milestone, not a new FPS/performance acceptance claim.

## Limitations

The sources are mixed-date, rounded and not a common engineering survey. Open-map source revision dates are unknown. Nearest-path proximity does not validate exact timing-loop position, building footprint or cross-source datum. The motorsport event's four-sector configuration must not silently replace historical timing semantics. The significant progress-zero versus Finish distinction is intentionally unresolved.

Pit centreline, local width, elevation, building footprints/heights and exact kerb/runoff/barrier inventories remain unavailable. Future consumers must inspect profile nulls and provenance instead of deriving geometry from overall dimensions. Debug labels may overlap in the main-straight cluster; zoom/top view and the numeric report help inspection. Normal production UI is unchanged.

## V2.5B Recommendation

Obtain dated, licensed building footprints and verified orientation/height references before modeling low-cost Pit Building or Main Grandstand landmarks. Treat current points as placement anchors, not complete model transforms. Resolve the timing-origin/configuration relationship separately before any replay alignment change. Continue to request adequate pit-lane and elevation geometry rather than extrapolating endpoints or overall values. V2.5B is not implemented here.
