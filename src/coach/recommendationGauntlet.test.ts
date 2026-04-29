import {
  highReadinessGauntletFixture,
  noDataGauntletFixture,
  poorSleepGauntletFixture,
  returningAthleteGauntletFixture,
  riskGauntletFixtures,
  staleDataGauntletFixture,
} from "./fixtures/recommendationGauntlet.fixtures";
import { generateStructuredCoachRecommendation } from "./recommendationEngine";
import {
  parseStructuredCoachOutput,
  type StructuredCoachOutput,
} from "./schemas";

const generated_at = "2026-04-29T12:00:00.000Z";

function runFixture({
  userMessage,
  snapshot,
  goalProfile,
}: {
  userMessage: string;
  snapshot: unknown;
  goalProfile?: unknown;
}) {
  const output = generateStructuredCoachRecommendation({
    generated_at,
    user_message: userMessage,
    goal_profile: goalProfile,
    health_context: { snapshot },
  });

  return parseStructuredCoachOutput(output);
}

function assertBattleTestedShape(output: StructuredCoachOutput) {
  expect(output.daily_recommendation.easier_alternative.title).toBeTruthy();
  expect(
    output.daily_recommendation.what_to_avoid_today.length,
  ).toBeGreaterThan(0);
  expect(output.daily_recommendation.check_in_question).toBeTruthy();
  expect(output.daily_recommendation.confidence).toBeGreaterThanOrEqual(0);
  expect(output.daily_recommendation.confidence).toBeLessThanOrEqual(1);
  expect(output.health_check.summary_markdown).toBeTruthy();
}

describe("coach recommendation gauntlet", () => {
  it("returns a conservative unknown recommendation when no health data exists", () => {
    const output = runFixture(noDataGauntletFixture);

    assertBattleTestedShape(output);
    expect(output.readiness_status.status).toBe("unknown");
    expect(output.readiness_status.missing_signals).toEqual(
      expect.arrayContaining(["sleep", "recent workouts", "daily check-in"]),
    );
    expect(output.daily_recommendation.recommended_activity.activity_type).toBe(
      "walk",
    );
    expect(
      output.daily_recommendation.recommended_activity.intensity_target,
    ).toBe("recovery");
    expect(output.daily_recommendation.confidence).toBeLessThanOrEqual(0.45);
  });

  it("ignores stale green-looking data instead of treating it as current readiness", () => {
    const output = runFixture(staleDataGauntletFixture);

    assertBattleTestedShape(output);
    expect(output.readiness_status.status).not.toBe("green");
    expect(output.stale_data_report.stale_signals).toEqual(
      expect.arrayContaining(["sleep", "workouts", "hrv", "resting_hr"]),
    );
    expect(output.daily_recommendation.sources_ignored).toEqual(
      expect.arrayContaining(["sleep", "workouts", "hrv", "resting_hr"]),
    );
    expect(
      output.daily_recommendation.recommended_activity.intensity_target,
    ).not.toBe("hard");
    expect(output.daily_recommendation.confidence).toBeLessThan(0.7);
  });

  it("downshifts poor sleep and low readiness to recovery work", () => {
    const output = runFixture(poorSleepGauntletFixture);

    assertBattleTestedShape(output);
    expect(output.readiness_status.status).toBe("red");
    expect(output.daily_recommendation.recommended_activity.activity_type).toBe(
      "walk",
    );
    expect(
      output.daily_recommendation.recommended_activity.intensity_target,
    ).toBe("recovery");
    expect(output.daily_recommendation.what_to_avoid_today).toEqual(
      expect.arrayContaining(["hard intervals", "max-effort testing"]),
    );
  });

  it("allows normal training only when current data and context support it", () => {
    const output = runFixture(highReadinessGauntletFixture);

    assertBattleTestedShape(output);
    expect(output.readiness_status.status).toBe("green");
    expect(output.daily_recommendation.recommended_activity.activity_type).toBe(
      "run",
    );
    expect(
      output.daily_recommendation.recommended_activity.intensity_target,
    ).toBe("easy");
    expect(output.daily_recommendation.sources_used).toEqual(
      expect.arrayContaining(["sleep", "workouts", "hrv", "resting_hr"]),
    );
    expect(output.daily_recommendation.confidence).toBeGreaterThanOrEqual(0.7);
  });

  it("does not treat ordinary wording as an illness signal", () => {
    const output = runFixture({
      ...highReadinessGauntletFixture,
      userMessage: "I will train easy today and feel good.",
    });

    assertBattleTestedShape(output);
    expect(output.risk_flags.highest_severity).toBe("none");
    expect(output.daily_recommendation.risk_flags_applied).toBe(false);
    expect(output.readiness_status.status).toBe("green");
  });

  it("starts returning athletes with baseline work even when they ask for an event plan", () => {
    const output = runFixture(returningAthleteGauntletFixture);

    assertBattleTestedShape(output);
    expect(output.goal_profile.primary_goal).toBe("return_to_training");
    expect(output.readiness_status.status).toBe("yellow");
    expect(output.daily_recommendation.recommended_activity.activity_type).toBe(
      "walk",
    );
    expect(
      output.daily_recommendation.recommended_activity.intensity_target,
    ).toBe("easy");
    expect(output.daily_recommendation.what_to_avoid_today).toEqual(
      expect.arrayContaining(["hard intervals", "large volume jumps"]),
    );
  });

  it.each(riskGauntletFixtures)(
    "applies conservative overrides for $name",
    ({ userMessage, snapshot }) => {
      const output = runFixture({ userMessage, snapshot });

      assertBattleTestedShape(output);
      expect(output.risk_flags.highest_severity).not.toBe("none");
      expect(output.risk_flags.items.length).toBeGreaterThan(0);
      expect(output.daily_recommendation.risk_flags_applied).toBe(true);
      expect(output.readiness_status.status).toBe("red");
      expect(["rest", "walk", "mobility"]).toContain(
        output.daily_recommendation.recommended_activity.activity_type,
      );
      expect(
        output.daily_recommendation.recommended_activity.intensity_target,
      ).toBe("recovery");
      expect(output.daily_recommendation.confidence).toBeLessThanOrEqual(0.45);
    },
  );
});
