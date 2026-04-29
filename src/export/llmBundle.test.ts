import { completeCoachRecommendation } from "../coach/dailyRecommendation";
import { buildReadinessStatus } from "../coach/readinessStatus";
import { buildTrainingLoadSnapshot } from "../coach/trainingLoad";
import { normalizeGoalProfile } from "../goals/goalProfile";
import type { PipelineSnapshot } from "../health/types";
import { buildLlmBundle } from "./llmBundle";

function snapshot(): PipelineSnapshot {
  const readinessStatus = buildReadinessStatus({
    score: 82,
    signalsUsed: ["sleep", "recent activity"],
    sourceFreshness: [],
  });

  return {
    totalSamples: 480,
    workoutCount: 3,
    sleepCount: 4,
    nutritionDays: 2,
    coverageDays: 7,
    metricAvailability: [
      {
        canonicalType: "steps",
        sampleCount: 7,
        dayCount: 7,
        latestDate: "2026-04-28",
      },
      {
        canonicalType: "sleep_session",
        sampleCount: 4,
        dayCount: 4,
        latestDate: "2026-04-28",
      },
    ],
    sourceFreshness: [
      {
        domain: "sleep",
        label: "Sleep",
        state: "fresh",
        canonicalTypes: ["sleep_session"],
        sampleCount: 4,
        dayCount: 4,
        earliestLocalDate: "2026-04-20",
        latestLocalDate: "2026-04-28",
        lastUpdatedAt: "2026-04-29T03:30:00.000Z",
        ageDays: 1,
        limitations: [],
      },
      {
        domain: "nutrition",
        label: "Nutrition",
        state: "stale",
        canonicalTypes: ["nutrition"],
        sampleCount: 2,
        dayCount: 2,
        latestLocalDate: "2026-04-24",
        lastUpdatedAt: "2026-04-24T08:15:00.000Z",
        ageDays: 5,
        limitations: ["Nutrition has not synced recently."],
      },
    ],
    latestDiagnostics: [],
    today: {
      date: "2026-04-29",
      dataCompleteness: "partial",
      wellnessDataStatus: "usable",
      sourceCount: 3,
      hasPlatformWellness: true,
      hasActivity: true,
      hasNutrition: false,
      hasSleep: true,
      hasSteps: true,
      hasEnergy: true,
      steps: 8200,
      sleepSeconds: 27000,
      restingHr: 52,
      workoutCount: 1,
      generatedAt: "2026-04-29T04:00:00.000Z",
    },
    history: [
      {
        date: "2026-04-28",
        dataCompleteness: "full",
        wellnessDataStatus: "complete",
        sourceCount: 4,
        hasPlatformWellness: true,
        hasActivity: true,
        hasNutrition: true,
        hasSleep: true,
        hasSteps: true,
        hasEnergy: true,
        steps: 9400,
        sleepSeconds: 28800,
        restingHr: 51,
        workoutCount: 1,
        generatedAt: "2026-04-28T04:00:00.000Z",
      },
    ],
    recentWorkouts: [
      {
        workoutId: "workout-1",
        platform: "health_connect",
        startAt: "2026-04-28T20:00:00.000Z",
        endAt: "2026-04-28T20:45:00.000Z",
        localDate: "2026-04-29",
        sportBucket: "run",
        elapsedSeconds: 2700,
        rawJson: JSON.stringify({ large: "raw workout payload".repeat(200) }),
      },
    ],
    recentSamples: [
      {
        sampleId: "sample-1",
        platform: "health_connect",
        recordType: "Steps",
        canonicalType: "steps",
        startAt: "2026-04-28T00:00:00.000Z",
        endAt: "2026-04-28T23:59:59.000Z",
        localDate: "2026-04-28",
        value: 9400,
        unit: "count",
        metadataJson: JSON.stringify({
          large: "raw sample metadata".repeat(200),
        }),
      },
    ],
    todayCheckIn: null,
    checkInHistory: [],
    trainingLoad: buildTrainingLoadSnapshot(),
    recommendation: completeCoachRecommendation({
      readiness: 82,
      readinessStatus,
      readinessLabel: "Ready",
      color: "positive",
      title: "Quality aerobic day",
      detail: "45 min easy run",
      reason: "Sleep and activity are current enough for a normal plan.",
      opener: "You are ready for controlled work.",
      strain: 9,
      strainTarget: "8-11",
    }),
  };
}

describe("buildLlmBundle", () => {
  it("builds the source-aware llm_bundle schema without raw records", () => {
    const bundle = buildLlmBundle(snapshot(), {
      exportedAt: "2026-04-29T05:00:00.000Z",
      goalProfile: normalizeGoalProfile(
        {
          primaryGoal: "event_preparation",
          secondaryGoals: ["endurance"],
          motivation: "Run a half marathon well.",
          timeframe: "12 weeks",
          experienceLevel: "recreational",
          preferredActivities: ["run", "strength"],
          constraints: ["weekday mornings only"],
          riskFlags: ["significant pain"],
          coachingStyle: "direct",
          startingStrategy: "event_phases",
          confidence: 0.8,
        },
        "2026-04-20T00:00:00.000Z",
      ),
    });

    expect(bundle.schema).toBe("biostream_llm_bundle.v1");
    expect(bundle.exportedAt).toBe("2026-04-29T05:00:00.000Z");
    expect(bundle.currentState).toMatchObject({
      date: "2026-04-29",
      readiness: {
        score: 82,
        status: "green",
      },
      today: {
        dataCompleteness: "partial",
        steps: 8200,
        sleepSeconds: 27000,
      },
      trainingLoad: {
        training_load_status: "unavailable",
      },
    });
    expect(bundle.goalProfile?.primaryGoal).toBe("event_preparation");
    expect(bundle.eventProfile).toMatchObject({
      eventIntent: true,
      timeframe: "12 weeks",
      confidence: 0.8,
    });
    expect(bundle.dailyCheckIn.currentCheckIn).toBeNull();
    expect(bundle.dailyCheckIn.checkInHistory).toEqual([]);
    expect(bundle.sourceFreshness[0]).toMatchObject({
      name: "Sleep",
      dateRange: { start: "2026-04-20", end: "2026-04-28" },
      lastUpdatedAt: "2026-04-29T03:30:00.000Z",
      confidenceOrCompleteness: "fresh",
      staleness: { state: "fresh", ageDays: 1 },
      recommendationUsability: "usable",
      limitations: [],
    });
    expect(bundle.riskFlags.items[0]).toMatchObject({
      source: "goal_profile",
      severity: "high",
    });
    expect(bundle.dataLimitations).toEqual(
      expect.arrayContaining([
        "Raw health samples, raw workouts, route streams, laps, and metadata JSON are intentionally excluded from this LLM bundle.",
        "Nutrition has not synced recently.",
      ]),
    );
    expect(JSON.stringify(bundle)).not.toContain("rawJson");
    expect(JSON.stringify(bundle)).not.toContain("metadataJson");
  });

  it("exports only allowlisted daily check-in fields", () => {
    const bundle = buildLlmBundle(snapshot(), {
      exportedAt: "2026-04-29T05:00:00.000Z",
      currentCheckIn: {
        localDate: "2026-04-29",
        sleepQuality: 4,
        soreness: 2,
        energy: 3,
        pain: "moderate",
        availableTimeMinutes: 45,
        preferredActivity: "mobility",
        completedYesterday: false,
        source: "user_reported",
        createdAt: "2026-04-29T04:00:00.000Z",
        updatedAt: "2026-04-29T04:30:00.000Z",
        date: "2026-04-29",
        checkedInAt: "2026-04-29T04:30:00.000Z",
        mood: "Sharp pain words should not leak",
        stress: "fever words should not leak",
        fatigue: "faint words should not leak",
        illness: "illness words should not leak",
        constraints: ["chest pain words should not leak"],
        readiness: "red flag words should not leak",
        rawRecords: [{ private: true }],
        metadataJson: '{"leak":true}',
        nestedRawPayload: { symptomSurvey: "sharp pain should not leak" },
      },
      checkInHistory: [
        {
          localDate: "2026-04-28",
          sleepQuality: 3,
          soreness: 3,
          energy: 5,
          pain: "none",
          availableTimeMinutes: 30,
          preferredActivity: "easy_cardio",
          completedYesterday: true,
          source: "user_reported",
          internalId: "checkin-raw-1",
        },
      ],
    });

    expect(bundle.dailyCheckIn.currentCheckIn).toEqual({
      localDate: "2026-04-29",
      sleepQuality: 4,
      soreness: 2,
      energy: 3,
      pain: "moderate",
      availableTimeMinutes: 45,
      preferredActivity: "mobility",
      completedYesterday: false,
      source: "user_reported",
      createdAt: "2026-04-29T04:00:00.000Z",
      updatedAt: "2026-04-29T04:30:00.000Z",
    });
    expect(bundle.dailyCheckIn.checkInHistory).toEqual([
      {
        localDate: "2026-04-28",
        sleepQuality: 3,
        soreness: 3,
        energy: 5,
        pain: "none",
        availableTimeMinutes: 30,
        preferredActivity: "easy_cardio",
        completedYesterday: true,
        source: "user_reported",
      },
    ]);
    expect(bundle.riskFlags.highest_severity).toBe("none");
    expect(JSON.stringify(bundle.dailyCheckIn)).not.toContain("rawRecords");
    expect(JSON.stringify(bundle.dailyCheckIn)).not.toContain("metadataJson");
    expect(JSON.stringify(bundle.dailyCheckIn)).not.toContain("internalId");
    expect(JSON.stringify(bundle.dailyCheckIn)).not.toContain("checkedInAt");
    expect(JSON.stringify(bundle.dailyCheckIn)).not.toContain("mood");
    expect(JSON.stringify(bundle.dailyCheckIn)).not.toContain("constraints");
    expect(JSON.stringify(bundle.dailyCheckIn)).not.toContain("readiness");
    expect(JSON.stringify(bundle.dailyCheckIn)).not.toContain(
      "nestedRawPayload",
    );
    expect(JSON.stringify(bundle.riskFlags)).not.toContain("sharp pain");
    expect(JSON.stringify(bundle.riskFlags)).not.toContain("chest pain");
  });

  it("keeps the llm bundle smaller than a full raw export payload", () => {
    const fullRawExport = {
      schema: "biostream_training_pipeline.v5",
      exportedAt: "2026-04-29T05:00:00.000Z",
      samples: snapshot().recentSamples,
      workouts: snapshot().recentWorkouts,
      dailyMetrics: [snapshot().today, ...snapshot().history],
      sourceFreshness: snapshot().sourceFreshness,
      trainingLoad: snapshot().trainingLoad,
      recommendation: snapshot().recommendation,
    };

    const bundle = buildLlmBundle(snapshot(), {
      exportedAt: "2026-04-29T05:00:00.000Z",
    });

    expect(JSON.stringify(bundle).length).toBeLessThan(
      JSON.stringify(fullRawExport).length,
    );
  });
});
