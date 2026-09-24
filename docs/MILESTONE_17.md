# M17 — final visual polish pass

Added sticky, keyboard-accessible workspace navigation for Circuit, Replay, Lap analysis/Telemetry, Strategy Lab (historical only) and Hand tracking. Anchor targets have focus support and scrolling clearance beneath the navigation. Updated the stale historical milestone footer to a stable workspace identity.

Added shared lazy loading for the 3D circuit in both workspaces, with loading feedback and a local error boundary. A circuit failure does not take down the replay controls and analysis interface. Production main JavaScript decreased from 1,186.59 kB (334.56 kB gzip) to approximately 286.95 kB (89.87 kB gzip); the renderer is a separate approximately 899 kB chunk. Total JavaScript is similar and the circuit chunk still exceeds Vite's 500 kB advisory. This is a loading-boundary improvement, not a measured FPS gain or a claim that Three.js downloads were eliminated.

Polished keyboard focus, recorder selects, mobile session buttons, section headings, replay controls and toolbar wrapping. The narrow-screen inspection found car labels drawing over toolbar buttons; circuit stacking is now isolated and toolbar buttons remain above track labels. Start/finish labels have a bounded stacking range.

Browser checks: desktop circuit and section links; 390×844 layout with no document horizontal overflow; narrow-screen replay layout; rotation and reset with the circuit toolbar unobstructed. Temporary viewport override restored. Production type-check/build passed. No camera was activated and no external AI call was made.

Files: WorkspaceNav.tsx, circuit/CircuitViewport.tsx and Circuit.tsx, App.tsx, HistoricalWorkspace.tsx, Timeline.tsx, TelemetryPanel.tsx, StrategyLab.tsx, HandTrackingPanel.tsx and styles.css.

## Remaining verification

- M15 remains deferred: real gesture recordings, held-out evaluation and live recognition validation.
- M16 local explanations work; the optional AI provider connection still needs credentials, a selected model and live evaluation.
- No sustained 60 FPS benchmark or broad device/browser matrix has been claimed.
- No deployment or official affiliation is implied. Historical movement remains timing-based reconstruction; strategy/weather values remain hypothetical simulations.

This completes the M17 interface polish pass, not the outstanding data-dependent milestones.
