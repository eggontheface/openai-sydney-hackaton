import type { WorkoutRecord } from "../health/types";
import type { RiskFlags } from "./schemas";
import { classifyTrainingState } from "./trainingState";

const asOfDate = "2026-04-29";

function workout(
  daysAgo: number,
  overrides: Partial<WorkoutRecord> = {},
): WorkoutRecord {
  const date = new Date(`${asOfDate}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - daysAgo);
  const localDate = date.toISOString().slice(0, 10);

  return {
    workoutId: `workout-${daysAgo}-${overrides.sportBucket ?? "run"}`,
    platform: "health_connect",
    startAt: `${localDate}T08:00:00.000Z`,
    endAt: `${localDate}T08:45:00.000Z`,
    localDate,
    sportBucket: "run",
    elapsedSeconds: 45 * 60,
    rawJson: "{}",
    ...overrides,
  };
}

function riskFlags(overrides: Partial<RiskFlags> = {}): RiskFlags {
  return {
    generated_at: "2026-04-29T12:00:00.000Z",
    highest_severity: "none",
    has_blocking_risk: false,
    summary: "No risk flags were supplied.",
    items: [],
    ...overrides,
  };
}

describe("training state classifier", () => {
  it("classifies no workout and no check-in data as unknown with lower recommendation confidence", () => {
    const state = classifyTrainingState({ asOfDate });

    expect(state.state).toBe("unknown");
    expect(state.confidence).toBeLessThanOrEqual(0.35);
    expect(state.recommendationConfidenceMultiplier).toBeLessThan(1);
    expect(state.explanation).toMatch(/not enough/i);
  });

  it("classifies an explicit beginner check-in with no workout history as first-time athlete", () => {
    const state = classifyTrainingState({
      asOfDate,
      checkIns: [
        {
          source: "goal_profile",
          text: "I am brand new to training and just starting exercise.",
        },
      ],
    });

    expect(state.state).toBe("first_time_athlete");
    expect(state.baselineBuildingRecommended).toBe(true);
    expect(state.recommendedBehavior).toBe("baseline_building");
    expect(state.explanation).toMatch(/first-time/i);
  });

  it("classifies recent activity after an extended gap as returning after extended gap", () => {
    const state = classifyTrainingState({
      asOfDate,
      workouts: [workout(2), workout(50), workout(65)],
    });

    expect(state.state).toBe("returning_after_extended_gap");
    expect(state.baselineBuildingRecommended).toBe(true);
    expect(state.recommendedBehavior).toBe("baseline_building");
    expect(state.explanation).toMatch(/gap/i);
  });

  it("classifies one active day in the last 30 days as inconsistent or low recent activity", () => {
    const state = classifyTrainingState({
      asOfDate,
      workouts: [workout(8), workout(42)],
    });

    expect(state.state).toBe("inconsistent_or_low_recent_activity");
    expect(state.activeDaysLast30).toBe(1);
    expect(state.recommendedBehavior).toBe("baseline_building");
  });

  it("classifies three recent active days as consistent recreational athlete", () => {
    const state = classifyTrainingState({
      asOfDate,
      workouts: [workout(3), workout(10), workout(17), workout(38)],
    });

    expect(state.state).toBe("consistent_recreational_athlete");
    expect(state.activeDaysLast30).toBe(3);
    expect(state.recommendedBehavior).toBe("normal_progression");
    expect(state.confidence).toBeGreaterThanOrEqual(0.7);
  });

  it("classifies high recent frequency and duration as advanced athlete", () => {
    const state = classifyTrainingState({
      asOfDate,
      workouts: [
        workout(1, { elapsedSeconds: 75 * 60 }),
        workout(4, { elapsedSeconds: 80 * 60 }),
        workout(7, { elapsedSeconds: 90 * 60 }),
        workout(10, { elapsedSeconds: 70 * 60 }),
        workout(14, { elapsedSeconds: 85 * 60 }),
        workout(18, { elapsedSeconds: 95 * 60 }),
        workout(23, { elapsedSeconds: 75 * 60 }),
        workout(28, { elapsedSeconds: 90 * 60 }),
      ],
    });

    expect(state.state).toBe("advanced_athlete");
    expect(state.activeDaysLast30).toBe(8);
    expect(state.totalWorkoutMinutesLast30).toBeGreaterThanOrEqual(600);
    expect(state.recommendedBehavior).toBe("normal_progression");
  });

  it("classifies a currently consistent athlete with an old historical gap by recent training", () => {
    const state = classifyTrainingState({
      asOfDate,
      workouts: [
        workout(1, { elapsedSeconds: 75 * 60 }),
        workout(4, { elapsedSeconds: 80 * 60 }),
        workout(7, { elapsedSeconds: 90 * 60 }),
        workout(10, { elapsedSeconds: 70 * 60 }),
        workout(14, { elapsedSeconds: 85 * 60 }),
        workout(18, { elapsedSeconds: 95 * 60 }),
        workout(100, { elapsedSeconds: 45 * 60 }),
      ],
    });

    expect(state.state).toBe("advanced_athlete");
    expect(state.baselineBuildingRecommended).toBe(false);
    expect(state.recommendedBehavior).toBe("normal_progression");
  });

  it.each(["no pain today", "doctor cleared me"])(
    "does not classify non-limiting check-in text as currently limited: %s",
    (text) => {
      const state = classifyTrainingState({
        asOfDate,
        workouts: [workout(2), workout(9), workout(16), workout(23)],
        checkIns: [{ source: "daily_check_in", text }],
      });

      expect(state.state).toBe("consistent_recreational_athlete");
      expect(state.recommendedBehavior).toBe("normal_progression");
    },
  );

  it.each(["sharp pain in my knee", "doctor told me not to train"])(
    "classifies direct limiting check-in text as currently limited: %s",
    (text) => {
      const state = classifyTrainingState({
        asOfDate,
        workouts: [workout(2), workout(9), workout(16), workout(23)],
        checkIns: [{ source: "daily_check_in", text }],
      });

      expect(state.state).toBe("currently_limited");
      expect(state.recommendedBehavior).toBe(
        "recovery_or_professional_guidance",
      );
    },
  );

  it("classifies blocking risk flags as currently limited even with advanced recent activity", () => {
    const state = classifyTrainingState({
      asOfDate,
      workouts: [
        workout(1, { elapsedSeconds: 75 * 60 }),
        workout(4, { elapsedSeconds: 80 * 60 }),
        workout(7, { elapsedSeconds: 90 * 60 }),
        workout(10, { elapsedSeconds: 70 * 60 }),
        workout(14, { elapsedSeconds: 85 * 60 }),
        workout(18, { elapsedSeconds: 95 * 60 }),
      ],
      riskFlags: riskFlags({
        highest_severity: "high",
        has_blocking_risk: true,
        summary: "Detected risk flags for injury concern.",
      }),
    });

    expect(state.state).toBe("currently_limited");
    expect(state.recommendedBehavior).toBe("recovery_or_professional_guidance");
    expect(state.confidence).toBeGreaterThanOrEqual(0.8);
    expect(state.explanation).toMatch(/risk/i);
  });
});
