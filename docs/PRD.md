# SEPANG VISION LAB

## Product Requirements & Engineering Specification

**Version:** 1.0
**Project:** Sepang Vision Lab
**Repository:** `sepangvisionlab`
**Initial Platform:** Desktop Web
**Primary Circuit:** Sepang International Circuit, Malaysia
**Project Type:** Motorsport Digital Twin / Race Intelligence / ML Strategy Simulator / Computer Vision Experiment

---

# 1. Product Summary

Sepang Vision Lab is an interactive motorsport race-intelligence platform centred around Sepang International Circuit.

The application combines:

* Interactive circuit digital twin
* Race simulation and historical replay
* Moving race-car visualization
* Driver and car inspection
* Telemetry visualization
* Lap-time machine learning
* Tyre degradation modelling
* Pit-strategy simulation
* Monte Carlo race simulation
* Weather strategy simulation
* Computer-vision hand interaction
* AI race-engineer interface

The application should feel like a professional motorsport engineering and strategy workstation rather than a racing game.

The user is not driving the car.

The user acts as:

**Race Engineer / Strategist / Analyst**

---

# 2. Product Vision

The final experience should allow a user to:

1. Open Sepang Vision Lab.
2. View an interactive digital representation of Sepang.
3. Watch race cars move around the circuit.
4. Select a race car.
5. Inspect telemetry and race state.
6. Navigate through a race timeline.
7. Replay historical or simulated race states.
8. View ML-generated lap-time and tyre-performance estimates.
9. Modify a race strategy.
10. Run thousands of alternative race simulations.
11. Compare strategy outcomes.
12. Manipulate the digital twin using both hands through a webcam.
13. Ask an AI race engineer questions about simulation results.

---

# 3. Core Product Principle

Build the system in layers.

Development order MUST be:

```text
CIRCUIT
↓
CAR MOVEMENT
↓
RACE STATE
↓
RACE UI
↓
REPLAY
↓
TELEMETRY
↓
ML
↓
STRATEGY SIMULATION
↓
MONTE CARLO
↓
WEATHER
↓
COMPUTER VISION
↓
GESTURE ML
↓
AI RACE ENGINEER
```

Do NOT implement later phases before their dependencies are working.

---

# 4. Important Product Distinction

Sepang Vision Lab is NOT:

* A racing game
* A driving simulator
* A fantasy F1 manager
* A betting application
* A generic AI dashboard
* A chatbot with racing information
* An official Formula 1 application
* An official PETRONAS application

The application is:

> A motorsport digital-twin and race-strategy research platform.

---

# 5. Product Identity, Real-World Motorsport Data & Branding

The primary product identity is:

**SEPANG VISION LAB**

Subtitle:

**RACE INTELLIGENCE SYSTEM**

Sepang Vision Lab is an independent motorsport technology, data-visualization, machine-learning and simulation project.

## Real-World Motorsport Representation

The application may represent real-world motorsport information where appropriate, including:

* Real circuits
* Real drivers
* Real teams
* Historical race results
* Historical race events
* Real car numbers
* Real timing information
* Real telemetry where legally available
* Real tyre compounds
* Real race-control events
* Real weather information
* Real championship information

The application architecture must not depend on fictional teams when real historical data is being reconstructed.

For historical replay, preserve the identities contained in the source dataset.

Example:

```text
Historical Dataset

Driver
↓
Team
↓
Car Number
↓
Position
↓
Telemetry
↓
Tyre
↓
Race Events
```

## Logos and Brand Assets

Real-world team, circuit, sponsor and motorsport branding may be supported by the UI when the project owner has an appropriate basis to use those assets.

Brand assets must be isolated from core application logic.

Use a structure such as:

```text
assets/

brands/
    teams/
    circuits/
    series/
    sponsors/
```

The application must continue functioning if proprietary brand assets are removed or replaced.

Do not encode critical application information solely through a logo.

Team and driver identity must remain available through structured data.

For example:

```typescript
interface Team {
    id: string;
    name: string;
    shortName: string;
    colour?: string;
    logo?: string;
}
```

Rather than hardcoding a particular logo into a React component.

## Sepang Vision Lab Branding

The Sepang Vision Lab identity must remain visually separate from represented motorsport brands.

The application header should clearly identify:

**SEPANG VISION LAB**

Real teams, drivers and motorsport organizations should appear as entities being analysed by the platform rather than as owners of the platform.

Example:

```text
SEPANG VISION LAB
RACE INTELLIGENCE SYSTEM

SESSION
Malaysian Grand Prix — Historical Replay

SELECTED DRIVER
[Team Identity] Driver Name

MODE
HISTORICAL
```

## Affiliation

Unless the project has formal authorization or affiliation, do not describe Sepang Vision Lab as:

* An official Formula 1 product
* An official PETRONAS product
* An official Sepang International Circuit product
* An official team application
* An official FIA application

For public-facing portfolio deployments, include an appropriate independent-project disclaimer.

Example:

"Sepang Vision Lab is an independent motorsport technology and research project. Motorsport names, trademarks and related brand assets belong to their respective owners. No official affiliation or endorsement is implied."

## Data Provenance

Every race dataset should retain information about its source.

Where applicable record:

```typescript
interface DataSource {
    provider: string;
    dataset?: string;
    sourceUrl?: string;
    retrievedAt?: string;
    license?: string;
}
```

The system must distinguish between:

**HISTORICAL**

Recorded historical information.

**ACTUAL**

Directly observed/source-provided information.

**PREDICTION**

Machine-learning model output.

**SIMULATION**

Generated scenario output.

**SYNTHETIC**

Artificial data created for development or demonstration.

These categories must never be intentionally presented as one another.

---

# 6. Application Identity

Application name:

**SEPANG VISION LAB**

Primary subtitle:

**RACE INTELLIGENCE SYSTEM**

Alternative contextual labels:

**DIGITAL TWIN**

**STRATEGY LAB**

**RACE SIMULATION**

**TELEMETRY**

---

# 7. Design Direction

The application should resemble professional motorsport engineering software.

Visual influences:

* Race engineering workstations
* Pit-wall strategy systems
* Motorsport telemetry
* Broadcast timing systems
* CAD interfaces
* Digital twin visualization
* Engineering simulation software

Design characteristics:

* Dark neutral background
* High information density
* Sharp geometry
* Thin borders
* Compact typography
* Monospace typography where appropriate
* Technical grid systems
* Restrained turquoise accent
* White primary data
* Grey secondary data
* Clear status colours only where meaningful

Avoid:

* Excessive rounded cards
* Large pills
* Glassmorphism
* Excessive gradients
* Neon cyberpunk effects
* Huge headings
* Generic SaaS dashboards
* Decorative AI sparkles
* Emoji-based UI
* Cartoon racing graphics
* Excessive animation

---

# 8. Desktop-First Layout

Initial application layout:

```text
┌─────────────────────────────────────────────────────────────┐
│ SEPANG VISION LAB                          RACE SIMULATION  │
│ RACE INTELLIGENCE SYSTEM                       LAP 31 / 56 │
├────────────┬───────────────────────────────┬────────────────┤
│            │                               │                │
│ STANDINGS  │                               │ CAR INSPECTOR  │
│            │                               │                │
│ 01  #12    │                               │ CAR 07         │
│ 02  #07 ◀  │            SEPANG             │                │
│ 03  #88    │                               │ POSITION P2    │
│ 04  #24    │        ●12                    │ MEDIUM         │
│            │             ●07               │ AGE 18         │
│            │                               │                │
│            │   ●88                         │ GAP +4.72      │
│            │                               │                │
│            │                               │ SPEED 287      │
├────────────┴───────────────────────────────┴────────────────┤
│ TELEMETRY                                                   │
│                                                             │
│ SPEED       ───────────╲____╱──────────────                 │
│ THROTTLE    ███████████░░████████████████                  │
│ BRAKE       ░░░░███░░░░░░██░░░░░░░░░░                  │
├─────────────────────────────────────────────────────────────┤
│ 01────10────20────●31────40────50────56                     │
│              PIT                                            │
│                                                             │
│       ◀◀       ▶       ▶▶        1X                         │
└─────────────────────────────────────────────────────────────┘
```

This is the long-term layout.

Do not build all panels during Phase 1.

---

# 9. Technology Stack

## Frontend

Use:

* React
* TypeScript
* Vite
* Three.js
* React Three Fiber
* Drei
* Tailwind CSS
* Zustand
* Recharts or D3 where appropriate

Do not introduce unnecessary UI frameworks.

---

# 10. Backend

Backend will be introduced later.

Use:

* Python
* FastAPI
* Pydantic
* WebSocket

Backend responsibilities:

* Race-state management
* Replay engine
* Telemetry processing
* ML inference
* Strategy simulation
* Monte Carlo simulation
* Data ingestion

---

# 11. Data Layer

Initial development:

* JSON
* TypeScript objects

Later:

* Parquet
* DuckDB

Optional future persistence:

* PostgreSQL

Do not introduce PostgreSQL during the early frontend prototype.

---

# 12. Machine Learning Stack

Use later:

* Pandas
* NumPy
* scikit-learn
* XGBoost
* LightGBM

Optional future:

* PyTorch

ML models should be trained separately from the frontend.

---

# 13. Computer Vision

Future technology:

* MediaPipe
* OpenCV

Computer vision should run primarily client-side where practical.

Hand tracking should not be required to use the application.

Mouse and keyboard controls MUST always remain available.

---

# 14. Repository Structure

Target structure:

```text
sepangvisionlab/

├── frontend/
│
│   └── src/
│       ├── components/
│       │
│       │   ├── circuit/
│       │   ├── cars/
│       │   ├── standings/
│       │   ├── telemetry/
│       │   ├── driver/
│       │   ├── timeline/
│       │   ├── strategy/
│       │   └── handtracking/
│       │
│       ├── data/
│       ├── hooks/
│       ├── services/
│       ├── stores/
│       ├── types/
│       ├── utils/
│       │
│       ├── App.tsx
│       └── main.tsx
│
├── backend/
│
│   └── app/
│       ├── api/
│       ├── race/
│       ├── simulation/
│       ├── services/
│       └── models/
│
├── ml/
│   ├── features/
│   ├── training/
│   ├── evaluation/
│   └── models/
│
├── notebooks/
│
├── data/
│   ├── raw/
│   ├── processed/
│   ├── circuits/
│   └── simulation/
│
├── assets/
│   ├── cars/
│   ├── tyres/
│   ├── circuit/
│   ├── weather/
│   └── gestures/
│
├── docs/
│   ├── PRD.md
│   ├── ARCHITECTURE.md
│   └── ML.md
│
├── tests/
│
└── README.md
```

During early development, it is acceptable for the existing Vite project to remain at repository root.

Do not restructure a working application unnecessarily.

---

# 15. Core Domain Model

The central concept is:

**RaceState**

Eventually:

```typescript
interface RaceState {
    timestamp: number;
    currentLap: number;
    totalLaps: number;
    cars: CarState[];
    weather?: WeatherState;
    events?: RaceEvent[];
}
```

Car:

```typescript
interface CarState {
    id: string;
    number: string;

    position: number;

    lap: number;

    trackProgress: number;

    speed: number;

    throttle?: number;

    brake?: number;

    gear?: number;

    compound?: TyreCompound;

    tyreAge?: number;

    gap?: number;
}
```

Track progress MUST be normalized:

```text
0.00 = start/finish

0.25 = 25% around lap

0.50 = halfway

0.75 = 75%

1.00 = completed lap
```

The circuit renderer should be able to convert normalized progress into an XY/XYZ coordinate.

---

# 16. Circuit Architecture

Circuit geometry MUST be data-driven.

Do not hardcode a PNG as the circuit.

Circuit representation:

```typescript
interface TrackPoint {
    x: number;
    y: number;
    z?: number;
}
```

Example:

```typescript
const points = [
    { x: -4, y: 0 },
    { x: -3, y: 2 },
    ...
];
```

Three.js should convert these points into a continuous path.

Recommended:

`THREE.CatmullRomCurve3`

Cars should obtain their position using:

`curve.getPointAt(progress)`

---

# 17. Accurate Sepang Geometry

Do NOT attempt to approximate Sepang manually for the final implementation.

During early development:

Use a fake test circuit.

Once movement works:

Replace test geometry with verified Sepang geometry.

The geometry should eventually support:

* Circuit path
* Start/finish
* Corners
* Sector boundaries
* Pit lane
* Pit entry
* Pit exit

Do not use AI image generation to create circuit geometry.

---

# 18. Phase 1 — Application Foundation

## Objective

Create the base React application.

Implement:

* React
* TypeScript
* Vite
* Base CSS
* Basic project structure

Initial screen:

```text
SEPANG VISION LAB

RACE INTELLIGENCE SYSTEM


SEPANG DIGITAL TWIN


CAR 07
LAP 1 / 56
READY
```

No actual circuit required yet.

### Acceptance Criteria

* Application runs using `npm run dev`
* No TypeScript errors
* No console errors
* Full-screen dark interface
* Header visible
* Main workspace visible
* Footer/status bar visible
* Responsive at standard desktop widths

---

# 19. Phase 2 — Test Circuit

## Objective

Prove that circuit geometry can be rendered.

Install:

* three
* @react-three/fiber
* @react-three/drei

Create:

`src/data/testTrack.ts`

Create:

`Circuit.tsx`

Create:

`CircuitScene.tsx`

Render a smooth closed test circuit.

### Acceptance Criteria

* Circuit renders
* Circuit is centered
* Circuit fits viewport
* Circuit uses coordinate data
* No image-based track
* Camera is orthographic
* Track scales correctly

---

# 20. Phase 3 — CAR 07

## Objective

Place one car marker on the track.

Initial marker may simply be:

A circle

or

A small technical marker.

Do NOT require a generated Formula car asset.

Create:

`CarMarker.tsx`

Properties:

```typescript
interface CarMarkerProps {
    number: string;
    progress: number;
}
```

Position should derive from circuit curve.

### Acceptance Criteria

Given:

```typescript
progress = 0.5
```

CAR 07 appears approximately halfway around the circuit.

---

# 21. Phase 4 — Car Movement

Animate CAR 07.

Use React Three Fiber `useFrame`.

Progress should increase over time.

Example concept:

```text
0.00
↓
0.01
↓
0.02
↓
...
↓
0.99
↓
0.00
```

When progress passes `1`:

Increment lap.

Reset normalized progress.

### Acceptance Criteria

* CAR 07 moves smoothly
* Car remains attached to track
* Movement loops
* Lap increments
* Animation does not depend on browser frame rate
* No unnecessary React rerenders every frame

---

# 22. Phase 5 — Sepang Geometry

Replace test circuit with verified Sepang coordinate data.

Create:

`sepangTrack.ts`

or preferably:

`data/circuits/sepang.json`

Normalize geometry for rendering.

### Acceptance Criteria

* Recognizable accurate Sepang layout
* Track fits workspace
* Start/finish identified
* Car movement still works
* Circuit renderer did not require major rewrite

---

# 23. Phase 6 — Multiple Cars

Introduce approximately 20 fictional cars.

Each car has:

* number
* position
* progress
* speed
* compound
* tyre age

Initially use synthetic race data.

Example:

```typescript
{
    number: "07",
    position: 2,
    progress: 0.72,
    speed: 287,
    compound: "MEDIUM",
    tyreAge: 18
}
```

### Acceptance Criteria

* Multiple cars visible
* Cars move independently
* Cars can occupy similar areas without breaking renderer
* CAR 07 and CAR 88 are visually distinguishable

---

# 24. Phase 7 — Car Selection

Cars become interactive.

Mouse hover:

Highlight.

Mouse click:

Select.

Selected state stored centrally.

Recommended:

Zustand.

Example:

```text
selectedCarId
```

### Acceptance Criteria

* Clicking car selects it
* Previous selection clears
* Selected car visually highlighted
* Selected state available to other UI components

---

# 25. Phase 8 — Standings

Create left-side standings.

Display:

* Position
* Car number
* Gap
* Compound

Clicking a standings row selects that car.

Selecting a car on circuit highlights the corresponding standings row.

### Acceptance Criteria

Circuit and standings share the same selected-car state.

---

# 26. Phase 9 — Car Inspector

Create right-side inspector.

Display:

* Car number
* Position
* Lap
* Speed
* Compound
* Tyre age
* Gap
* Last lap

Future:

* Gear
* RPM
* Throttle
* Brake
* DRS

### Acceptance Criteria

Inspector updates immediately when another car is selected.

---

# 27. Phase 10 — Telemetry

Add telemetry panel.

Initial channels:

* Speed
* Throttle
* Brake

Later:

* Gear
* RPM
* DRS
* Lap delta

Charts must use actual data structures.

Do not generate telemetry as decorative SVG artwork.

---

# 28. Phase 11 — Race Timeline

Add bottom timeline.

Display:

* Lap markers
* Current lap
* Pit events
* Race-control events

Controls:

* Play
* Pause
* Rewind
* Fast-forward

Playback speeds:

* 0.5x
* 1x
* 2x
* 5x
* 10x

---

# 29. Phase 12 — Backend

Introduce FastAPI.

Frontend communicates through REST initially.

Later add WebSocket.

Backend returns standardized RaceState objects.

The frontend must NOT become tightly coupled to a specific external motorsport API.

---

# 30. Phase 13 — Historical Race Data

Introduce historical race data.

External data must first pass through an ingestion/normalization layer.

Architecture:

```text
EXTERNAL DATA

↓

INGESTION

↓

NORMALIZATION

↓

RACE STATE

↓

FRONTEND
```

Store downloaded historical data locally in Parquet.

Avoid repeatedly querying remote APIs during replay.

---

# 31. Phase 14 — Replay Engine

Build time-based historical replay.

State:

```text
currentTime
isPlaying
playbackSpeed
```

Race state should be derived from current replay time.

Support:

* Play
* Pause
* Seek
* Speed
* Jump to lap

---

# 32. Phase 15 — Lap-Time ML

Objective:

Predict upcoming lap time.

Potential features:

* Previous lap 1
* Previous lap 2
* Previous lap 3
* Compound
* Tyre age
* Stint
* Position
* Gap
* Track temperature
* Air temperature
* Weather
* Driver

Target:

`next_lap_time`

Start with:

1. Naive previous-lap baseline
2. Linear Regression
3. Random Forest
4. XGBoost

Evaluate:

* MAE
* RMSE
* R²

Avoid random train/test leakage across adjacent race laps.

---

# 33. Phase 16 — Tyre Degradation

Estimate pace degradation through a stint.

Initial model may be regression rather than ML.

Inputs:

* Compound
* Tyre age
* Track temperature
* Stint
* Previous pace

Output example:

```text
MEDIUM

DEGRADATION

+0.071 sec/lap
```

---

# 34. Phase 17 — Strategy Lab

Allow user to branch from current race state.

Example:

```text
CAR 07

LAP 31
P2
MEDIUM
19 LAPS

        CURRENT

           │

 ┌─────────┼─────────┐

 ▼         ▼         ▼

STAY      PIT       PIT
OUT       NOW       +3

          HARD
```

Parameters:

* Pit lap
* Compound
* Stint length
* Weather assumption

---

# 35. Phase 18 — Strategy Simulator

Simulate remaining race.

Initial simulation combines:

* Predicted lap time
* Tyre degradation
* Pit loss
* Traffic approximation

Do not attempt full physics simulation.

---

# 36. Phase 19 — Monte Carlo

Introduce uncertainty.

Random variables:

* Lap pace
* Tyre degradation
* Pit duration
* Traffic

Later:

* Weather
* Safety car
* Incidents

Run configurable simulations.

Target:

1,000–10,000.

Return distributions rather than pretending outcomes are deterministic.

---

# 37. Phase 20 — Weather

Create Sepang weather scenarios.

States:

```text
DRY
↓
LIGHT RAIN
↓
WET
↓
DRYING
```

Allow simulation of:

* Stay on slick
* Intermediate
* Wet
* Early crossover
* Delayed crossover

Weather scenarios MUST clearly indicate when they are simulated assumptions.

---

# 38. Phase 21 — Computer Vision

Introduce webcam hand tracking.

Use MediaPipe.

Detect:

* Left hand
* Right hand
* Landmarks
* Orientation
* Finger positions

Create development/debug overlay.

Hand tracking should NOT replace normal controls.

---

# 39. Phase 22 — Rule-Based Gestures

Initial gestures:

Point

→ Inspect

Pinch

→ Select

Hands apart

→ Zoom

Hands together

→ Zoom out

Rotate hands

→ Rotate circuit

Swipe left

→ Rewind

Swipe right

→ Fast-forward

Open palms

→ Strategy Lab

Fist

→ Cancel

Do not introduce gesture ML yet.

---

# 40. Phase 23 — Gesture ML

Create landmark dataset recorder.

Store normalized hand landmark data.

Classes:

* neutral
* point
* pinch
* grab
* rotate
* zoom
* swipe_left
* swipe_right

Models to compare:

* Random Forest
* SVM
* XGBoost
* MLP

Evaluate:

* Accuracy
* Precision
* Recall
* F1
* Confusion matrix
* Inference latency

Future temporal gestures may use:

* LSTM
* 1D CNN
* Transformer

---

# 41. Phase 24 — AI Race Engineer

The LLM must NOT invent simulation results.

Architecture:

```text
USER QUESTION

↓

LLM

↓

STRUCTURED TOOL CALL

↓

STRATEGY SIMULATOR

↓

SIMULATION RESULTS

↓

LLM

↓

EXPLANATION
```

Example:

User:

"What happens if 07 pits now?"

System:

Run actual strategy simulation.

Return structured results.

LLM:

Explain results.

---

# 42. Data Truth Labels

Every displayed value must be classifiable as:

**ACTUAL**

**HISTORICAL**

**PREDICTION**

**SIMULATION**

These concepts must never be visually confused.

For example:

```text
ML PREDICTION

NEXT LAP
1:37.481
```

and:

```text
SIMULATION

EXPECTED POSITION
P2.8
```

---

# 43. Performance Requirements

Target:

60 FPS circuit rendering on a normal desktop browser.

Avoid:

* React state updates every animation frame
* Excessive component rerenders
* Excessive 3D geometry
* Huge unoptimized datasets in browser memory

Use Three.js animation state appropriately.

---

# 44. Accessibility / Alternative Input

All major actions must work with:

* Mouse
* Keyboard

Hand tracking is an enhancement.

It must never be the only way to operate the application.

---

# 45. Coding Standards

Use:

* TypeScript strict typing
* Small focused components
* Domain types
* Reusable hooks
* Clear naming
* Separation of rendering and domain logic

Avoid:

* `any`
* Giant components
* Hardcoded values spread throughout components
* Premature abstraction
* Premature microservices
* Unnecessary dependencies

---

# 46. Testing

Prioritize tests for:

* Track-progress calculations
* Lap increment
* Race-state transformations
* Replay timing
* Strategy calculations
* Monte Carlo reproducibility
* ML feature transformations

Visual components do not need excessive unit testing during prototype stages.

---

# 47. Codex Working Rules

When Codex works on this repository:

1. Read this PRD before making architectural changes.

2. Inspect existing implementation before modifying files.

3. Do not rebuild working features unnecessarily.

4. Implement only the requested phase.

5. Do not automatically implement future phases.

6. Prefer the simplest correct implementation.

7. Do not introduce backend infrastructure during frontend-only phases.

8. Do not introduce AI/LLM functionality unless explicitly requested.

9. Do not introduce authentication unless explicitly requested.

10. Do not use generated fake telemetry while presenting it as real data.

11. Clearly mark synthetic data.

12. Preserve mouse controls when computer vision is introduced.

13. Keep race-state logic separate from visual rendering.

14. Keep external data providers behind adapters/services.

15. Run TypeScript checks after meaningful frontend changes.

16. Run tests after changes affecting domain logic.

17. Report:

* Files changed
* What was implemented
* Tests/checks performed
* Known limitations
* Recommended next step

---

# 48. Codex Must NOT Do

Unless explicitly requested, do NOT:

* Build the entire PRD in one task
* Add authentication
* Add user accounts
* Add admin dashboard
* Add payment functionality
* Add database infrastructure
* Add Docker/Kubernetes
* Add CI/CD
* Add LLM integration
* Add MediaPipe
* Add ML libraries
* Add external API integrations
* Generate fake Sepang geometry and call it accurate
* Add excessive dependencies
* Redesign the entire application during small feature work

---

# 49. Current Development Target

CURRENT TARGET:

**MILESTONE 1**

Build:

```text
SEPANG VISION LAB
        │
        ▼
TEST CIRCUIT
        │
        ▼
CAR 07
        │
        ▼
CAR MOVES
```

Nothing beyond this milestone is required yet.

---

# 50. Milestone 1 Acceptance Criteria

The milestone is complete when:

1. Application runs locally.
2. Sepang Vision Lab shell appears.
3. Three.js scene renders.
4. Test circuit renders.
5. CAR 07 marker appears.
6. CAR 07 follows circuit path.
7. CAR 07 moves smoothly.
8. Progress loops from 1.0 to 0.0.
9. Lap counter increments.
10. No browser console errors.
11. No TypeScript errors.
12. No backend exists yet.
13. No ML exists yet.
14. No webcam functionality exists yet.

---

# 51. Overall Milestones

```text
M1
Circuit + CAR 07

M2
Accurate Sepang geometry

M3
Multiple cars

M4
Selection + standings + inspector

M5
Telemetry

M6
Timeline + replay

M7
Backend + normalized race state

M8
Historical race integration

M9
Lap-time ML

M10
Tyre degradation

M11
Strategy Lab

M12
Monte Carlo

M13
Sepang weather simulation

M14
Hand tracking

M15
Gesture ML

M16
AI Race Engineer

M17
Final visual polish
```

---

# 52. Final Product Definition

The completed Sepang Vision Lab should demonstrate expertise across:

* Frontend engineering
* Data visualization
* Three.js
* Data engineering
* API design
* Machine learning
* Simulation
* Statistics
* Computer vision
* Human-computer interaction
* AI agent/tool integration

The project's defining experience should be:

> A user watches a race unfold on a Sepang digital twin, selects a car, inspects its telemetry, branches the current strategy, runs thousands of alternative race simulations, compares the results, and eventually performs these interactions by manipulating the circuit with both hands through a webcam.

---

# 53. Immediate Instruction

Do not attempt to build the complete system.

The current implementation task is:

**MILESTONE 1 — Test Circuit + CAR 07**

Implement only enough architecture to support this milestone cleanly.

Once M1 acceptance criteria pass, stop and wait for the next development instruction.
