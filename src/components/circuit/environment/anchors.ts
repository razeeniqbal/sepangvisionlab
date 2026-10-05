// SOURCED register anchors in the metric profile frame. The projector is the V2.5A fixed-frame
// projector at 1 m/unit; the profile's own scale (rescale to 5.543 km) is the only DERIVED step.
import type { TrackProfile } from "../../../domain/lapPhysics.ts";
import { createCircuitReferenceProjector } from "../../../domain/spatialProjection.ts";
import { SPATIAL_ANCHORS } from "../../../data/circuits/sepangSpatialReferences.ts";

export function anchorInProfile(
  track: TrackProfile,
  coordinates: readonly (readonly number[])[],
  id: string,
) {
  const anchor = SPATIAL_ANCHORS.find((r) => r.id === id);
  if (!anchor || anchor.longitude === null || anchor.latitude === null)
    throw new RangeError("Unknown spatial anchor " + id);
  const p = createCircuitReferenceProjector(coordinates, 1)(
    anchor.longitude,
    anchor.latitude,
  );
  return { x: p.x * track.scale, y: p.y * track.scale, referenceId: id };
}
