# Milestone 5 — synthetic telemetry

Speed, throttle and brake charts follow the selected car. Every car retains its own bounded history (up to 121 samples, within the last 60 synthetic session seconds). Samples publish alongside standings at roughly 10 Hz in wall time / 2 Hz in session time. The simulation clock advances only while running and visible. Pause freezes recording; Reset clears all histories while preserving selection. No prior or future samples are fabricated.

Speed comes directly from the same CarState used by the inspector. The existing constant-pace movement remains unchanged, so the trace is deliberately flat. Throttle (50%) and brake (0%) are explicit demonstration inputs, not measurements or physics-derived controls. Realistic braking, acceleration and external telemetry ingestion are not implemented.

SVG polylines render typed telemetry samples with time and channel axes. They are not decorative artwork. Current numeric values and accessible chart labels accompany the traces. The owner’s logo, PETRONAS branding and Sepang geometry are preserved.

Next milestone: timeline and replay controls.
