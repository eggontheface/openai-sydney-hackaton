import { extractRiskFlagsFromCoachRequest } from "../coach/riskFlags";
import type { RiskFlags } from "../coach/schemas";
import { toTrainingLoadExport } from "../coach/trainingLoad";
import type { GoalProfile } from "../goals/goalProfile";
import type {
  CoachRecommendation,
  DailyMetrics,
  PipelineSnapshot,
  SourceFreshness,
} from "../health/types";

export type LlmBundleSource = {
  name: string;
  domain: SourceFreshness["domain"];
  canonicalTypes: SourceFreshness["canonicalTypes"];
  dateRange: {
    start: string | null;
    end: string | null;
  };
  lastUpdatedAt: string | null;
  confidenceOrCompleteness: string;
  staleness: {
    state: SourceFreshness["state"];
    ageDays: number | null;
  };
  recommendationUsability: "usable" | "limited" | "unusable";
  limitations: string[];
};

export type LlmBundleOptions = {
  exportedAt?: string | Date;
  goalProfile?: GoalProfile | null;
  riskFlags?: RiskFlags | null;
  currentCheckIn?: unknown | null;
  checkInHistory?: unknown[];
};

export type LlmBundle = {
  schema: "biostream_llm_bundle.v1";
  exportedAt: string;
  currentState: {
    date: string | null;
    readiness: {
      score: number | null;
      status: CoachRecommendation["readinessStatus"]["status"];
      confidence: number;
      summary: string;
      signalsUsed: string[];
      missingSignals: string[];
      staleSignalsIgnored: string[];
    };
    today: Partial<DailyMetrics> | null;
    recommendation: Pick<
      CoachRecommendation,
      | "title"
      | "detail"
      | "reason"
      | "shortExplanation"
      | "recommendedActivity"
      | "easierAlternative"
      | "whatToAvoidToday"
      | "confidence"
      | "sourcesUsed"
      | "sourcesIgnored"
      | "checkInQuestion"
    >;
    trainingLoad: ReturnType<typeof toTrainingLoadExport>;
  };
  recentHistory: Array<Partial<DailyMetrics>>;
  goalProfile: GoalProfile | null;
  eventProfile: {
    eventIntent: boolean;
    timeframe: string | null;
    preferredActivities: string[];
    constraints: string[];
    confidence: number;
  };
  dailyCheckIn: {
    currentCheckIn: unknown | null;
    checkInHistory: unknown[];
  };
  sourceFreshness: LlmBundleSource[];
  riskFlags: RiskFlags;
  dataLimitations: string[];
};

function isoString(value: string | Date | undefined): string {
  if (value instanceof Date) {
    return value.toISOString();
  }

  return value ?? new Date().toISOString();
}

function recommendationUsability(
  source: SourceFreshness,
): LlmBundleSource["recommendationUsability"] {
  if (source.state === "fresh") return "usable";
  if (source.state === "partial") return "limited";
  return "unusable";
}

function toBundleSource(source: SourceFreshness): LlmBundleSource {
  return {
    name: source.label,
    domain: source.domain,
    canonicalTypes: source.canonicalTypes,
    dateRange: {
      start: source.latestLocalDate ?? null,
      end: source.latestLocalDate ?? null,
    },
    lastUpdatedAt: source.lastUpdatedAt ?? null,
    confidenceOrCompleteness: source.state,
    staleness: {
      state: source.state,
      ageDays: source.ageDays ?? null,
    },
    recommendationUsability: recommendationUsability(source),
    limitations: source.limitations,
  };
}

function compactDailyMetrics(row: DailyMetrics): Partial<DailyMetrics> {
  return {
    date: row.date,
    dataCompleteness: row.dataCompleteness,
    wellnessDataStatus: row.wellnessDataStatus,
    sourceCount: row.sourceCount,
    hasActivity: row.hasActivity,
    hasNutrition: row.hasNutrition,
    hasSleep: row.hasSleep,
    hasSteps: row.hasSteps,
    hasEnergy: row.hasEnergy,
    steps: row.steps,
    activeKcal: row.activeKcal,
    totalKcal: row.totalKcal,
    distanceKm: row.distanceKm,
    sleepSeconds: row.sleepSeconds,
    sleepEfficiency: row.sleepEfficiency,
    restingHr: row.restingHr,
    hrvLastNightAvg: row.hrvLastNightAvg,
    workoutCount: row.workoutCount,
    activityElapsedSeconds: row.activityElapsedSeconds,
    kcalIn: row.kcalIn,
    proteinG: row.proteinG,
    waterMl: row.waterMl,
    generatedAt: row.generatedAt,
  };
}

function dataLimitations(snapshot: PipelineSnapshot): string[] {
  return [
    "Raw health samples, raw workouts, route streams, laps, and metadata JSON are intentionally excluded from this LLM bundle.",
    ...snapshot.sourceFreshness.flatMap((source) => source.limitations),
    ...snapshot.trainingLoad.limitations,
  ];
}

export function buildLlmBundle(
  snapshot: PipelineSnapshot,
  options: LlmBundleOptions = {},
): LlmBundle {
  const exportedAt = isoString(options.exportedAt);
  const goalProfile = options.goalProfile ?? null;
  const readiness = snapshot.recommendation.readinessStatus;
  const riskFlags =
    options.riskFlags ??
    extractRiskFlagsFromCoachRequest({
      generated_at: exportedAt,
      goal_profile: goalProfile ?? undefined,
      daily_check_in: options.currentCheckIn ?? undefined,
    });

  return {
    schema: "biostream_llm_bundle.v1",
    exportedAt,
    currentState: {
      date: snapshot.today?.date ?? null,
      readiness: {
        score: snapshot.recommendation.readiness,
        status: readiness.status,
        confidence: readiness.confidence,
        summary: readiness.ui.reason,
        signalsUsed: readiness.signalsUsed,
        missingSignals: readiness.missingSignals,
        staleSignalsIgnored: readiness.staleSignalsIgnored,
      },
      today: snapshot.today ? compactDailyMetrics(snapshot.today) : null,
      recommendation: {
        title: snapshot.recommendation.title,
        detail: snapshot.recommendation.detail,
        reason: snapshot.recommendation.reason,
        shortExplanation: snapshot.recommendation.shortExplanation,
        recommendedActivity: snapshot.recommendation.recommendedActivity,
        easierAlternative: snapshot.recommendation.easierAlternative,
        whatToAvoidToday: snapshot.recommendation.whatToAvoidToday,
        confidence: snapshot.recommendation.confidence,
        sourcesUsed: snapshot.recommendation.sourcesUsed,
        sourcesIgnored: snapshot.recommendation.sourcesIgnored,
        checkInQuestion: snapshot.recommendation.checkInQuestion,
      },
      trainingLoad: toTrainingLoadExport(snapshot.trainingLoad),
    },
    recentHistory: snapshot.history.slice(0, 14).map(compactDailyMetrics),
    goalProfile,
    eventProfile: {
      eventIntent: goalProfile?.primaryGoal === "event_preparation",
      timeframe: goalProfile?.timeframe ?? null,
      preferredActivities: goalProfile?.preferredActivities ?? [],
      constraints: goalProfile?.constraints ?? [],
      confidence: goalProfile?.confidence ?? 0,
    },
    dailyCheckIn: {
      currentCheckIn: options.currentCheckIn ?? null,
      checkInHistory: options.checkInHistory ?? [],
    },
    sourceFreshness: snapshot.sourceFreshness.map(toBundleSource),
    riskFlags,
    dataLimitations: Array.from(new Set(dataLimitations(snapshot))),
  };
}
