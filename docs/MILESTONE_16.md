# M16 — simulator-grounded race engineer

M15 is deferred at the user's request: recording and training tools are implemented, but real gesture recordings and evaluation remain pending.

The historical Strategy Lab now offers a Race engineer panel after a comparison. Explain comparison locally reruns the captured branch through the existing deterministic simulator, then renders its baseline, winner, plan deltas, pit loss and limitations. This mode works without API credentials and is explicitly labeled no AI. The selected replay driver/time does not replace the frozen strategy branch. Editing comparison inputs or capturing another branch unmounts the answer and cancels pending work.

The optional AI path follows a bounded tool flow: question plus captured context → model function call → actual compare_strategy → model evidence selection → simulator-derived explanation. The model may call only compare_captured_strategy with no arguments. It cannot change driver, costs, weather or pit timing. Its final structured output contains only known plan IDs; arbitrary model prose/numbers are never displayed. Unsupported questions and malformed evidence fail explicitly. No automatic fallback is presented as AI.

## Configuration

Set OPENAI_API_KEY and OPENAI_ENGINEER_MODEL in the backend process environment, then restart the local API. Use a model available to your account that supports Responses function calling and structured JSON output. Never put keys in frontend code, VITE variables, exports or versioned files. No model is selected or paid call made automatically. The status endpoint exposes only a configuration boolean, not secrets; configuration does not prove credentials work.

Before each AI request, the panel requires the user to enable sharing of the question, captured race context and simulation results with OpenAI. It sends no camera data or gesture recordings. Requests use https://api.openai.com/v1/responses, store:false, bounded output and timeouts, with no redirects. Local explanation sends nothing externally. The API error path hides provider response bodies and credentials.

Implementation follows [official OpenAI function calling documentation](https://developers.openai.com/api/docs/guides/function-calling). Two requests at most: the simulator tool call followed by structured evidence selection. This is a deliberately bounded assistant for existing single-driver comparisons, not general chat, weather analysis, real tyre telemetry or finishing-position prediction.

Files: backend/race_engineer.py, backend/main.py, backend/test_race_engineer.py, src/components/historical/RaceEngineer.tsx, StrategyLab.tsx and package.json.

Live provider verification remains pending API configuration. Mocked tests exercise tool dispatch and evidence constraints; they do not establish real model quality. M15 remains deferred. Next: configure and evaluate the AI connection, or proceed with M17 interface/performance polish while both data-dependent checks remain open.

Validation: 68 frontend tests and 43 backend tests passed. Production build passed. Browser verified Ocon lap 41 with remaining stay/now/later times 1470.330 / 1492.330 / 1490.530 seconds, local-no-AI labeling and disabled AI action without configuration. No real provider call was made.
