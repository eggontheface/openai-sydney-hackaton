# Independent Feature Issues

This backlog is derived from the project direction in `README.md`, the coaching behavior in
`docs/health-fitness-ai-master-prompt.md`, and the platform-neutral schema target in
`docs/health-connect-apple-health-schema-spec.md`.

## Project Goal

Build a privacy-first React Native wellness coach that imports Apple Health or Health Connect data
into a local SQLite pipeline, turns it into source-aware daily coaching context, and gives practical,
conservative movement, recovery, and training recommendations. The app should help today without
pretending that stale, incomplete, or missing data is more reliable than it is.

## Issue Design Rules

- Each issue should be small enough for one person to own.
- Each issue should define its own UI, data, or service contract.
- Issues that need AI output should first work from deterministic fixtures or mocked structured data.
- Native health import work should preserve raw source payloads and source metadata.
- Coaching features must include conservative behavior for missing, stale, or risky inputs.

## Suggested Labels

- `feature`
- `mobile-ui`
- `data-pipeline`
- `coach`
- `safety`
- `privacy`
- `platform-ios`
- `platform-android`
- `testing`
- `hackathon`

## Backlog

### 1. Progressive Goal Onboarding

**Area:** onboarding, coach

**Goal:** Replace the static coach intro with a low-friction onboarding flow that starts with:

```text
What are you hoping to achieve with your health or fitness right now?
```

**Scope:**

- Add a first-run onboarding state before the normal coach feed.
- Accept typed goal input.
- Classify the answer into general fitness, body composition, strength, endurance, event preparation,
  return to training, health and energy, or unknown.
- Reflect the goal back with one useful next step.
- Ask only the next safety question after the goal is captured.

**Acceptance Criteria:**

- A new user sees one goal question, not a long form.
- A typed answer creates an in-memory draft goal classification.
- The next prompt asks about pain, injury, illness, or major training gaps.
- Missing details are marked unknown rather than inferred.
- Existing sync and export flows still work after onboarding is complete.

**Out of Scope:**

- Voice input.
- Full AI integration.
- Long-term profile persistence.

### 2. Local Goal Profile Store

**Area:** storage, coach

**Goal:** Persist a structured `goal_profile` locally so the coach can adapt recommendations over time.

**Scope:**

- Add a `goal_profile` table or equivalent local SQLite storage.
- Store primary goal, secondary goals, motivation, timeframe, experience level, preferred activities,
  disliked activities, constraints, risk flags, coaching style, starting strategy, confidence, and
  `updated_at`.
- Add read, write, and clear helpers.
- Include the profile in the exported pipeline JSON.

**Acceptance Criteria:**

- The app can create, update, read, and clear one local goal profile.
- Unknown fields are stored explicitly as null, empty arrays, or `"unknown"`.
- Export includes the current goal profile without sending it anywhere automatically.
- TypeScript types describe the storage contract.

**Out of Scope:**

- Event profiles.
- AI goal parsing.
- Remote account sync.

### 3. Daily Check-In UI

**Area:** mobile-ui, coach

**Goal:** Add a one-tap daily check-in that captures current context when wearable data is missing or incomplete.

**Scope:**

- Add check-in controls for sleep quality, soreness, energy, pain, available time, preferred activity,
  and completed-yesterday status.
- Persist the latest check-in by local date.
- Show the current check-in in the coach feed.
- Include check-in values in recommendation inputs.

**Acceptance Criteria:**

- A user can complete today's check-in in under 30 seconds.
- Pain is represented as a clear risk flag.
- The coach can distinguish imported wearable data from user-reported data.
- Export includes check-in history.

**Out of Scope:**

- Free-text chat parsing.
- Push notifications.

### 4. Typed Coach Plan Adjustments

**Area:** coach, mobile-ui

**Goal:** Make the composer functional for common plan adjustment messages.

**Scope:**

- Allow the user to type messages such as "I only have 20 minutes", "my knee hurts", "make it easier",
  or "I feel great".
- Add deterministic parsing for a small set of adjustment intents.
- Update the displayed recommendation conservatively based on the parsed intent.
- Add visible assistant responses that explain what changed.

**Acceptance Criteria:**

- The composer accepts text and appends user and coach messages to the feed.
- Short-time, pain, fatigue, easier, and harder intents are handled.
- Pain or illness never increases intensity.
- Unsupported messages produce a useful fallback question.

**Out of Scope:**

- Realtime voice.
- Full LLM conversation.

### 5. Voice Check-In Prototype

**Area:** voice, onboarding

**Goal:** Add a prototype voice entry path for onboarding and daily check-ins.

**Scope:**

- Add a voice/text toggle in onboarding and check-in surfaces.
- Wire the UI to a placeholder voice service interface.
- Support mocked transcript input for development.
- Document the future Realtime API integration boundary.

**Acceptance Criteria:**

- The app can run without a voice backend.
- A mocked transcript can populate the same fields as typed input.
- Voice state has clear idle, listening, processing, error, and complete states.
- The implementation does not block typed onboarding.

**Out of Scope:**

- Production Realtime API integration.
- Audio streaming credentials.

### 6. Safety Risk Flags and Conservative Override

**Area:** safety, coach

**Goal:** Centralize risk handling so symptoms, pain, illness, pregnancy-related concerns, disordered eating signals,
or severe fatigue force safer guidance.

**Scope:**

- Create a risk flag model and helper functions.
- Extend the `risk_flags` schema introduced by issue 25 with the actual flag catalog and extraction helpers.
- Collect risk flags from onboarding, daily check-ins, and typed adjustments.
- Add a conservative override layer before recommendations are shown.
- Surface professional-care guidance for serious symptoms without diagnosing.

**Acceptance Criteria:**

- Chest pain, fainting, unusual shortness of breath, fever, significant pain, and injury concerns trigger
  red or recovery guidance.
- Risk flags are included in exported JSON.
- The coach explains that risk lowered confidence or intensity.
- Unit tests cover at least five risk inputs.

**Out of Scope:**

- Medical triage.
- Emergency service workflows.

### 7. Event Goal Extraction

**Area:** coach, onboarding

**Goal:** Detect event-style goals and create a draft `event_profile`.

**Scope:**

- Parse user text for event intent, event name, event type, location, date hints, and distance or format.
- Store a draft event profile with unknown fields marked explicitly.
- Show a compact confirmation card.
- Ask only the minimum missing event questions.

**Acceptance Criteria:**

- "I signed up for Hyrox" creates an event draft.
- "I want to run a 10K in July" creates an event draft with unknown exact date.
- The user can confirm or edit draft fields.
- The event goal does not automatically create aggressive training.

**Out of Scope:**

- Web lookup of official event details.
- Calendar integration.

### 8. Event Confirmation and Phased Plan UI

**Area:** mobile-ui, coach

**Goal:** Show confirmed event goals as phased plans without losing the daily conservative recommendation model.

**Scope:**

- Add an event confirmation card.
- Add a compact phased-plan view: baseline, base building, event-specific preparation, taper, event week,
  recovery.
- Show weeks until event when a date is known.
- Show safety messaging if the event is too soon for current readiness.

**Acceptance Criteria:**

- Confirmed event details persist locally.
- Plan phases render with current phase highlighted.
- Beginner, returning, or high-risk users start in baseline phase.
- The daily recommendation remains separate from the long-term goal.

**Out of Scope:**

- Generated day-by-day training calendars.
- Official event data search.

### 9. Training State Classifier

**Area:** coach, data-pipeline

**Goal:** Classify current training state before recommending activity.

**Scope:**

- Implement deterministic classification for first-time athlete, returning after an extended gap,
  inconsistent or low recent activity, consistent recreational athlete, advanced athlete, currently
  limited, and unknown.
- Use recent workouts, active days, training gaps, check-ins, and risk flags.
- Include a confidence value and explanation.

**Acceptance Criteria:**

- Classification works with no data, partial data, and 30-day workout history.
- Unknown state lowers recommendation confidence.
- Returning and first-time classifications recommend baseline-building behavior.
- Tests cover at least six classification scenarios.

**Out of Scope:**

- Full training-load model.
- AI prompt integration.

### 10. Readiness Status Contract

**Area:** coach

**Goal:** Replace the current numeric-only readiness heuristic with a Green, Yellow, Red, Unknown contract.

**Scope:**

- Define a `readiness_status` structure with status, confidence, signals used, stale signals ignored,
  missing signals, and conservative adjustment reason.
- Map status to coach UI copy and colors.
- Preserve the numeric score only as a secondary display if useful.

**Acceptance Criteria:**

- The app can show Green, Yellow, Red, and Unknown readiness states.
- Unknown is treated conservatively, not neutrally.
- Stale or missing data appears in the explanation.
- Existing coach card still renders when only partial data exists.

**Out of Scope:**

- LLM-generated recommendations.
- New native data imports.

### 11. Daily Recommendation Output Contract

**Area:** coach

**Goal:** Make daily recommendations conform to the product contract from the master prompt.

**Scope:**

- Add fields for readiness status, short explanation, recommended activity, intensity target, duration
  or volume, easier alternative, what to avoid today, confidence, sources used, sources ignored, and one
  check-in question.
- Render those fields in the coach feed.
- Keep all recommendations conservative when inputs are incomplete.

**Acceptance Criteria:**

- Today's plan includes an easier alternative and what to avoid.
- The UI shows confidence and source awareness.
- The recommendation can be generated from deterministic fixtures.
- Unit tests verify missing data reduces confidence.

**Out of Scope:**

- Long-term event plan generation.
- Full model calls.

### 12. Source Freshness and Completeness Model

**Area:** data-pipeline, privacy

**Goal:** Track whether each data domain is fresh enough to use for today's recommendation.

**Scope:**

- Add source freshness metadata for sleep, workouts, steps, energy, HRV, resting HR, nutrition, body
  composition, and check-ins.
- Mark each domain as fresh, stale, missing, or partial.
- Include last updated time and known limitations.
- Surface this status in the Source screen.

**Acceptance Criteria:**

- Each domain has a freshness state in the pipeline snapshot.
- Stale domains are downgraded in coach explanations.
- The Source screen shows data coverage without implying unavailable data exists.
- Export includes source freshness.

**Out of Scope:**

- Background sync.
- New import permissions.

### 13. `health_check.md` Export

**Area:** data-pipeline, export

**Goal:** Generate a human-readable health check summary from local data.

**Scope:**

- Add a local generator for `health_check.md`.
- Summarize what is known, uncertain, stale, risky, and missing.
- Include source coverage and latest available dates.
- Make it available through the export flow.

**Acceptance Criteria:**

- Export produces both JSON and Markdown artifacts.
- The Markdown does not include medical diagnosis language.
- Stale and missing data are clearly identified.
- The file can be generated from fixture data in tests.

**Out of Scope:**

- Sharing to cloud services.
- LLM-written summaries.

### 14. `llm_bundle.json` Export

**Area:** data-pipeline, AI

**Goal:** Produce a small, source-aware structured bundle for future AI reasoning.

**Scope:**

- Define the `llm_bundle.json` schema.
- Include current state, recent history, goal profile, event profile, daily check-in, source freshness,
  risk flags, and data limitations.
- Keep raw records out of the bundle unless explicitly needed.
- Add export support.

**Acceptance Criteria:**

- Bundle generation works offline from SQLite.
- Each source has name, date range, last updated timestamp, confidence or completeness, staleness,
  recommendation usability, and limitations.
- The bundle is smaller than the full raw export.
- Tests validate schema shape.

**Out of Scope:**

- Calling an OpenAI model.
- Prompt orchestration.

### 15. Permission Diagnostics Screen

**Area:** mobile-ui, data-pipeline

**Goal:** Make Health Connect and HealthKit sync diagnostics understandable in the app.

**Scope:**

- Persist the latest diagnostics from sync runs.
- Show granted, missing, no-data, timeout, and error states by record type.
- Add next actions for opening platform settings when supported.
- Keep warnings visible after app refresh.

**Acceptance Criteria:**

- The Source screen shows diagnostics by data domain.
- Missing permissions are not confused with empty source data.
- Users can open Android Health Connect settings from diagnostics.
- Sync warnings survive refresh until the next sync.

**Out of Scope:**

- Automatic permission repair.
- iOS Settings deep links beyond what the platform supports.

### 16. Apple Health Import Parity

**Area:** platform-ios, data-pipeline

**Goal:** Bring iOS imports closer to the target schema instead of only writing generic samples.

**Scope:**

- Add HealthKit reads for sleep analysis, resting heart rate, HRV, VO2 max, body weight, body fat,
  lean body mass, dietary energy, macros, hydration, and workouts.
- Normalize sleep sessions into `sleep_sessions`.
- Normalize workouts into `workouts`.
- Preserve HealthKit quantity identifiers and source revision metadata.

**Acceptance Criteria:**

- iOS sync can populate `sleep_sessions`, `workouts`, and key daily metrics.
- HRV method is recorded as Apple SDNN metadata, not treated as RMSSD.
- Missing HealthKit categories produce warnings, not crashes.
- Existing Android sync behavior is unchanged.

**Out of Scope:**

- Workout routes.
- Background delivery.

### 17. Health Connect Workout Enrichment

**Area:** platform-android, data-pipeline

**Goal:** Improve Android workout rows with distance, calories, heart rate, speed, cadence, and power where available.

**Scope:**

- Read or derive workout summaries from Health Connect records and streams.
- Populate `distance_km`, `active_kcal`, `total_kcal`, `avg_hr_bpm`, `max_hr_bpm`, `moving_seconds`,
  and optional stream references.
- Keep raw records in `raw_json`.
- Preserve route availability without requiring route import.

**Acceptance Criteria:**

- Workout rows contain more than title, type, and elapsed duration when source data exists.
- Missing stream data does not block workout import.
- Aggregation is scoped to each workout time window.
- Tests cover a workout with and without heart-rate samples.

**Out of Scope:**

- Map rendering.
- Training load calculation.

### 18. HRV Method Separation

**Area:** data-pipeline, coach

**Goal:** Prevent Health Connect RMSSD and Apple Health SDNN from being compared as equivalent values.

**Scope:**

- Store HRV method metadata for each HRV sample.
- Derive baselines per source and method.
- Update daily rollups or recommendation inputs to expose method information.
- Display method limitations in source freshness or coach explanation when relevant.

**Acceptance Criteria:**

- HRV records include method metadata.
- Readiness logic does not mix RMSSD and SDNN baselines.
- The UI can explain when HRV is unavailable or method-incompatible.
- Tests cover mixed-source HRV data.

**Out of Scope:**

- Clinical HRV interpretation.
- Vendor HRV status replication.

### 19. Expanded Nutrition and Hydration Coverage

**Area:** data-pipeline

**Goal:** Align nutrition storage with the schema spec and preserve micronutrients.

**Scope:**

- Add explicit fields for potassium, calcium, iron, magnesium, zinc, vitamins, saturated fat,
  monounsaturated fat, polyunsaturated fat, and trans fat where practical.
- Preserve every unsupported numeric nutrient in `all_nutrients_json`.
- Improve meal counting with meal type or meal name when present.
- Include source freshness for nutrition and hydration separately.

**Acceptance Criteria:**

- Daily nutrition totals include existing macros plus supported micronutrients.
- Unsupported fields are not dropped.
- Hydration contributes to daily context even when nutrition is absent.
- Export includes expanded fields.

**Out of Scope:**

- Food logging UI.
- Nutrition coaching or diet prescription.

### 20. Privacy and Data Controls

**Area:** privacy, mobile-ui

**Goal:** Give users clear control over local data without weakening the privacy-first positioning.

**Scope:**

- Add a privacy/data section explaining local storage, exports, and clear-data behavior.
- Split clear actions into imported health data, profile/check-ins, and all local data.
- Add confirmation copy that states what will be deleted.
- Show last export time if available.

**Acceptance Criteria:**

- Users can clear app data by category.
- Export is user-initiated only.
- The UI does not imply data leaves the device automatically.
- Clear actions refresh the coach and source screens immediately.

**Out of Scope:**

- Cloud backup.
- Account deletion.

### 21. History Drill-Down

**Area:** mobile-ui

**Goal:** Make the History screen useful for debugging and user trust.

**Scope:**

- Add a daily detail view for one selected date.
- Show sleep, steps, energy, workouts, vitals, nutrition, body composition, source coverage, and raw
  sample counts.
- Show whether the day is partial or full.
- Link recent workouts to a simple workout detail view.

**Acceptance Criteria:**

- Tapping a day opens a detail view.
- Tapping a workout opens a workout detail view.
- Source and completeness information is visible.
- Empty domains are shown as missing rather than zero.

**Out of Scope:**

- Charts beyond simple summaries.
- Editing imported records.

### 22. Incremental Sync and Sync History

**Area:** data-pipeline

**Goal:** Make repeated syncs faster and easier to inspect.

**Scope:**

- Store sync diagnostics and counts by provider, range, started time, ended time, status, and error.
- Add an incremental sync option based on last successful sync.
- Keep manual 7-day and 30-day sync actions.
- Show recent sync runs in the Source screen.

**Acceptance Criteria:**

- A user can see the last several sync runs and their outcomes.
- Incremental sync does not remove the ability to resync 7 or 30 days.
- Failed syncs are recorded with errors.
- Duplicate records are still deduped by stable IDs.

**Out of Scope:**

- Background scheduled sync.
- Server-side sync.

### 23. Platform-Neutral Schema Migration Tests

**Area:** testing, data-pipeline

**Goal:** Protect the local SQLite schema and rollup rules from regressions.

**Scope:**

- Add fixture data for health samples, sleep sessions, workouts, and nutrition.
- Add tests for daily rollup rules: local dates, sleep wake dates, missing values, today as partial,
  and no missing-as-zero behavior.
- Add migration tests for legacy sample rows if the migration path is still supported.

**Acceptance Criteria:**

- `npm run typecheck` still passes.
- A test command exists and is documented.
- Fixtures cover at least one day with partial data and one day with full data.
- Tests fail if sleep is assigned to start date instead of wake date.

**Out of Scope:**

- Native device integration tests.
- UI screenshot testing.

### 24. Recommendation Fixture Harness

**Area:** testing, coach

**Goal:** Make coach behavior testable without a real device or live health data.

**Scope:**

- Add JSON fixtures for no data, stale data, poor sleep, high readiness, pain flag, returning athlete,
  and event goal.
- Add a deterministic recommendation test harness.
- Snapshot the structured recommendation output, not only UI text.

**Acceptance Criteria:**

- A developer can run recommendation tests locally.
- Pain and illness fixtures never produce high-intensity plans.
- Unknown readiness produces conservative guidance.
- Fixture outputs include sources used, sources ignored, confidence, and next check-in question.

**Out of Scope:**

- LLM output tests.
- Native health permissions.

### 25. OpenAI Structured Output Boundary

**Area:** AI, coach

**Goal:** Define the local contract for future model calls without coupling the app to a live model during development.

**Scope:**

- Add TypeScript schemas for `goal_profile`, `event_profile`, `readiness_status`,
  `daily_recommendation`, `risk_flags`, `stale_data_report`, and `health_check`.
- Add a coach service interface that can be backed by deterministic local logic or a model call.
- Add mocked model responses for development.
- Ensure all model-derived values can be inspected before rendering.

**Acceptance Criteria:**

- The app can run entirely with mocked structured outputs.
- Schema validation rejects missing required safety fields.
- The coach UI consumes the same interface regardless of local or model-backed mode.
- No API keys are required to run the app.

**Out of Scope:**

- Production OpenAI API integration.
- Prompt tuning.

### 26. Training Load Placeholder and Intervals Integration Boundary

**Area:** data-pipeline, coach

**Goal:** Represent training load honestly until a real source or local model exists.

**Scope:**

- Add explicit `training_load_status`: unavailable, source-provided, derived, or stale.
- Preserve Intervals-ready fields in the schema boundary.
- Ensure recommendations do not fabricate training load from generic platform data.
- Add UI copy explaining when load is unavailable.

**Acceptance Criteria:**

- Training load is never shown as real unless sourced or derived by a documented method.
- Recommendation logic can operate without training load.
- Export states whether training load was unavailable, source-provided, derived, or stale.
- Tests cover missing training load.

**Out of Scope:**

- Building a full training stress model.
- Connecting to Intervals.icu.
