# Milestone 29: wheels, cars that don't overlap, a clean hand-tracking popup, and a race engineer

- **Wheels:** dark tyre sidewalls and wheel covers, a flush wheel nut, and a compound band in the real compound colour, with two gaps like the real markings. The old flat grey covers, protruding nut and white dots are gone.
- **Cars no longer pass through each other** (`src/domain/separation.ts`):
  - Aligned positions carry a few metres of error, so two cars side by side or nose to tail could overlap although they never touched.
  - Each frame, overlapping cars are nudged sideways along the track normal to keep 2.4 m between centres.
  - The nudge eases in over at least 9.5 m, or 0.7 s at the closing speed. It fades out near the track edge and is blended over ±0.4 s, so it never jumps (at most 0.7 m per 0.2 s in the race).
  - Pairs that race control reports as colliding ("… CARS 16 (LEC) AND 27 (HUL) … CAUSING A COLLISION (16:40:50)") may touch within 10 s of the quoted local time (UTC+8).
  - Overlapping frames in the race fell from 3,955 to 211. The rest are pit-lane or off-track moments, or overlaps larger than the 2 m cap, which are left as data.
- **Hand tracking is a centred popup** over a dimmed backdrop instead of a bottom sheet:
  - The camera preview stays on the left.
  - The right side has **Gestures** (the arm switch, the last action and the gesture list) and **Advanced** (try the actions without a camera, the engine check, the gesture recorder and the fingertip tables).
  - Gestures fits without scrolling at 1366×768 and larger. On Advanced only the right column scrolls.
  - One gesture controller serves both tabs, so arming survives a tab switch. Clicking the backdrop closes the popup. Phones get one scrolling column.
- **Race engineer** (headset button by the car card):
  - Six preset questions are answered by rules from the recorded data, with no key and no network: gaps, tyres, pace, track status, weather, and where we are (`src/domain/engineer.ts`).
  - Typed or spoken questions go to Claude (`claude-opus-5-5`, low effort) with the viewer's own Anthropic API key. The key is entered under the key icon, kept in this browser's localStorage, and sent only to the Anthropic API, directly from the browser. Each question is billed to the key's account.
  - Without a key, typed questions that match a preset get its answer; others get a note.
  - Every request carries only a data brief of the moment, built from recorded channels (position, neighbours and intervals, tyre and age with `?` when unclear, laps, stops, flags, weather, the last three race-control messages), plus the question. The system prompt allows only numbers in the brief.
  - Answers are one-off: each new question replaces the last, and no history is sent.
  - Voice uses the browser: Web Speech recognition (en-GB, where supported) and speech synthesis after a short radio blip, mutable from the speaker icon.
  - The Anthropic SDK (`@anthropic-ai/sdk`, the one new dependency) loads as its own chunk on the first free question, never at start-up. The entry chunk grew from 272 KB to 285 KB.
  - Refused requests use the API's server-side fallback (`fallbacks: "default"`).
- **Tour:** a new "Race engineer" step points at `.sv-engineer-fab`.

## Limits

- The engineer knows only the brief. It has no tyre wear, fuel, damage or strategy model, and says so when asked.
- Calling the API from a browser exposes the key to that browser, by design: the viewer's own key, on their own device. Use a key with a spending limit.
- Speech recognition is missing in some browsers (for example Firefox), and the mic button is then hidden.
