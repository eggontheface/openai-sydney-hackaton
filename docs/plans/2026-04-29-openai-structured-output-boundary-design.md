# OpenAI Structured Output Boundary Design

Last updated: 2026-04-29

## Objective

Land Track B issue 25 by defining stable, local TypeScript contracts for coach structured output without requiring a live OpenAI API key. This branch also publishes the `risk_flags` schema shape so issue 6 can add risk detection and conservative overrides against a known contract.

## Scope

- Add TypeScript schema types for `goal_profile`, `event_profile`, `risk_flags`, `stale_data_report`, `readiness_status`, `daily_recommendation`, and `health_check`.
- Add runtime validation helpers that reject missing required safety fields.
- Add a coach service interface that can be backed by deterministic local logic now and model calls later.
- Add mocked structured outputs for local development and tests.
- Update issue 6 so its owner extends the `risk_flags` contract with extraction helpers and recommendation override behavior.

## Out Of Scope

- Production OpenAI API integration.
- Prompt tuning.
- Risk flag extraction from onboarding, check-ins, or typed adjustments.
- Recommendation UI rewrites.

## Architecture

The contract lives in `src/coach/schemas.ts`. It exports discriminated string unions, structured output types, lightweight runtime validators, and `parse*` helpers that return typed values or throw a useful validation error.

The service boundary lives in `src/coach/structuredCoach.ts`. It exposes a `StructuredCoachService` interface and a deterministic mock implementation. The app can use this interface in fixture-driven development while a later OpenAI-backed service maps the same contract to Structured Outputs.

Mock outputs live in `src/coach/fixtures/structuredCoach.fixtures.ts` so tests and UI work can import complete examples without requiring credentials.

## Risk Flags

`risk_flags` is a required field in the structured response contract. This branch defines the stable shape: severity, category, source, evidence, recommendation impact, and professional-care guidance. Issue 6 remains responsible for detecting flags, merging flags from user/profile/check-in inputs, and applying conservative overrides before recommendations render.

## Testing

Add Jest tests covering:

- A complete mocked structured response validates successfully.
- Missing required `risk_flags` safety data fails validation.
- The mock coach service returns the same structured contract without an API key.
- Unknown or incomplete data can still produce conservative typed output.
