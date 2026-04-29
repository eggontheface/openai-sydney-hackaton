# BioStream Prototype UI Audit

Date: 2026-04-29

## Reference

The design reference is `UI/BioStream/Prototype.html`, locked to the Quiet Data direction.

## Core Design Language

- Conversation is the primary surface, not a dashboard.
- Data appears in small source-aware cards inside the conversation.
- Graphs explain a specific coaching signal, not generic database history.
- Typography uses a quiet sans-serif for labels and a serif voice for coach copy and key values.
- Cards use restrained borders, off-white fills, compact spacing, and small-radius geometry.
- Bottom actions and coach input are persistent, pill-shaped, and lightweight.

## Missed Features In The Live Expo App

- Coach used dashboard-style bubbles and a green athletic palette instead of the Quiet Data palette.
- Coach recovery used a large readiness ring rather than the prototype's compact sleep/recovery metric grid.
- The workout card was not visually embedded as a tappable chat card.
- Workout missed the centered top bar, "Today · built from readiness" intro, and calmer serif page title.
- Workout missed the Apple Watch capture panel explaining which metrics are automatic.
- Workout missed the effort profile graph.
- Workout had generic metric tags instead of a clear watch/manual capture model.
- Workout lacked the prototype's persistent "Start on Watch" and "Schedule" action row.
- History showed raw pipeline counts and daily database rows instead of a user-facing signal view.
- History missed segmented signal filters: Recovery, Strain, Sleep, Body.
- History missed the seven-day HRV trend chart with baseline comparison.
- History missed compact sleep and resting heart-rate cards with mini charts.
- History missed imported workout rows framed as source-aware activity history.
- History coach input was too bulky and did not match the slim composer from the prototype.

## Updates Applied

- Replaced the native theme with the Quiet Data palette.
- Rebuilt Coach toward the prototype's conversational layout.
- Rebuilt Workout with watch capture card, effort profile graph, and sticky action row.
- Rebuilt History around "Your signal", segmented filters, HRV trend, mini recovery cards, imported workouts, and slim coach input.
- Kept the actual Expo architecture and `PipelineSnapshot` data flow intact.

## Remaining Design Work

- Port the onboarding chat screen into native React Native.
- Add interactive signal switching for Strain, Sleep, and Body.
- Make the Workout plan list match the lower part of the prototype after scrolling.
- Replace browser/demo values with real HealthKit or Health Connect data on device.
