# Milestone 6 — timeline and synthetic replay

The demo is now a deterministic ten-minute synthetic session. One replay clock drives car transforms and all displayed race state. Play/pause, a keyboard-accessible seek slider, ten-second rewind/forward, speeds 0.5/1/2/5/10×, and selected-car lap jumps are available below telemetry. Seeking and Reset pause playback; selection is preserved. Playback stops at 10:00 and Play then restarts from zero. Hidden tabs do not advance or catch up.

Lap markers account for each car's starting progress. There are no pit or race-control events in this model; the timeline explicitly shows their absence. Playback speed changes elapsed viewing time, not simulated speed, gaps, or lap durations.

State is reconstructed from absolute session time, so seeking backward cannot retain future tyre age or completed laps. Telemetry reconstructs at most 121 synthetic samples for the preceding sixty seconds; it no longer represents a recording of browser visits. Signals remain constant-pace demonstration data. No historical dataset or backend is included.

Changed: replay domain and hook, timeline component, scene clock integration, app state, telemetry/inspector/standings copy, styles, replay tests and documentation.

Next milestone: backend and normalized race state.
