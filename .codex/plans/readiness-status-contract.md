# Readiness Status Contract

## Objective

Implement GitHub issue #16 by replacing the local numeric-only readiness heuristic with a readiness status contract covering Green, Yellow, Red, and Unknown states, including confidence, used signals, stale signals ignored, missing signals, and any conservative adjustment reason.

## Current Status

Implemented and verified.

## Ordered Steps

1. Read existing storage, risk flag, training load, health type, and coach UI patterns.
2. Write focused readiness status tests first and verify the expected red failure.
3. Implement a scoped `src/coach/readinessStatus.ts` contract module.
4. Integrate the contract into the existing local recommendation pipeline and coach card UI.
5. Run required verification commands and commit the focused changes.

## Last Updated

2026-04-29
