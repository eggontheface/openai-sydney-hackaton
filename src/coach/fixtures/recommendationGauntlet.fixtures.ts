import type {
  DailyMetrics,
  PipelineSnapshot,
  SourceFreshness,
  SourceFreshnessDomain,
  SourceFreshnessState,
  WorkoutRecord,
} from "../../health/types";
import type { GoalProfile } from "../schemas";
import { buildTrainingLoadSnapshot } from "../trainingLoad";

export type RecommendationGauntletFixture = {
  name: string;
  userMessage: string;
  goalProfile?: Partial<GoalProfile>;
  snapshot: PipelineSnapshot;
};

const generatedAt = "2026-04-29T12:00:00.000Z";
const today = "2026-04-29";

function sourceFreshness(
  domain: SourceFreshnessDomain,
  state: SourceFreshnessState,
  ageDays = state === "fresh" ? 0 : 9,
): SourceFreshness {
  return {
    domain,
    label: domain.replace(/_/g, " "),
    state,
    canonicalTypes:
      domain === "sleep"
        ? ["sleep_session"]
        : domain === "workouts"
          ? ["workout"]
          : domain === "hrv"
            ? ["hrv_rmssd"]
            : domain === "resting_hr"
              ? ["resting_heart_rate"]
              : [],
    sampleCount: state === "missing" ? 0 : 7,
    dayCount: state === "missing" ? 0 : 7,
    latestLocalDate: state === "missing" ? undefined : today,
    lastUpdatedAt: state === "missing" ? undefined : generatedAt,
    ageDays,
    limitations: state === "fresh" ? [] : [`${domain} is ${state}`],
  };
}

function dailyMetrics(overrides: Partial<DailyMetrics> = {}): DailyMetrics {
  return {
    date: today,
    dataCompleteness: "full",
    wellnessDataStatus: "Fresh wearable data",
    sourceCount: 4,
    hasPlatformWellness: true,
    hasActivity: true,
    hasNutrition: false,
    hasSleep: true,
    hasSteps: true,
    hasEnergy: true,
    steps: 8200,
    activeKcal: 510,
    sleepSeconds: 7.5 * 60 * 60,
    restingHr: 52,
    heartRateAvgBpm: 73,
    hrvLastNightAvg: 58,
    hrvMethod: "rmssd",
    hrvCanonicalType: "hrv_rmssd",
    hrvSampleCount: 4,
    workoutCount: 1,
    activityElapsedSeconds: 42 * 60,
    generatedAt,
    ...overrides,
  };
}

function workout(overrides: Partial<WorkoutRecord> = {}): WorkoutRecord {
  return {
    workoutId: `workout-${overrides.localDate ?? today}`,
    platform: "health_connect",
    sourceApp: "Fixture Wearable",
    startAt: `${overrides.localDate ?? today}T07:00:00.000Z`,
    endAt: `${overrides.localDate ?? today}T07:42:00.000Z`,
    localDate: overrides.localDate ?? today,
    name: "Easy run",
    activityType: "Running",
    sportBucket: "run",
    elapsedSeconds: 42 * 60,
    distanceKm: 6.5,
    avgHrBpm: 142,
    rawJson: "{}",
    ...overrides,
  };
}

function snapshot(overrides: Partial<PipelineSnapshot> = {}): PipelineSnapshot {
  return {
    totalSamples: 120,
    workoutCount: 6,
    sleepCount: 7,
    nutritionDays: 0,
    coverageDays: 7,
    metricAvailability: [
      {
        canonicalType: "sleep_session",
        sampleCount: 7,
        dayCount: 7,
        latestDate: today,
      },
      {
        canonicalType: "resting_heart_rate",
        sampleCount: 7,
        dayCount: 7,
        latestDate: today,
      },
      {
        canonicalType: "hrv_rmssd",
        sampleCount: 7,
        dayCount: 7,
        latestDate: today,
      },
      {
        canonicalType: "workout",
        sampleCount: 6,
        dayCount: 6,
        latestDate: today,
      },
    ],
    sourceFreshness: [
      sourceFreshness("sleep", "fresh"),
      sourceFreshness("workouts", "fresh"),
      sourceFreshness("hrv", "fresh"),
      sourceFreshness("resting_hr", "fresh"),
      sourceFreshness("check_ins", "missing"),
    ],
    latestDiagnostics: [],
    today: dailyMetrics(),
    history: [
      dailyMetrics(),
      dailyMetrics({ date: "2026-04-28" }),
      dailyMetrics({ date: "2026-04-27" }),
      dailyMetrics({ date: "2026-04-26" }),
      dailyMetrics({ date: "2026-04-25" }),
      dailyMetrics({ date: "2026-04-24" }),
      dailyMetrics({ date: "2026-04-23" }),
    ],
    recentWorkouts: [
      workout(),
      workout({ localDate: "2026-04-27" }),
      workout({ localDate: "2026-04-25" }),
    ],
    recentSamples: [],
    trainingLoad: buildTrainingLoadSnapshot(),
    recommendation: {
      readiness: 82,
      readinessLabel: "Ready",
      color: "positive",
      title: "Build",
      detail: "Good recovery picture.",
      reason: "Sleep, resting heart rate, and recent workouts look usable.",
      opener: "Keep building.",
      strain: 58,
      strainTarget: "Moderate",
    },
    ...overrides,
  };
}

export const noDataGauntletFixture: RecommendationGauntletFixture = {
  name: "no data keeps readiness unknown",
  userMessage: "What should I do today?",
  snapshot: snapshot({
    totalSamples: 0,
    workoutCount: 0,
    sleepCount: 0,
    coverageDays: 0,
    metricAvailability: [],
    sourceFreshness: [
      sourceFreshness("sleep", "missing"),
      sourceFreshness("workouts", "missing"),
      sourceFreshness("hrv", "missing"),
      sourceFreshness("resting_hr", "missing"),
      sourceFreshness("check_ins", "missing"),
    ],
    today: null,
    history: [],
    recentWorkouts: [],
    recommendation: {
      readiness: null,
      readinessLabel: "Connect",
      color: "neutral",
      title: "Sync Health Connect",
      detail: "Import data to build a baseline.",
      reason: "No platform data is available yet.",
      opener: "Connect Health Connect and run a sync.",
      strain: 0,
      strainTarget: "-",
    },
  }),
};

export const staleDataGauntletFixture: RecommendationGauntletFixture = {
  name: "stale data is ignored instead of treated as green",
  userMessage: "Can I push hard today?",
  snapshot: snapshot({
    sourceFreshness: [
      sourceFreshness("sleep", "stale", 11),
      sourceFreshness("workouts", "stale", 12),
      sourceFreshness("hrv", "stale", 10),
      sourceFreshness("resting_hr", "stale", 10),
      sourceFreshness("check_ins", "missing"),
    ],
    recommendation: {
      readiness: 91,
      readinessLabel: "Ready",
      color: "positive",
      title: "High readiness",
      detail: "Old wearable data looked strong.",
      reason: "Stale wearable data should not prove current readiness.",
      opener: "Check freshness.",
      strain: 80,
      strainTarget: "High",
    },
  }),
};

export const poorSleepGauntletFixture: RecommendationGauntletFixture = {
  name: "poor sleep downshifts the recommendation",
  userMessage: "What should I do today?",
  snapshot: snapshot({
    today: dailyMetrics({
      dataCompleteness: "partial",
      wellnessDataStatus: "Poor sleep",
      sleepSeconds: 3.8 * 60 * 60,
      restingHr: 64,
      hrvLastNightAvg: 31,
    }),
    recommendation: {
      readiness: 42,
      readinessLabel: "Low",
      color: "cool",
      title: "Recover",
      detail: "Sleep was short and recovery is low.",
      reason: "Poor sleep lowers readiness.",
      opener: "Take the easy option.",
      strain: 25,
      strainTarget: "Low",
    },
  }),
};

export const highReadinessGauntletFixture: RecommendationGauntletFixture = {
  name: "high readiness can keep normal training",
  userMessage: "I feel good and want the normal plan.",
  snapshot: snapshot(),
};

export const returningAthleteGauntletFixture: RecommendationGauntletFixture = {
  name: "returning after a long break starts with baseline work",
  userMessage: "I am coming back after a year off and want to train for a 10K.",
  goalProfile: {
    primary_goal: "return_to_training",
    experience_level: "returning",
    constraints: ["long training gap"],
  },
  snapshot: snapshot({
    workoutCount: 0,
    recentWorkouts: [],
  }),
};

export const riskGauntletFixtures: RecommendationGauntletFixture[] = [
  {
    name: "knee pain",
    userMessage: "My knee hurts when I run today.",
    snapshot: snapshot(),
  },
  {
    name: "fever",
    userMessage: "I have a fever but still want to train.",
    snapshot: snapshot(),
  },
  {
    name: "chest pain",
    userMessage: "I had chest pain on stairs this morning.",
    snapshot: snapshot(),
  },
  {
    name: "fainting",
    userMessage: "I fainted yesterday but feel okay now.",
    snapshot: snapshot(),
  },
  {
    name: "unusual shortness of breath",
    userMessage: "I have unusual shortness of breath walking around.",
    snapshot: snapshot(),
  },
];
