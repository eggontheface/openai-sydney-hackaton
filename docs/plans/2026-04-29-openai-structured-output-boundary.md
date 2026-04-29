# OpenAI Structured Output Boundary Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add local structured coach output schemas, validators, fixtures, and a mock service boundary for Track B without requiring live OpenAI API calls.

**Architecture:** Keep the schema and validator layer headless under `src/coach`. Add a deterministic service interface beside the existing coach modules, and leave the current chat API wrapper untouched. Use Jest tests to lock the contract and make risk safety fields required.

**Tech Stack:** TypeScript, Jest, Expo React Native app, existing `src/coach` modules.

---

### Task 1: Document Issue 6 Ownership

**Files:**
- Modify: `docs/feature-issues.md`

**Step 1: Update issue 6 scope**

Add a note that issue 25 owns the `risk_flags` schema shape, while issue 6 owns detection helpers, source collection, and conservative override behavior.

**Step 2: Verify docs diff**

Run: `git diff -- docs/feature-issues.md`

Expected: Issue 6 clearly tells the owner to add the actual flags and override logic against the schema from issue 25.

### Task 2: Write Contract Tests

**Files:**
- Create: `src/coach/structuredCoach.test.ts`

**Step 1: Write failing tests**

Cover:

- `parseStructuredCoachOutput` accepts a complete fixture.
- Missing `risk_flags` fails validation.
- Missing required `risk_flags.items[].severity` fails validation.
- `createMockStructuredCoachService` returns a valid structured output without an API key.

**Step 2: Run tests to verify RED**

Run: `npm test -- --runInBand src/coach/structuredCoach.test.ts`

Expected: FAIL because schema/service modules do not exist yet.

### Task 3: Implement Schema And Validators

**Files:**
- Create: `src/coach/schemas.ts`

**Step 1: Add TypeScript contract**

Define `GoalProfile`, `EventProfile`, `RiskFlags`, `StaleDataReport`, `ReadinessStatus`, `DailyRecommendation`, `HealthCheck`, and `StructuredCoachOutput`.

**Step 2: Add validation helpers**

Implement `parseStructuredCoachOutput(value: unknown): StructuredCoachOutput` and focused nested validators. Use plain TypeScript checks, no new dependency.

**Step 3: Run tests**

Run: `npm test -- --runInBand src/coach/structuredCoach.test.ts`

Expected: Initial schema tests pass or fail only because the mock service is not implemented.

### Task 4: Add Fixtures And Mock Service

**Files:**
- Create: `src/coach/fixtures/structuredCoach.fixtures.ts`
- Create: `src/coach/structuredCoach.ts`

**Step 1: Add complete fixtures**

Export at least one complete conservative fixture and one helper for no-data/unknown-readiness output.

**Step 2: Add service interface**

Define `StructuredCoachService`, `StructuredCoachRequest`, and `createMockStructuredCoachService`.

**Step 3: Validate service output**

The mock service should call `parseStructuredCoachOutput` before returning.

**Step 4: Run targeted tests**

Run: `npm test -- --runInBand src/coach/structuredCoach.test.ts`

Expected: PASS.

### Task 5: Final Verification

**Files:**
- All touched files

**Step 1: Run full tests**

Run: `npm test -- --runInBand`

Expected: all Jest suites pass.

**Step 2: Run typecheck**

Run: `npm run typecheck`

Expected: TypeScript exits 0.

**Step 3: Run whitespace check**

Run: `git diff --check`

Expected: no whitespace errors.

**Step 4: Review status**

Run: `git status --short --branch`

Expected: only intended Track B files changed.
