export const ACCURACY_CLASSES = [
  "OFFICIAL",
  "SOURCED",
  "DERIVED",
  "APPROXIMATE",
  "ILLUSTRATIVE",
  "UNAVAILABLE",
] as const;
export type SpatialConfidence = (typeof ACCURACY_CLASSES)[number];
export interface SpatialSource {
  readonly organization: string;
  readonly url: string;
  readonly document: string;
  readonly sourceDate: string | null;
  readonly accessedAt: string;
  readonly limitations: string;
}
export const SPATIAL_SOURCES: Readonly<Record<string, SpatialSource>> =
  Object.freeze({
    sic: {
      organization: "PETRONAS Sepang International Circuit",
      url: "https://www.sepangcircuit.com/architecture",
      document: "Architecture: circuit, Main Grandstand and Pit Building",
      sourceDate: null,
      accessedAt: "2026-09-28",
      limitations:
        "Undated operator page. Overall dimensions are not local profiles or building envelopes.",
    },
    timing: {
      organization: "SRO Motorsports Group Asia / Sepang International Circuit",
      url: "https://www.gt-world-challenge-asia.com/documents/notice/882/2025%2BGTWCA%2BSupplementary%2BRegulation%2Bas%2B09042025.pdf",
      document:
        "2025 supplementary regulations, Appendix 3, PDF page 6; map updated 06-07-2023",
      sourceDate: "2025-04-09",
      accessedAt: "2026-09-28",
      limitations:
        "Event four-sector timing-loop configuration, not a surveyed pit centreline. Map date retained literally. Main text says 5.542 km; appendix/operator say 5.543 km.",
    },
    pitMap: {
      organization: "OpenStreetMap contributors, via Mapcarta",
      url: "https://mapcarta.com/W144362327",
      document: "Paddock/Pit Building; OSM way 144362327",
      sourceDate: null,
      accessedAt: "2026-09-28",
      limitations:
        "Rounded mapped point, not a surveyed footprint or orientation. OSM data attribution/ODbL applies; no footprint imported.",
    },
    standMap: {
      organization: "OpenStreetMap contributors, via Mapcarta",
      url: "https://mapcarta.com/W144247993",
      document: "Main Grandstand; OSM way 144247993",
      sourceDate: null,
      accessedAt: "2026-09-28",
      limitations:
        "Rounded mapped point, not a surveyed footprint or orientation. OSM data attribution/ODbL applies; no footprint imported.",
    },
    circuit: {
      organization: "Tomislav Bacinger / f1-circuits",
      url: "https://github.com/bacinger/f1-circuits/blob/master/circuits/my-1999.geojson",
      document:
        "Existing local sepang.json, provenance.json and CIRCUIT_DATA.md",
      sourceDate: null,
      accessedAt: "2026-09-19",
      limitations:
        "MIT community horizontal dataset, not engineering survey; existing progress origin differs from timing Finish.",
    },
    foundation: {
      organization: "Sepang Vision Lab",
      url: "docs/VISUAL_V2_4_3D_FOUNDATION.md",
      document: "Existing V2.4 visual foundation",
      sourceDate: null,
      accessedAt: "2026-09-28",
      limitations: "Illustrative visual geometry; no survey evidence.",
    },
    svlEnvironment: {
      organization: "Sepang Vision Lab",
      url: "docs/MILESTONE_18.md",
      document: "Milestone 18 generated driver-view environment",
      sourceDate: null,
      accessedAt: "2026-10-05",
      limitations:
        "Generated in code. Shapes, sizes and counts are illustrative; only positions tied to a SOURCED anchor follow evidence.",
    },
    audit: {
      organization: "Sepang Vision Lab",
      url: "docs/VISUAL_V2_5A_SPATIAL_REFERENCE.md",
      document: "Repository evidence audit",
      sourceDate: null,
      accessedAt: "2026-09-28",
      limitations:
        "Unavailable means no adequate profile/path in current evidence. Absence is not zero elevation data.",
    },
  });
export interface SpatialReference {
  readonly id: string;
  readonly label: string;
  readonly category: string;
  readonly latitude: number | null;
  readonly longitude: number | null;
  readonly source: string;
  readonly sourceDate: string | null;
  readonly accuracyClass: SpatialConfidence;
  readonly notes: string;
  readonly value: number | string | null;
  readonly unit: string | null;
}
// Reject malformed imports rather than treating missing coordinates as (0,0).
export function parseSpatialReferences(
  input: unknown,
): readonly SpatialReference[] {
  if (!Array.isArray(input))
    throw new TypeError("Spatial references must be an array");
  const ids = new Set<string>();
  return Object.freeze(
    input.map((value: unknown) => {
      if (!value || typeof value !== "object")
        throw new TypeError("Invalid spatial reference");
      const v = value as Record<string, unknown>;
      for (const key of ["id", "label", "category", "source", "notes"])
        if (typeof v[key] !== "string" || !(v[key] as string).trim())
          throw new TypeError("Missing spatial metadata");
      if (
        ids.has(v.id as string) ||
        !Object.hasOwn(SPATIAL_SOURCES, v.source as string)
      )
        throw new TypeError("Duplicate reference or unknown source");
      ids.add(v.id as string);
      if (!ACCURACY_CLASSES.includes(v.accuracyClass as SpatialConfidence))
        throw new TypeError("Invalid accuracy class");
      const absent = v.latitude === null && v.longitude === null;
      if (
        !absent &&
        !(
          typeof v.latitude === "number" &&
          Number.isFinite(v.latitude) &&
          Math.abs(v.latitude) <= 90 &&
          typeof v.longitude === "number" &&
          Number.isFinite(v.longitude) &&
          Math.abs(v.longitude) <= 180
        )
      )
        throw new TypeError("Invalid geographic coordinates");
      if (v.accuracyClass === "UNAVAILABLE" && (!absent || v.value !== null))
        throw new TypeError(
          "Unavailable reference must not carry invented data",
        );
      if (
        v.sourceDate !== null &&
        (typeof v.sourceDate !== "string" ||
          !/^\d{4}-\d{2}-\d{2}$/.test(v.sourceDate) ||
          !Number.isFinite(Date.parse(v.sourceDate)))
      )
        throw new TypeError("Invalid source date");
      if (
        v.value !== null &&
        typeof v.value !== "string" &&
        !(typeof v.value === "number" && Number.isFinite(v.value))
      )
        throw new TypeError("Invalid reference value");
      if (v.unit !== null && typeof v.unit !== "string")
        throw new TypeError("Invalid unit");
      return Object.freeze({ ...v }) as unknown as SpatialReference;
    }),
  );
}
const anchor = (
  id: string,
  label: string,
  category: string,
  longitude: number,
  latitude: number,
  source: string,
  notes: string,
): SpatialReference => ({
  id,
  label,
  category,
  longitude,
  latitude,
  source,
  sourceDate: SPATIAL_SOURCES[source].sourceDate,
  accuracyClass: "SOURCED",
  notes,
  value: null,
  unit: null,
});
const fact = (
  id: string,
  label: string,
  category: string,
  value: number | string | null,
  unit: string | null,
  source: string,
  accuracyClass: SpatialConfidence,
  notes: string,
): SpatialReference => ({
  id,
  label,
  category,
  value,
  unit,
  source,
  sourceDate: SPATIAL_SOURCES[source].sourceDate,
  accuracyClass,
  notes,
  latitude: null,
  longitude: null,
});
export const SEPANG_SPATIAL_REFERENCES = parseSpatialReferences([
  anchor(
    "pit-entry",
    "Pit entry",
    "pit",
    101.73881,
    2.76094,
    "timing",
    "Published timing-loop point; not necessarily the physical road branching point.",
  ),
  anchor(
    "pit-exit",
    "Pit exit",
    "pit",
    101.73507,
    2.76062,
    "timing",
    "Published timing-loop point; endpoints alone do not define the lane.",
  ),
  anchor(
    "finish",
    "Finish reference",
    "timing",
    101.7384,
    2.76074,
    "timing",
    "Separate sourced Finish reference; do not replace the existing race progress origin.",
  ),
  anchor(
    "intermediate-1",
    "Intermediate 1",
    "timing",
    101.73395,
    2.76383,
    "timing",
    "Four-sector configuration; do not remap the existing race timing model.",
  ),
  anchor(
    "intermediate-2",
    "Intermediate 2",
    "timing",
    101.74238,
    2.7614,
    "timing",
    "Four-sector configuration; compare against the existing spline only.",
  ),
  anchor(
    "intermediate-3",
    "Intermediate 3",
    "timing",
    101.73477,
    2.75782,
    "timing",
    "Four-sector configuration; no spline snapping.",
  ),
  anchor(
    "pit-building",
    "Pit Building anchor",
    "building",
    101.73696,
    2.76094,
    "pitMap",
    "Approximate open-map representative location; footprint, height and orientation unavailable.",
  ),
  anchor(
    "main-grandstand",
    "Main Grandstand anchor",
    "building",
    101.7384,
    2.76015,
    "standMap",
    "Approximate open-map representative location; not an exact placement envelope.",
  ),
  fact(
    "circuit-length",
    "Circuit length",
    "circuit",
    5543,
    "m",
    "sic",
    "OFFICIAL",
    "Overall length reference only; geometry is not rescaled.",
  ),
  fact(
    "corners",
    "Corners",
    "circuit",
    15,
    "count",
    "sic",
    "OFFICIAL",
    "Published circuit count.",
  ),
  fact(
    "width-min",
    "Minimum track width",
    "width",
    16,
    "m",
    "sic",
    "OFFICIAL",
    "Overall range, not a local width sample.",
  ),
  fact(
    "width-max",
    "Maximum reported track width",
    "width",
    22,
    "m",
    "sic",
    "OFFICIAL",
    "Overall range, not a local width sample.",
  ),
  fact(
    "pit-length",
    "Pit lane length",
    "pit",
    422.6,
    "m",
    "timing",
    "SOURCED",
    "Car timing-loop configuration, not enough to reconstruct a centreline.",
  ),
  fact(
    "pit-lap-length",
    "Complete lap through pit lane",
    "pit",
    5595,
    "m",
    "timing",
    "SOURCED",
    "Configuration value; not used by race progression.",
  ),
  fact(
    "pit-count",
    "Pit boxes",
    "architecture",
    33,
    "count",
    "sic",
    "OFFICIAL",
    "Not an external building envelope.",
  ),
  fact(
    "pit-box-width",
    "Pit box width",
    "architecture",
    8,
    "m",
    "sic",
    "OFFICIAL",
    "Architectural reference only.",
  ),
  fact(
    "pit-box-depth",
    "Pit box depth",
    "architecture",
    24,
    "m",
    "sic",
    "OFFICIAL",
    "Architectural reference only.",
  ),
  fact(
    "stand-length",
    "Main Grandstand reported length",
    "architecture",
    1300,
    "m",
    "sic",
    "OFFICIAL",
    "Approximately 1.3 km; do not infer footprint from one point.",
  ),
  fact(
    "stand-form",
    "Main Grandstand form",
    "architecture",
    "double frontage; east-west alignment",
    null,
    "sic",
    "OFFICIAL",
    "Qualitative architecture reference, not a surveyed bearing.",
  ),
  fact(
    "circuit-path",
    "Existing circuit path",
    "geometry",
    "src/data/circuits/sepang.json",
    null,
    "circuit",
    "SOURCED",
    "Horizontal community dataset retained unchanged.",
  ),
  fact(
    "width-profile",
    "Local width profile",
    "profile",
    null,
    null,
    "audit",
    "UNAVAILABLE",
    "Retain the V2.4 constant visual width.",
  ),
  fact(
    "elevation-profile",
    "Elevation profile",
    "profile",
    null,
    null,
    "audit",
    "UNAVAILABLE",
    "Neutral Z=0; total elevation change must not become a fabricated profile.",
  ),
  fact(
    "pit-centreline",
    "Pit lane centreline",
    "profile",
    null,
    null,
    "audit",
    "UNAVAILABLE",
    "Partial evidence: endpoints and length; no adequate intermediate path.",
  ),
  ...(
    [
      ["env-track-surface", "Driver view asphalt, lines and run-off", "Constant 16 m width from the OFFICIAL minimum; local width profile is unavailable."],
      ["env-kerbs", "Driver view kerbs", "Placed at curvature peaks of the community outline, not a surveyed kerb inventory."],
      ["env-barriers", "Driver view barriers", "Constant offset, pulled in to 0.8 × corner radius on the inside; not a surveyed barrier line."],
      ["env-pit-building", "Driver view pit building", "Centred on the SOURCED anchor pit-building and aligned to the main straight; footprint, height and orientation are illustrative."],
      ["env-main-grandstand", "Driver view main grandstand", "Centred on the SOURCED anchor main-grandstand with the OFFICIAL east-west alignment; footprint and height are illustrative."],
      ["env-start-gantry", "Driver view start gantry", "Spans the road at the sample nearest the SOURCED anchor finish; the replay progress origin is unchanged."],
      ["env-palms", "Driver view oil palms", "Seeded random scatter at least 45 m from the centre line; not a vegetation survey."],
      ["env-sky", "Driver view sky, fog and sun", "Fixed illustrative lighting; not a weather or sun-position model."],
    ] as const
  ).map(([id, label, notes]) =>
    fact(id, label, "visual", null, null, "svlEnvironment", "ILLUSTRATIVE", notes),
  ),
  fact(
    "env-turn-boards",
    "Driver view turn boards T1-T15",
    "visual",
    15,
    "count",
    "svlEnvironment",
    "DERIVED",
    "Positions DERIVED from curvature peaks of the community outline: 22 detected peaks grouped into the official 15 turns (tightest peak per turn), accepted only when the direction sequence matches RLRRLRRRLRRLRRL. Board offset and shape are illustrative. Mapping in docs/MILESTONE_19.md, Step 1.",
  ),
  ...["kerbs", "gravel", "runoff", "barriers", "terrain"].map((id) =>
    fact(
      id,
      id,
      "visual",
      null,
      null,
      "foundation",
      "ILLUSTRATIVE",
      "V2.4 generalized visual geometry, not a verified local feature.",
    ),
  ),
]);
export const SPATIAL_ANCHORS = Object.freeze(
  SEPANG_SPATIAL_REFERENCES.filter((r) => r.latitude !== null),
);
export interface GeographicPoint {
  readonly longitude: number;
  readonly latitude: number;
}
export interface ProfileSample {
  readonly progress: number;
  readonly valueMetres: number;
}
// Explicit absent geometry: consumers must not interpolate endpoints or invent profile samples.
export const SEPANG_SPATIAL_PROFILES: {
  readonly pitLane: {
    readonly referenceId: string;
    readonly anchorIds: readonly string[];
    readonly points: readonly GeographicPoint[] | null;
  };
  readonly width: {
    readonly referenceId: string;
    readonly samples: readonly ProfileSample[] | null;
  };
  readonly elevation: {
    readonly referenceId: string;
    readonly samples: readonly ProfileSample[] | null;
  };
} = Object.freeze({
  pitLane: Object.freeze({
    referenceId: "pit-centreline",
    anchorIds: Object.freeze(["pit-entry", "pit-exit"]),
    points: null,
  }),
  width: Object.freeze({ referenceId: "width-profile", samples: null }),
  elevation: Object.freeze({ referenceId: "elevation-profile", samples: null }),
});
