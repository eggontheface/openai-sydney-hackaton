import type {
  CoachRecommendationActivity,
  SourceFreshness,
  WorkoutRecord,
} from "../health/types";
import { buildDailyRecommendationFields } from "./dailyRecommendation";
import { buildReadinessStatus } from "./readinessStatus";
import type { ReadinessStatusContract } from "./readinessStatus";
import { extractRiskFlags } from "./riskFlags";
import type { RiskFlagSource, RiskFlags } from "./schemas";
import { classifyTrainingState } from "./trainingState";
import type { TrainingStateClassification } from "./trainingState";

import eventGoal from "./fixtures/recommendations/event-goal.json";
import highReadiness from "./fixtures/recommendations/high-readiness.json";
import illnessFlag from "./fixtures/recommendations/illness-flag.json";
import noData from "./fixtures/recommendations/no-data.json";
import painFlag from "./fixtures/recommendations/pain-flag.json";
import poorSleep from "./fixtures/recommendations/poor-sleep.json";
import returningAthlete from "./fixtures/recommendations/returning-athlete.json";
import staleData from "./fixtures/recommendations/stale-data.json";

type FixtureCheckIn = {
  source: RiskFlagSource;
  text: string;
};

type FixtureWorkout = {
  daysAgo: number;
  sportBucket: WorkoutRecord["sportBucket"];
  elapsedMinutes: number;
};

type FixtureRecommendationSeed = {
  title: string;
  detail: string;
  reason: string;
};

type FixtureEvent = {
  name: string;
  date: string;
  type: string;
  distance: string;
};

type FixtureSourceFreshness = Pick<
  SourceFreshness,
  "domain" | "label" | "state" | "canonicalTypes"
> &
  Partial<
    Pick<
      SourceFreshness,
      | "sampleCount"
      | "dayCount"
      | "latestLocalDate"
      | "lastUpdatedAt"
      | "ageDays"
      | "limitations"
    >
  >;

export type RecommendationFixtureCase = {
  id: string;
  name: string;
  asOfDate: string;
  generatedAt: string;
  readinessScore: number | null;
  readinessSignals: string[];
  sourceFreshness: FixtureSourceFreshness[];
  checkIns: FixtureCheckIn[];
  workouts: FixtureWorkout[];
  event?: FixtureEvent;
  recommendation: FixtureRecommendationSeed;
};

type NormalizedRecommendationFixtureCase = Omit<
  RecommendationFixtureCase,
  "sourceFreshness"
> & {
  sourceFreshness: SourceFreshness[];
};

export type RecommendationFixtureOutput = {
  fixtureId: string;
  fixtureName: string;
  asOfDate: string;
  readiness: {
    status: ReadinessStatusContract["status"];
    confidence: number;
    score: number | null;
    signalsUsed: string[];
    staleSignalsIgnored: string[];
    missingSignals: string[];
    conservativeAdjustmentReason: string | null;
  };
  trainingState: Pick<
    TrainingStateClassification,
    | "state"
    | "confidence"
    | "recommendedBehavior"
    | "baselineBuildingRecommended"
    | "activeDaysLast30"
    | "totalWorkoutMinutesLast30"
    | "longestGapDays"
    | "signalsUsed"
  >;
  riskFlags: {
    highestSeverity: RiskFlags["highest_severity"];
    hasBlockingRisk: boolean;
    summary: string;
    itemIds: string[];
  };
  recommendation: {
    readinessStatus: ReadinessStatusContract["status"];
    shortExplanation: string;
    recommendedActivity: CoachRecommendationActivity;
    easierAlternative: CoachRecommendationActivity;
    whatToAvoidToday: string[];
    confidence: number;
    sourcesUsed: string[];
    sourcesIgnored: string[];
    nextCheckInQuestion: string;
  };
};

const fixtureCases = [
  noData,
  staleData,
  poorSleep,
  highReadiness,
  painFlag,
  illnessFlag,
  returningAthlete,
  eventGoal,
] as unknown as RecommendationFixtureCase[];

function parseLocalDate(date: string): Date {
  return new Date(`${date}T12:00:00.000Z`);
}

function dateDaysAgo(asOfDate: string, daysAgo: number): string {
  const date = parseLocalDate(asOfDate);
  date.setUTCDate(date.getUTCDate() - daysAgo);
  return date.toISOString().slice(0, 10);
}

function fixtureWorkout(
  fixture: NormalizedRecommendationFixtureCase,
  workout: FixtureWorkout,
  index: number,
): WorkoutRecord {
  const localDate = dateDaysAgo(fixture.asOfDate, workout.daysAgo);

  return {
    workoutId: `${fixture.id}-workout-${index + 1}`,
    platform: "health_connect",
    startAt: `${localDate}T08:00:00.000Z`,
    endAt: `${localDate}T09:00:00.000Z`,
    localDate,
    sportBucket: workout.sportBucket,
    elapsedSeconds: workout.elapsedMinutes * 60,
    rawJson: "{}",
  };
}

function riskFlagsFor(fixture: RecommendationFixtureCase): RiskFlags {
  return extractRiskFlags(
    fixture.checkIns.map((checkIn) => ({
      source: checkIn.source,
      text: checkIn.text,
      label: fixture.name,
    })),
    { generatedAt: fixture.generatedAt },
  );
}

function riskAdjustedReadiness(
  readiness: ReadinessStatusContract,
  riskFlags: RiskFlags,
): ReadinessStatusContract {
  if (!riskFlags.has_blocking_risk) {
    return readiness;
  }

  const reason =
    "Pain or illness risk flags were applied before recommendation output, so intensity stays recovery-only.";

  return {
    ...readiness,
    status: "red",
    confidence: Math.min(readiness.confidence, 0.35),
    conservativeAdjustmentReason: reason,
    ui: {
      ...readiness.ui,
      label: "Red",
      color: "warm",
      title: "Recovery priority",
      detail: "Keep training easy and avoid intensity.",
      reason,
      opener: "Risk flags are present, so today stays recovery-only.",
    },
  };
}

function recommendationContextSignals(
  fixture: NormalizedRecommendationFixtureCase,
  trainingState: TrainingStateClassification,
): string[] {
  const contextSignals: string[] = [];

  if (trainingState.recommendedBehavior === "baseline_building") {
    contextSignals.push(trainingState.explanation);
  }

  if (fixture.event) {
    contextSignals.push(
      `Event goal: ${fixture.event.name} ${fixture.event.distance} on ${fixture.event.date}`,
    );
  }

  return contextSignals;
}

function safetySources(
  readiness: ReadinessStatusContract,
  riskFlags: RiskFlags,
  contextSignals: string[],
): string[] {
  const sources = [...readiness.signalsUsed, ...contextSignals];

  if (riskFlags.has_blocking_risk) {
    sources.push("risk flags");
  }

  return Array.from(new Set(sources));
}

export function loadRecommendationFixtureCases(): RecommendationFixtureCase[] {
  return fixtureCases.map((fixture) => ({
    ...fixture,
    checkIns: [...fixture.checkIns],
    workouts: [...fixture.workouts],
    readinessSignals: [...fixture.readinessSignals],
    sourceFreshness: fixture.sourceFreshness.map((source) => ({ ...source })),
  }));
}

function normalizeFixture(
  fixture: RecommendationFixtureCase,
): NormalizedRecommendationFixtureCase {
  return {
    ...fixture,
    sourceFreshness: fixture.sourceFreshness.map((source) => ({
      ...source,
      sampleCount: source.sampleCount ?? (source.state === "missing" ? 0 : 1),
      dayCount: source.dayCount ?? (source.state === "missing" ? 0 : 1),
      limitations: source.limitations ?? [],
    })),
  };
}

export function runRecommendationFixture(
  fixtureId: string,
): RecommendationFixtureOutput {
  const rawFixture = loadRecommendationFixtureCases().find(
    (candidate) => candidate.id === fixtureId,
  );

  if (!rawFixture) {
    throw new Error(`Unknown recommendation fixture: ${fixtureId}`);
  }

  const fixture = normalizeFixture(rawFixture);
  const riskFlags = riskFlagsFor(fixture);
  const workouts = fixture.workouts.map((workout, index) =>
    fixtureWorkout(fixture, workout, index),
  );
  const trainingState = classifyTrainingState({
    asOfDate: fixture.asOfDate,
    workouts,
    checkIns: fixture.checkIns,
    riskFlags: riskFlags.has_blocking_risk ? riskFlags : null,
  });
  const readiness = buildReadinessStatus({
    score: fixture.readinessScore,
    signalsUsed: fixture.readinessSignals,
    sourceFreshness: fixture.sourceFreshness,
  });
  const adjustedReadiness = riskAdjustedReadiness(readiness, riskFlags);
  const contextSignals = recommendationContextSignals(fixture, trainingState);
  const recommendation = buildDailyRecommendationFields({
    readinessStatus: adjustedReadiness,
    title: fixture.recommendation.title,
    detail: fixture.recommendation.detail,
    reason: fixture.recommendation.reason,
    readinessSignals: safetySources(
      adjustedReadiness,
      riskFlags,
      contextSignals,
    ),
  });

  return {
    fixtureId: fixture.id,
    fixtureName: fixture.name,
    asOfDate: fixture.asOfDate,
    readiness: {
      status: adjustedReadiness.status,
      confidence: adjustedReadiness.confidence,
      score: adjustedReadiness.score,
      signalsUsed: adjustedReadiness.signalsUsed,
      staleSignalsIgnored: adjustedReadiness.staleSignalsIgnored,
      missingSignals: adjustedReadiness.missingSignals,
      conservativeAdjustmentReason:
        adjustedReadiness.conservativeAdjustmentReason,
    },
    trainingState: {
      state: trainingState.state,
      confidence: trainingState.confidence,
      recommendedBehavior: trainingState.recommendedBehavior,
      baselineBuildingRecommended: trainingState.baselineBuildingRecommended,
      activeDaysLast30: trainingState.activeDaysLast30,
      totalWorkoutMinutesLast30: trainingState.totalWorkoutMinutesLast30,
      longestGapDays: trainingState.longestGapDays,
      signalsUsed: trainingState.signalsUsed,
    },
    riskFlags: {
      highestSeverity: riskFlags.highest_severity,
      hasBlockingRisk: riskFlags.has_blocking_risk,
      summary: riskFlags.summary,
      itemIds: riskFlags.items.map((item) => item.id),
    },
    recommendation: {
      readinessStatus: adjustedReadiness.status,
      shortExplanation: recommendation.shortExplanation,
      recommendedActivity: recommendation.recommendedActivity,
      easierAlternative: recommendation.easierAlternative,
      whatToAvoidToday: recommendation.whatToAvoidToday,
      confidence: recommendation.confidence,
      sourcesUsed: recommendation.sourcesUsed,
      sourcesIgnored: recommendation.sourcesIgnored,
      nextCheckInQuestion: recommendation.checkInQuestion,
    },
  };
}

export function runRecommendationFixtures(): RecommendationFixtureOutput[] {
  return loadRecommendationFixtureCases().map((fixture) =>
    runRecommendationFixture(fixture.id),
  );
}
