import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as SQLite from "expo-sqlite";

import { completeCoachRecommendation } from "../coach/dailyRecommendation";
import { extractRiskFlagsFromCoachRequest } from "../coach/riskFlags";
import { buildReadinessStatus } from "../coach/readinessStatus";
import {
  buildTrainingLoadSnapshot,
  recommendationBoundaryForTrainingLoad,
  toTrainingLoadExport,
} from "../coach/trainingLoad";
import {
  normalizeGoalProfile,
  type CoachingStyle,
  type ExperienceLevel,
  type GoalProfile,
  type GoalProfileDraft,
  type PrimaryGoal,
  type StartingStrategy,
} from "../goals/goalProfile";
import { buildPipelineExportArtifacts } from "../export/pipelineExport";
import { formatDuration, localDateKey } from "../lib/dates";
import { safeJsonStringify } from "../lib/json";
import {
  buildDailyMetricsRollup,
  hrvBaselineFor,
  hrvMethodForCanonicalType,
  hrvMethodLabel,
  normalizeLegacyHealthSampleRow,
  type LegacyHealthSampleRow,
} from "./trainingStoreRules";
import type {
  CanonicalType,
  CoachRecommendation,
  DailyMetrics,
  HealthConnectReadDiagnostic,
  HealthProvider,
  HealthSample,
  HrvCanonicalType,
  HrvMethod,
  MetricAvailability,
  NutritionDailyRecord,
  PipelineSnapshot,
  SleepSessionRecord,
  SourceFreshness,
  SourceFreshnessDomain,
  TrainingLoadSnapshot,
  SportBucket,
  SyncPayload,
  SyncRange,
  WorkoutRecord,
} from "../health/types";

export type HealthSampleRow = {
  sample_id: string;
  platform: HealthProvider;
  record_type: string;
  canonical_type: CanonicalType;
  source_app: string | null;
  source_device: string | null;
  start_at: string;
  end_at: string;
  local_date: string;
  timezone: string | null;
  value: number | null;
  unit: string | null;
  hrv_method: HrvMethod | null;
  metadata_json: string;
  source_modified_at: string | null;
  imported_at: string;
};

export type WorkoutRow = {
  workout_id: string;
  platform: HealthProvider;
  source_app: string | null;
  start_at: string;
  end_at: string;
  local_date: string;
  name: string | null;
  activity_type: string | null;
  sport_bucket: SportBucket;
  elapsed_seconds: number;
  moving_seconds: number | null;
  distance_km: number | null;
  active_kcal: number | null;
  total_kcal: number | null;
  avg_hr_bpm: number | null;
  max_hr_bpm: number | null;
  route_available: number;
  laps_json: string | null;
  streams_json: string | null;
  raw_json: string;
  imported_at: string;
};

export type SleepSessionRow = {
  sleep_id: string;
  platform: HealthProvider;
  source_app: string | null;
  start_at: string;
  end_at: string;
  wake_date: string;
  sleep_seconds: number;
  time_in_bed_seconds: number;
  deep_sleep_seconds: number | null;
  light_sleep_seconds: number | null;
  rem_sleep_seconds: number | null;
  awake_seconds: number | null;
  sleep_stage_json: string | null;
  sleep_efficiency: number | null;
  wakeup_count: number | null;
  raw_json: string;
  imported_at: string;
};

export type SyncRunRow = {
  id: number;
  provider: HealthProvider;
  sync_type: "manual" | "incremental";
  started_at: string;
  ended_at: string;
  range_start: string;
  range_end: string;
  sample_count: number;
  health_sample_count: number;
  workout_count: number;
  sleep_session_count: number;
  nutrition_day_count: number;
  warning_count: number;
  diagnostic_count: number;
  status: "ok" | "error";
  error: string | null;
};

export type SyncRunDetails = {
  syncType?: SyncRunRow["sync_type"];
  healthSampleCount?: number;
  workoutCount?: number;
  sleepSessionCount?: number;
  nutritionDayCount?: number;
  warningCount?: number;
  diagnosticCount?: number;
};

export type PipelineExportResult = {
  jsonFileUri: string;
  healthCheckFileUri: string;
};

type HealthConnectDiagnosticRow = {
  record_type: string;
  canonical_type: CanonicalType;
  permission: HealthConnectReadDiagnostic["permission"];
  read_kind: HealthConnectReadDiagnostic["readKind"];
  records_read: number;
  samples_written: number;
  message: string | null;
};

type MetricAvailabilityRow = {
  canonical_type: CanonicalType;
  sample_count: number;
  day_count: number;
  latest_date: string | null;
};

type FreshnessStatsRow = {
  sample_count: number | null;
  day_count: number | null;
  latest_date: string | null;
  last_updated_at: string | null;
};

type FreshnessCanonicalTypeRow = {
  canonical_type: CanonicalType;
  sample_count: number;
};

type TableCountRow = {
  total: number;
  first_date: string | null;
  latest_date: string | null;
};

type LatestSampleByTypeRow = {
  canonical_type: CanonicalType;
  record_type: string;
  source_app: string | null;
  local_date: string;
  start_at: string;
  value: number | null;
  unit: string | null;
  hrv_method: HrvMethod | null;
};

type SourceValueRow = {
  source_key: string | null;
  value: number | null;
  sample_count: number;
  latest_end_at: string | null;
  source_is_combined: number;
};

type HrvRollupRow = {
  source_key: string;
  source_app: string | null;
  canonical_type: HrvCanonicalType;
  hrv_method: HrvMethod;
  value: number | null;
  sample_count: number;
  source_days: number | null;
  latest_end_at: string | null;
};

type HrvMethodStatsRow = {
  canonical_type: HrvCanonicalType;
  hrv_method: HrvMethod | null;
  source_key: string;
  source_app: string | null;
  sample_count: number;
  day_count: number;
};

type SleepRollupRow = {
  source_key: string | null;
  sleep_seconds: number | null;
  time_in_bed_seconds: number | null;
  sleep_efficiency: number | null;
  session_count: number;
  source_days: number | null;
  latest_end_at: string | null;
};

type DailyMetricsRow = {
  date: string;
  data_completeness: DailyMetrics["dataCompleteness"];
  wellness_data_status: string;
  source_count: number;
  has_platform_wellness: number;
  has_activity: number;
  has_nutrition: number;
  has_sleep: number;
  has_steps: number;
  has_energy: number;
  steps: number | null;
  active_kcal: number | null;
  total_kcal: number | null;
  distance_km: number | null;
  sleep_seconds: number | null;
  time_in_bed_seconds: number | null;
  sleep_efficiency: number | null;
  resting_hr: number | null;
  heart_rate_avg_bpm: number | null;
  heart_rate_min_bpm: number | null;
  heart_rate_max_bpm: number | null;
  hrv_last_night_avg: number | null;
  hrv_method: HrvMethod | null;
  hrv_canonical_type: HrvCanonicalType | null;
  hrv_source_app: string | null;
  hrv_source_key: string | null;
  hrv_sample_count: number | null;
  workout_count: number | null;
  run_workout_count: number | null;
  ride_workout_count: number | null;
  strength_workout_count: number | null;
  activity_elapsed_seconds: number | null;
  activity_kcal: number | null;
  kcal_in: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  saturated_fat_g: number | null;
  monounsaturated_fat_g: number | null;
  polyunsaturated_fat_g: number | null;
  trans_fat_g: number | null;
  fiber_g: number | null;
  sugar_g: number | null;
  cholesterol_mg: number | null;
  caffeine_mg: number | null;
  sodium_mg: number | null;
  potassium_mg: number | null;
  calcium_mg: number | null;
  iron_mg: number | null;
  magnesium_mg: number | null;
  zinc_mg: number | null;
  vitamin_a_mcg: number | null;
  vitamin_b6_mg: number | null;
  vitamin_b12_mcg: number | null;
  vitamin_c_mg: number | null;
  vitamin_d_mcg: number | null;
  vitamin_e_mg: number | null;
  vitamin_k_mcg: number | null;
  water_ml: number | null;
  weight_kg: number | null;
  body_fat_pct: number | null;
  lean_body_mass_kg: number | null;
  vo2max: number | null;
  generated_at: string;
};

const nutritionDailyAddedColumns: Record<string, string> = {
  saturated_fat_g: "REAL",
  monounsaturated_fat_g: "REAL",
  polyunsaturated_fat_g: "REAL",
  trans_fat_g: "REAL",
  potassium_mg: "REAL",
  calcium_mg: "REAL",
  iron_mg: "REAL",
  magnesium_mg: "REAL",
  zinc_mg: "REAL",
  vitamin_a_mcg: "REAL",
  vitamin_b6_mg: "REAL",
  vitamin_b12_mcg: "REAL",
  vitamin_c_mg: "REAL",
  vitamin_d_mcg: "REAL",
  vitamin_e_mg: "REAL",
  vitamin_k_mcg: "REAL",
};

const dailyMetricsAddedNutritionColumns: Record<string, string> = {
  saturated_fat_g: "REAL",
  monounsaturated_fat_g: "REAL",
  polyunsaturated_fat_g: "REAL",
  trans_fat_g: "REAL",
  cholesterol_mg: "REAL",
  caffeine_mg: "REAL",
  sodium_mg: "REAL",
  potassium_mg: "REAL",
  calcium_mg: "REAL",
  iron_mg: "REAL",
  magnesium_mg: "REAL",
  zinc_mg: "REAL",
  vitamin_a_mcg: "REAL",
  vitamin_b6_mg: "REAL",
  vitamin_b12_mcg: "REAL",
  vitamin_c_mg: "REAL",
  vitamin_d_mcg: "REAL",
  vitamin_e_mg: "REAL",
  vitamin_k_mcg: "REAL",
};

type GoalProfileRow = {
  id: "current";
  primary_goal: PrimaryGoal;
  secondary_goals_json: string;
  motivation: string | null;
  timeframe: string | null;
  experience_level: ExperienceLevel;
  preferred_activities_json: string;
  disliked_activities_json: string;
  constraints_json: string;
  risk_flags_json: string;
  coaching_style: CoachingStyle;
  starting_strategy: StartingStrategy;
  confidence: number;
  updated_at: string;
};

export type CoachHealthContext = {
  generatedAt: string;
  hasSyncedHealthData: boolean;
  sqliteTables: {
    healthSamples: TableCountRow;
    sleepSessions: TableCountRow;
    workouts: TableCountRow;
    nutritionDaily: TableCountRow;
    dailyMetrics: TableCountRow;
    syncRuns: {
      total: number;
      latestEndedAt: string | null;
      latestStatus: SyncRunRow["status"] | null;
      latestSampleCount: number | null;
      latestRangeStart: string | null;
      latestRangeEnd: string | null;
    };
  };
  metricAvailability: MetricAvailability[];
  sourceFreshness: SourceFreshness[];
  latestSamplesByType: {
    canonicalType: CanonicalType;
    recordType: string;
    sourceApp?: string;
    localDate: string;
    startAt: string;
    value?: number;
    unit?: string;
    hrvMethod?: HrvMethod;
  }[];
  recentDailyMetrics: DailyMetrics[];
  recentWorkouts: {
    localDate: string;
    name?: string;
    activityType?: string;
    sportBucket: SportBucket;
    elapsedSeconds: number;
    distanceKm?: number;
    activeKcal?: number;
    avgHrBpm?: number;
    sourceApp?: string;
  }[];
  coachDataInstruction: string;
};

type WorkoutSummary = {
  workout_count: number;
  run_workout_count: number;
  ride_workout_count: number;
  strength_workout_count: number;
  activity_elapsed_seconds: number | null;
  activity_kcal: number | null;
};

type SourceFreshnessConfig = {
  domain: SourceFreshnessDomain;
  label: string;
  canonicalTypes: CanonicalType[];
  maxFreshAgeDays: number;
  source: "samples" | "sleep" | "workouts" | "nutrition" | "check_ins";
  todayIsPartial?: boolean;
  partialWhenMissingTypes?: boolean;
  missingLimitation: string;
};

const sourceFreshnessConfigs: SourceFreshnessConfig[] = [
  {
    domain: "sleep",
    label: "Sleep",
    canonicalTypes: ["sleep_session"],
    maxFreshAgeDays: 1,
    source: "sleep",
    missingLimitation: "No imported sleep sessions are available.",
  },
  {
    domain: "workouts",
    label: "Workouts",
    canonicalTypes: ["workout"],
    maxFreshAgeDays: 7,
    source: "workouts",
    missingLimitation: "No imported workout sessions are available.",
  },
  {
    domain: "steps",
    label: "Steps",
    canonicalTypes: ["steps"],
    maxFreshAgeDays: 0,
    source: "samples",
    todayIsPartial: true,
    missingLimitation: "No imported step samples are available.",
  },
  {
    domain: "energy",
    label: "Energy",
    canonicalTypes: ["active_energy", "total_energy"],
    maxFreshAgeDays: 0,
    source: "samples",
    todayIsPartial: true,
    partialWhenMissingTypes: true,
    missingLimitation:
      "No imported active or total energy samples are available.",
  },
  {
    domain: "hrv",
    label: "HRV",
    canonicalTypes: ["hrv_rmssd", "hrv_sdnn"],
    maxFreshAgeDays: 1,
    source: "samples",
    missingLimitation: "No imported HRV samples are available.",
  },
  {
    domain: "resting_hr",
    label: "Resting HR",
    canonicalTypes: ["resting_heart_rate"],
    maxFreshAgeDays: 1,
    source: "samples",
    missingLimitation: "No imported resting heart rate samples are available.",
  },
  {
    domain: "nutrition",
    label: "Nutrition",
    canonicalTypes: ["nutrition"],
    maxFreshAgeDays: 1,
    source: "nutrition",
    todayIsPartial: true,
    missingLimitation: "No imported nutrition rows are available.",
  },
  {
    domain: "hydration",
    label: "Hydration",
    canonicalTypes: ["hydration"],
    maxFreshAgeDays: 1,
    source: "nutrition",
    todayIsPartial: true,
    missingLimitation: "No imported hydration rows are available.",
  },
  {
    domain: "body_composition",
    label: "Body composition",
    canonicalTypes: ["weight", "body_fat", "lean_body_mass"],
    maxFreshAgeDays: 14,
    source: "samples",
    partialWhenMissingTypes: true,
    missingLimitation:
      "No imported weight, body fat, or lean mass samples are available.",
  },
  {
    domain: "check_ins",
    label: "Check-ins",
    canonicalTypes: [],
    maxFreshAgeDays: 0,
    source: "check_ins",
    missingLimitation:
      "Daily check-ins are not implemented in local storage yet.",
  },
];

let dbPromise: Promise<SQLite.SQLiteDatabase> | undefined;
let storageQueue: Promise<void> = Promise.resolve();

function withStorageLock<T>(operation: () => Promise<T>): Promise<T> {
  const run = storageQueue.then(operation, operation);
  storageQueue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function bool(value: number | null | undefined): boolean {
  return Boolean(value);
}

function optionalNumber(value: number | null | undefined): number | undefined {
  return value == null ? undefined : Number(value);
}

function parseJsonStringArray(value: string | null | undefined): string[] {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

function numberOrZero(value: number | null | undefined): number {
  return value == null ? 0 : Number(value);
}

function timestamp(value: string): number {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function workoutDurationMs(workout: WorkoutRow): number {
  return Math.max(0, timestamp(workout.end_at) - timestamp(workout.start_at));
}

function workoutOverlapRatio(a: WorkoutRow, b: WorkoutRow): number {
  const start = Math.max(timestamp(a.start_at), timestamp(b.start_at));
  const end = Math.min(timestamp(a.end_at), timestamp(b.end_at));
  const overlap = Math.max(0, end - start);
  const shortest = Math.min(workoutDurationMs(a), workoutDurationMs(b));
  return shortest > 0 ? overlap / shortest : 0;
}

function compatibleWorkoutSport(a: WorkoutRow, b: WorkoutRow): boolean {
  return (
    a.sport_bucket === b.sport_bucket ||
    a.sport_bucket === "other" ||
    b.sport_bucket === "other"
  );
}

function isLikelyDuplicateWorkout(a: WorkoutRow, b: WorkoutRow): boolean {
  if (!compatibleWorkoutSport(a, b)) {
    return false;
  }

  const startDeltaMs = Math.abs(timestamp(a.start_at) - timestamp(b.start_at));
  const endDeltaMs = Math.abs(timestamp(a.end_at) - timestamp(b.end_at));
  const durationDelta =
    Math.abs(workoutDurationMs(a) - workoutDurationMs(b)) /
    Math.max(workoutDurationMs(a), workoutDurationMs(b), 1);
  const overlapRatio = workoutOverlapRatio(a, b);

  return (
    (startDeltaMs <= 10 * 60 * 1000 && endDeltaMs <= 10 * 60 * 1000) ||
    (startDeltaMs <= 15 * 60 * 1000 &&
      overlapRatio >= 0.85 &&
      durationDelta <= 0.25) ||
    (overlapRatio >= 0.95 && durationDelta <= 0.15)
  );
}

function workoutCompletenessScore(workout: WorkoutRow): number {
  return [
    workout.route_available ? 8 : 0,
    workout.distance_km != null ? 6 : 0,
    workout.active_kcal != null || workout.total_kcal != null ? 4 : 0,
    workout.avg_hr_bpm != null || workout.max_hr_bpm != null ? 4 : 0,
    workout.laps_json ? 2 : 0,
    workout.streams_json ? 2 : 0,
    workout.name ? 1 : 0,
    workout.sport_bucket !== "other" ? 1 : 0,
  ].reduce((sum, value) => sum + value, 0);
}

function preferredWorkout(a: WorkoutRow, b: WorkoutRow): WorkoutRow {
  const scoreDelta = workoutCompletenessScore(b) - workoutCompletenessScore(a);
  if (scoreDelta !== 0) {
    return scoreDelta > 0 ? b : a;
  }

  const durationDelta =
    numberOrZero(b.elapsed_seconds) - numberOrZero(a.elapsed_seconds);
  if (durationDelta !== 0) {
    return durationDelta > 0 ? b : a;
  }

  return timestamp(b.imported_at) > timestamp(a.imported_at) ? b : a;
}

function dedupeWorkoutRows(workouts: WorkoutRow[]): WorkoutRow[] {
  const clusters: { representative: WorkoutRow; rows: WorkoutRow[] }[] = [];
  const sorted = workouts
    .slice()
    .sort((a, b) => timestamp(a.start_at) - timestamp(b.start_at));

  for (const workout of sorted) {
    const cluster = clusters.find((candidate) =>
      candidate.rows.some((row) => isLikelyDuplicateWorkout(row, workout)),
    );

    if (!cluster) {
      clusters.push({ representative: workout, rows: [workout] });
      continue;
    }

    cluster.rows.push(workout);
    cluster.representative = preferredWorkout(cluster.representative, workout);
  }

  return clusters
    .map((cluster) => cluster.representative)
    .sort((a, b) => timestamp(b.start_at) - timestamp(a.start_at));
}

function summarizeWorkouts(workouts: WorkoutRow[]): WorkoutSummary {
  const deduped = dedupeWorkoutRows(workouts);
  const activityKcal = deduped.reduce(
    (sum, workout) => sum + numberOrZero(workout.active_kcal),
    0,
  );

  return {
    workout_count: deduped.length,
    run_workout_count: deduped.filter(
      (workout) => workout.sport_bucket === "run",
    ).length,
    ride_workout_count: deduped.filter(
      (workout) => workout.sport_bucket === "ride",
    ).length,
    strength_workout_count: deduped.filter(
      (workout) => workout.sport_bucket === "strength",
    ).length,
    activity_elapsed_seconds: deduped.length
      ? deduped.reduce(
          (sum, workout) => sum + numberOrZero(workout.elapsed_seconds),
          0,
        )
      : null,
    activity_kcal: activityKcal ? activityKcal : null,
  };
}

function mergeAvailability(
  availability: Map<CanonicalType, MetricAvailability>,
  metric: CanonicalType,
  values: MetricAvailability,
) {
  const current = availability.get(metric);
  if (!current) {
    availability.set(metric, values);
    return;
  }

  availability.set(metric, {
    canonicalType: metric,
    sampleCount: Math.max(current.sampleCount, values.sampleCount),
    dayCount: Math.max(current.dayCount, values.dayCount),
    latestDate:
      !current.latestDate ||
      (values.latestDate && values.latestDate > current.latestDate)
        ? values.latestDate
        : current.latestDate,
  });
}

function buildMetricAvailability(
  rows: MetricAvailabilityRow[],
  workouts: WorkoutRow[],
  sleepCount: number,
  nutritionDays: number,
): MetricAvailability[] {
  const availability = new Map<CanonicalType, MetricAvailability>();

  rows.forEach((row) => {
    availability.set(row.canonical_type, {
      canonicalType: row.canonical_type,
      sampleCount: Number(row.sample_count),
      dayCount: Number(row.day_count),
      latestDate: row.latest_date ?? undefined,
    });
  });

  const dedupedWorkouts = dedupeWorkoutRows(workouts);
  if (dedupedWorkouts.length) {
    mergeAvailability(availability, "workout", {
      canonicalType: "workout",
      sampleCount: dedupedWorkouts.length,
      dayCount: new Set(dedupedWorkouts.map((workout) => workout.local_date))
        .size,
      latestDate: dedupedWorkouts[0]?.local_date,
    });
  }

  if (sleepCount) {
    const sleep = availability.get("sleep_session");
    mergeAvailability(availability, "sleep_session", {
      canonicalType: "sleep_session",
      sampleCount: Math.max(sleep?.sampleCount ?? 0, sleepCount),
      dayCount: sleep?.dayCount ?? 0,
      latestDate: sleep?.latestDate,
    });
  }

  if (nutritionDays) {
    const nutrition = availability.get("nutrition");
    mergeAvailability(availability, "nutrition", {
      canonicalType: "nutrition",
      sampleCount: Math.max(nutrition?.sampleCount ?? 0, nutritionDays),
      dayCount: Math.max(nutrition?.dayCount ?? 0, nutritionDays),
      latestDate: nutrition?.latestDate,
    });
  }

  return [...availability.values()].sort((a, b) =>
    a.canonicalType.localeCompare(b.canonicalType),
  );
}

function canonicalTypeLabel(type: CanonicalType): string {
  const labels: Partial<Record<CanonicalType, string>> = {
    active_energy: "active energy",
    body_fat: "body fat",
    distance: "distance",
    heart_rate: "heart rate",
    hydration: "hydration",
    hrv_rmssd: "HRV",
    hrv_sdnn: "HRV SDNN",
    lean_body_mass: "lean mass",
    nutrition: "nutrition",
    resting_heart_rate: "resting heart rate",
    sleep_session: "sleep",
    steps: "steps",
    total_energy: "total energy",
    vo2max: "VO2 max",
    weight: "weight",
    workout: "workouts",
  };

  return labels[type] ?? type.replace(/_/g, " ");
}

function daysSinceLocalDate(
  latestDate: string | null | undefined,
  today: string,
): number | undefined {
  if (!latestDate) {
    return undefined;
  }

  const latestTime = new Date(`${latestDate}T12:00:00`).getTime();
  const todayTime = new Date(`${today}T12:00:00`).getTime();
  if (!Number.isFinite(latestTime) || !Number.isFinite(todayTime)) {
    return undefined;
  }

  return Math.max(
    0,
    Math.floor((todayTime - latestTime) / (24 * 60 * 60 * 1000)),
  );
}

function placeholders(values: unknown[]): string {
  return values.map(() => "?").join(", ");
}

async function freshnessStatsForSamples(
  db: SQLite.SQLiteDatabase,
  canonicalTypes: CanonicalType[],
): Promise<FreshnessStatsRow | null> {
  if (!canonicalTypes.length) {
    return null;
  }

  return db.getFirstAsync<FreshnessStatsRow>(
    `
      SELECT
        COUNT(*) AS sample_count,
        COUNT(DISTINCT local_date) AS day_count,
        MAX(local_date) AS latest_date,
        MAX(COALESCE(source_modified_at, end_at, imported_at)) AS last_updated_at
      FROM health_samples
      WHERE canonical_type IN (${placeholders(canonicalTypes)})
    `,
    ...canonicalTypes,
  );
}

async function freshnessStatsForSleep(
  db: SQLite.SQLiteDatabase,
): Promise<FreshnessStatsRow | null> {
  return db.getFirstAsync<FreshnessStatsRow>(`
    SELECT
      COUNT(*) AS sample_count,
      COUNT(DISTINCT date_key) AS day_count,
      MAX(date_key) AS latest_date,
      MAX(updated_at) AS last_updated_at
    FROM (
      SELECT sleep_id AS row_id, wake_date AS date_key, COALESCE(end_at, imported_at) AS updated_at
      FROM sleep_sessions
      UNION ALL
      SELECT sample_id AS row_id, local_date AS date_key, COALESCE(source_modified_at, end_at, imported_at) AS updated_at
      FROM health_samples
      WHERE canonical_type = 'sleep_session'
    )
  `);
}

async function freshnessStatsForWorkouts(
  db: SQLite.SQLiteDatabase,
): Promise<FreshnessStatsRow | null> {
  return db.getFirstAsync<FreshnessStatsRow>(`
    SELECT
      COUNT(*) AS sample_count,
      COUNT(DISTINCT date_key) AS day_count,
      MAX(date_key) AS latest_date,
      MAX(updated_at) AS last_updated_at
    FROM (
      SELECT workout_id AS row_id, local_date AS date_key, COALESCE(end_at, imported_at) AS updated_at
      FROM workouts
      UNION ALL
      SELECT sample_id AS row_id, local_date AS date_key, COALESCE(source_modified_at, end_at, imported_at) AS updated_at
      FROM health_samples
      WHERE canonical_type = 'workout'
    )
  `);
}

async function freshnessStatsForNutrition(
  db: SQLite.SQLiteDatabase,
  canonicalTypes: CanonicalType[],
): Promise<FreshnessStatsRow | null> {
  const includesNutrition = canonicalTypes.includes("nutrition");
  const includesHydration = canonicalTypes.includes("hydration");
  const nutritionDailyFilters: string[] = [];
  if (includesNutrition) {
    nutritionDailyFilters.push(`(
      kcal_in IS NOT NULL OR protein_g IS NOT NULL OR carbs_g IS NOT NULL OR fat_g IS NOT NULL OR
      saturated_fat_g IS NOT NULL OR monounsaturated_fat_g IS NOT NULL OR
      polyunsaturated_fat_g IS NOT NULL OR trans_fat_g IS NOT NULL OR fiber_g IS NOT NULL OR
      sugar_g IS NOT NULL OR cholesterol_mg IS NOT NULL OR caffeine_mg IS NOT NULL OR
      sodium_mg IS NOT NULL OR potassium_mg IS NOT NULL OR calcium_mg IS NOT NULL OR
      iron_mg IS NOT NULL OR magnesium_mg IS NOT NULL OR zinc_mg IS NOT NULL OR
      vitamin_a_mcg IS NOT NULL OR vitamin_b6_mg IS NOT NULL OR vitamin_b12_mcg IS NOT NULL OR
      vitamin_c_mg IS NOT NULL OR vitamin_d_mcg IS NOT NULL OR vitamin_e_mg IS NOT NULL OR
      vitamin_k_mcg IS NOT NULL
    )`);
  }
  if (includesHydration) {
    nutritionDailyFilters.push("water_ml IS NOT NULL");
  }
  const nutritionDailyWhere = nutritionDailyFilters.length
    ? `WHERE ${nutritionDailyFilters.join(" OR ")}`
    : "";

  return db.getFirstAsync<FreshnessStatsRow>(
    `
    SELECT
      COUNT(*) AS sample_count,
      COUNT(DISTINCT date_key) AS day_count,
      MAX(date_key) AS latest_date,
      MAX(updated_at) AS last_updated_at
    FROM (
      SELECT date AS row_id, date AS date_key, COALESCE(source_modified_at, imported_at) AS updated_at
      FROM nutrition_daily
      ${nutritionDailyWhere}
      UNION ALL
      SELECT sample_id AS row_id, local_date AS date_key, COALESCE(source_modified_at, end_at, imported_at) AS updated_at
      FROM health_samples
      WHERE canonical_type IN (${placeholders(canonicalTypes)})
    )
  `,
    ...canonicalTypes,
  );
}

async function freshnessStatsFor(
  db: SQLite.SQLiteDatabase,
  config: SourceFreshnessConfig,
): Promise<FreshnessStatsRow | null> {
  if (config.source === "sleep") {
    return freshnessStatsForSleep(db);
  }

  if (config.source === "workouts") {
    return freshnessStatsForWorkouts(db);
  }

  if (config.source === "nutrition") {
    return freshnessStatsForNutrition(db, config.canonicalTypes);
  }

  if (config.source === "check_ins") {
    return null;
  }

  return freshnessStatsForSamples(db, config.canonicalTypes);
}

async function presentCanonicalTypesFor(
  db: SQLite.SQLiteDatabase,
  canonicalTypes: CanonicalType[],
): Promise<Set<CanonicalType>> {
  if (!canonicalTypes.length) {
    return new Set();
  }

  const rows = await db.getAllAsync<FreshnessCanonicalTypeRow>(
    `
      SELECT canonical_type, COUNT(*) AS sample_count
      FROM health_samples
      WHERE canonical_type IN (${placeholders(canonicalTypes)})
      GROUP BY canonical_type
    `,
    ...canonicalTypes,
  );

  return new Set(
    rows
      .filter((row) => Number(row.sample_count) > 0)
      .map((row) => row.canonical_type),
  );
}

async function hrvMethodStatsFor(
  db: SQLite.SQLiteDatabase,
): Promise<HrvMethodStatsRow[]> {
  return db.getAllAsync<HrvMethodStatsRow>(`
    WITH hrv_samples AS (
      SELECT
        canonical_type,
        COALESCE(
          hrv_method,
          CASE canonical_type
            WHEN 'hrv_rmssd' THEN 'rmssd'
            WHEN 'hrv_sdnn' THEN 'sdnn'
          END
        ) AS hrv_method,
        COALESCE(NULLIF(source_app, ''), NULLIF(source_device, ''), platform || ':' || record_type)
          AS source_key,
        source_app,
        local_date,
        value
      FROM health_samples
      WHERE canonical_type IN ('hrv_rmssd', 'hrv_sdnn')
        AND value IS NOT NULL
    )
    SELECT
      canonical_type,
      hrv_method,
      source_key,
      MAX(source_app) AS source_app,
      COUNT(*) AS sample_count,
      COUNT(DISTINCT local_date) AS day_count
    FROM hrv_samples
    GROUP BY canonical_type, hrv_method, source_key
    ORDER BY day_count DESC, sample_count DESC, source_key ASC
  `);
}

function hrvMethodLimitations(stats: HrvMethodStatsRow[]): string[] {
  if (!stats.length) {
    return [];
  }

  const methods = Array.from(
    new Set(
      stats
        .map(
          (row) =>
            row.hrv_method ?? hrvMethodForCanonicalType(row.canonical_type),
        )
        .filter((method): method is HrvMethod => Boolean(method)),
    ),
  );
  const limitations: string[] = [];

  if (methods.length > 1 || stats.length > 1) {
    const methodList = methods.map(hrvMethodLabel).join(" and ");
    limitations.push(
      `Imported HRV has ${methodList}; readiness compares only matching source and method.`,
    );
  }

  if (stats.some((row) => !row.hrv_method)) {
    limitations.push(
      "Some HRV rows were imported before method metadata was explicit.",
    );
  }

  return limitations;
}

function buildFreshnessLimitations({
  config,
  diagnostics,
  missingTypes,
  sampleCount,
  ageDays,
  today,
  latestDate,
}: {
  config: SourceFreshnessConfig;
  diagnostics: HealthConnectDiagnosticRow[];
  missingTypes: CanonicalType[];
  sampleCount: number;
  ageDays?: number;
  today: string;
  latestDate?: string;
}): string[] {
  const limitations: string[] = [];

  if (!sampleCount) {
    limitations.push(config.missingLimitation);
  }

  if (ageDays != null && ageDays > config.maxFreshAgeDays) {
    limitations.push(
      `Latest ${config.label.toLowerCase()} data is ${ageDays} days old.`,
    );
  }

  if (config.todayIsPartial && latestDate === today) {
    limitations.push(
      "Today is still in progress; this domain may change after the next sync.",
    );
  }

  if (missingTypes.length) {
    limitations.push(
      `Missing ${missingTypes.map(canonicalTypeLabel).join(", ")} in imported rows.`,
    );
  }

  const relevantDiagnostics = diagnostics.filter((diagnostic) =>
    config.canonicalTypes.includes(diagnostic.canonical_type),
  );
  const missingPermissions = relevantDiagnostics.filter(
    (diagnostic) => diagnostic.permission === "missing",
  );
  if (missingPermissions.length) {
    const missingLabels = Array.from(
      new Set(
        missingPermissions.map((diagnostic) =>
          canonicalTypeLabel(diagnostic.canonical_type),
        ),
      ),
    );
    limitations.push(
      `Missing health data permission for ${missingLabels.join(", ")}.`,
    );
  }

  const emptyReads = relevantDiagnostics.filter(
    (diagnostic) =>
      diagnostic.permission === "granted" &&
      diagnostic.records_read === 0 &&
      diagnostic.samples_written === 0,
  );
  if (emptyReads.length) {
    const emptyLabels = Array.from(
      new Set(
        emptyReads.map((diagnostic) =>
          canonicalTypeLabel(diagnostic.canonical_type),
        ),
      ),
    );
    limitations.push(
      `Latest health data read returned no ${emptyLabels.join(", ")} data.`,
    );
  }

  return Array.from(new Set(limitations));
}

async function getLatestHealthConnectDiagnostics(
  db: SQLite.SQLiteDatabase,
): Promise<HealthConnectDiagnosticRow[]> {
  return db.getAllAsync<HealthConnectDiagnosticRow>(`
    SELECT record_type, canonical_type, permission, read_kind, records_read, samples_written, message
    FROM health_connect_diagnostics
    WHERE sync_started_at = (
      SELECT MAX(sync_started_at)
      FROM health_connect_diagnostics
    )
    ORDER BY canonical_type ASC, read_kind ASC, record_type ASC
  `);
}

async function getSourceFreshness(
  db: SQLite.SQLiteDatabase,
): Promise<SourceFreshness[]> {
  const today = localDateKey(new Date());
  const diagnostics = await getLatestHealthConnectDiagnostics(db);
  const rows: SourceFreshness[] = [];

  for (const config of sourceFreshnessConfigs) {
    const stats = await freshnessStatsFor(db, config);
    const presentTypes = await presentCanonicalTypesFor(
      db,
      config.canonicalTypes,
    );
    const sampleCount = Number(stats?.sample_count ?? 0);
    const dayCount = Number(stats?.day_count ?? 0);
    const latestDate = stats?.latest_date ?? undefined;
    const ageDays = daysSinceLocalDate(latestDate, today);
    const missingTypes =
      config.partialWhenMissingTypes && sampleCount > 0
        ? config.canonicalTypes.filter((type) => !presentTypes.has(type))
        : [];
    const limitations = buildFreshnessLimitations({
      config,
      diagnostics,
      missingTypes,
      sampleCount,
      ageDays,
      today,
      latestDate,
    });
    if (config.domain === "hrv") {
      limitations.push(...hrvMethodLimitations(await hrvMethodStatsFor(db)));
    }

    let state: SourceFreshness["state"] = "fresh";
    if (!sampleCount) {
      state = "missing";
    } else if (ageDays != null && ageDays > config.maxFreshAgeDays) {
      state = "stale";
    } else if (
      missingTypes.length ||
      (config.todayIsPartial && latestDate === today) ||
      (config.domain === "hrv" &&
        limitations.some((limitation) =>
          limitation.startsWith("Imported HRV has "),
        ))
    ) {
      state = "partial";
    }

    rows.push({
      domain: config.domain,
      label: config.label,
      state,
      canonicalTypes: config.canonicalTypes,
      sampleCount,
      dayCount,
      latestLocalDate: latestDate,
      lastUpdatedAt: stats?.last_updated_at ?? undefined,
      ageDays,
      limitations: Array.from(new Set(limitations)),
    });
  }

  return rows;
}

function toDailyMetrics(row: DailyMetricsRow): DailyMetrics {
  return {
    date: row.date,
    dataCompleteness: row.data_completeness,
    wellnessDataStatus: row.wellness_data_status,
    sourceCount: row.source_count,
    hasPlatformWellness: bool(row.has_platform_wellness),
    hasActivity: bool(row.has_activity),
    hasNutrition: bool(row.has_nutrition),
    hasSleep: bool(row.has_sleep),
    hasSteps: bool(row.has_steps),
    hasEnergy: bool(row.has_energy),
    steps: optionalNumber(row.steps),
    activeKcal: optionalNumber(row.active_kcal),
    totalKcal: optionalNumber(row.total_kcal),
    distanceKm: optionalNumber(row.distance_km),
    sleepSeconds: optionalNumber(row.sleep_seconds),
    timeInBedSeconds: optionalNumber(row.time_in_bed_seconds),
    sleepEfficiency: optionalNumber(row.sleep_efficiency),
    restingHr: optionalNumber(row.resting_hr),
    heartRateAvgBpm: optionalNumber(row.heart_rate_avg_bpm),
    heartRateMinBpm: optionalNumber(row.heart_rate_min_bpm),
    heartRateMaxBpm: optionalNumber(row.heart_rate_max_bpm),
    hrvLastNightAvg: optionalNumber(row.hrv_last_night_avg),
    hrvMethod: row.hrv_method ?? undefined,
    hrvCanonicalType: row.hrv_canonical_type ?? undefined,
    hrvSourceApp: row.hrv_source_app ?? undefined,
    hrvSourceKey: row.hrv_source_key ?? undefined,
    hrvSampleCount: optionalNumber(row.hrv_sample_count),
    workoutCount: optionalNumber(row.workout_count),
    runWorkoutCount: optionalNumber(row.run_workout_count),
    rideWorkoutCount: optionalNumber(row.ride_workout_count),
    strengthWorkoutCount: optionalNumber(row.strength_workout_count),
    activityElapsedSeconds: optionalNumber(row.activity_elapsed_seconds),
    activityKcal: optionalNumber(row.activity_kcal),
    kcalIn: optionalNumber(row.kcal_in),
    proteinG: optionalNumber(row.protein_g),
    carbsG: optionalNumber(row.carbs_g),
    fatG: optionalNumber(row.fat_g),
    saturatedFatG: optionalNumber(row.saturated_fat_g),
    monounsaturatedFatG: optionalNumber(row.monounsaturated_fat_g),
    polyunsaturatedFatG: optionalNumber(row.polyunsaturated_fat_g),
    transFatG: optionalNumber(row.trans_fat_g),
    fiberG: optionalNumber(row.fiber_g),
    sugarG: optionalNumber(row.sugar_g),
    cholesterolMg: optionalNumber(row.cholesterol_mg),
    caffeineMg: optionalNumber(row.caffeine_mg),
    sodiumMg: optionalNumber(row.sodium_mg),
    potassiumMg: optionalNumber(row.potassium_mg),
    calciumMg: optionalNumber(row.calcium_mg),
    ironMg: optionalNumber(row.iron_mg),
    magnesiumMg: optionalNumber(row.magnesium_mg),
    zincMg: optionalNumber(row.zinc_mg),
    vitaminAMcg: optionalNumber(row.vitamin_a_mcg),
    vitaminB6Mg: optionalNumber(row.vitamin_b6_mg),
    vitaminB12Mcg: optionalNumber(row.vitamin_b12_mcg),
    vitaminCMg: optionalNumber(row.vitamin_c_mg),
    vitaminDMcg: optionalNumber(row.vitamin_d_mcg),
    vitaminEMg: optionalNumber(row.vitamin_e_mg),
    vitaminKMcg: optionalNumber(row.vitamin_k_mcg),
    waterMl: optionalNumber(row.water_ml),
    weightKg: optionalNumber(row.weight_kg),
    bodyFatPct: optionalNumber(row.body_fat_pct),
    leanBodyMassKg: optionalNumber(row.lean_body_mass_kg),
    vo2max: optionalNumber(row.vo2max),
    generatedAt: row.generated_at,
  };
}

function toGoalProfile(row: GoalProfileRow): GoalProfile {
  return normalizeGoalProfile(
    {
      primaryGoal: row.primary_goal,
      secondaryGoals: parseJsonStringArray(
        row.secondary_goals_json,
      ) as PrimaryGoal[],
      motivation: row.motivation,
      timeframe: row.timeframe,
      experienceLevel: row.experience_level,
      preferredActivities: parseJsonStringArray(row.preferred_activities_json),
      dislikedActivities: parseJsonStringArray(row.disliked_activities_json),
      constraints: parseJsonStringArray(row.constraints_json),
      riskFlags: parseJsonStringArray(row.risk_flags_json),
      coachingStyle: row.coaching_style,
      startingStrategy: row.starting_strategy,
      confidence: row.confidence,
    },
    row.updated_at,
  );
}

async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync("training_pipeline.db").then(
      async (db) => {
        await db.execAsync("PRAGMA journal_mode = WAL;");
        await db.execAsync("PRAGMA busy_timeout = 5000;");
        await migrateLegacyHealthSamples(db);
        await createSchema(db);
        return db;
      },
    );
  }

  return dbPromise;
}

async function addMissingColumns(
  db: SQLite.SQLiteDatabase,
  tableName: string,
  columns: Record<string, string>,
): Promise<void> {
  const existingColumns = await db.getAllAsync<{ name: string }>(
    `PRAGMA table_info(${tableName})`,
  );
  const existingNames = new Set(existingColumns.map((column) => column.name));

  for (const [columnName, columnType] of Object.entries(columns)) {
    if (existingNames.has(columnName)) {
      continue;
    }

    await db.execAsync(
      `ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnType};`,
    );
  }
}

async function migrateLegacyHealthSamples(
  db: SQLite.SQLiteDatabase,
): Promise<void> {
  const columns = await db.getAllAsync<{ name: string }>(
    "PRAGMA table_info(health_samples)",
  );
  if (
    !columns.length ||
    columns.some((column) => column.name === "sample_id")
  ) {
    return;
  }

  await db.execAsync(`
    ALTER TABLE health_samples RENAME TO health_samples_legacy;
  `);
}

async function ensureColumn(
  db: SQLite.SQLiteDatabase,
  table: string,
  column: string,
  definition: string,
): Promise<void> {
  const columns = await db.getAllAsync<{ name: string }>(
    `PRAGMA table_info(${table})`,
  );
  if (columns.some((item) => item.name === column)) {
    return;
  }

  await db.execAsync(`ALTER TABLE ${table} ADD COLUMN ${definition};`);
}

async function ensureHrvSchema(db: SQLite.SQLiteDatabase): Promise<void> {
  await ensureColumn(db, "health_samples", "hrv_method", "hrv_method TEXT");
  await ensureColumn(db, "daily_metrics", "hrv_method", "hrv_method TEXT");
  await ensureColumn(
    db,
    "daily_metrics",
    "hrv_canonical_type",
    "hrv_canonical_type TEXT",
  );
  await ensureColumn(
    db,
    "daily_metrics",
    "hrv_source_app",
    "hrv_source_app TEXT",
  );
  await ensureColumn(
    db,
    "daily_metrics",
    "hrv_source_key",
    "hrv_source_key TEXT",
  );
  await ensureColumn(
    db,
    "daily_metrics",
    "hrv_sample_count",
    "hrv_sample_count INTEGER",
  );

  await db.execAsync(`
    UPDATE health_samples
    SET hrv_method = CASE canonical_type
      WHEN 'hrv_rmssd' THEN 'rmssd'
      WHEN 'hrv_sdnn' THEN 'sdnn'
      ELSE hrv_method
    END
    WHERE hrv_method IS NULL
      AND canonical_type IN ('hrv_rmssd', 'hrv_sdnn');

    CREATE INDEX IF NOT EXISTS idx_health_samples_hrv_method
      ON health_samples(hrv_method, canonical_type, local_date);
  `);
}

async function createSchema(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS health_samples (
      sample_id TEXT PRIMARY KEY NOT NULL,
      platform TEXT NOT NULL,
      record_type TEXT NOT NULL,
      canonical_type TEXT NOT NULL,
      source_app TEXT,
      source_device TEXT,
      start_at TEXT NOT NULL,
      end_at TEXT NOT NULL,
      local_date TEXT NOT NULL,
      timezone TEXT,
      value REAL,
      unit TEXT,
      hrv_method TEXT,
      metadata_json TEXT NOT NULL,
      source_modified_at TEXT,
      imported_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_health_samples_type_date
      ON health_samples(canonical_type, local_date);

    CREATE INDEX IF NOT EXISTS idx_health_samples_platform_time
      ON health_samples(platform, start_at);

    CREATE TABLE IF NOT EXISTS sleep_sessions (
      sleep_id TEXT PRIMARY KEY NOT NULL,
      platform TEXT NOT NULL,
      source_app TEXT,
      start_at TEXT NOT NULL,
      end_at TEXT NOT NULL,
      wake_date TEXT NOT NULL,
      sleep_seconds INTEGER NOT NULL,
      time_in_bed_seconds INTEGER NOT NULL,
      deep_sleep_seconds INTEGER,
      light_sleep_seconds INTEGER,
      rem_sleep_seconds INTEGER,
      awake_seconds INTEGER,
      sleep_stage_json TEXT,
      sleep_efficiency REAL,
      wakeup_count INTEGER,
      raw_json TEXT NOT NULL,
      imported_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_sleep_sessions_wake_date
      ON sleep_sessions(wake_date);

    CREATE TABLE IF NOT EXISTS workouts (
      workout_id TEXT PRIMARY KEY NOT NULL,
      platform TEXT NOT NULL,
      source_app TEXT,
      start_at TEXT NOT NULL,
      end_at TEXT NOT NULL,
      local_date TEXT NOT NULL,
      name TEXT,
      activity_type TEXT,
      sport_bucket TEXT NOT NULL,
      elapsed_seconds INTEGER NOT NULL,
      moving_seconds INTEGER,
      distance_km REAL,
      active_kcal REAL,
      total_kcal REAL,
      avg_hr_bpm REAL,
      max_hr_bpm REAL,
      route_available INTEGER NOT NULL DEFAULT 0,
      laps_json TEXT,
      streams_json TEXT,
      raw_json TEXT NOT NULL,
      imported_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_workouts_local_date
      ON workouts(local_date);

    CREATE TABLE IF NOT EXISTS nutrition_daily (
      date TEXT PRIMARY KEY NOT NULL,
      kcal_in REAL,
      protein_g REAL,
      carbs_g REAL,
      fat_g REAL,
      saturated_fat_g REAL,
      monounsaturated_fat_g REAL,
      polyunsaturated_fat_g REAL,
      trans_fat_g REAL,
      fiber_g REAL,
      sugar_g REAL,
      cholesterol_mg REAL,
      water_ml REAL,
      caffeine_mg REAL,
      sodium_mg REAL,
      potassium_mg REAL,
      calcium_mg REAL,
      iron_mg REAL,
      magnesium_mg REAL,
      zinc_mg REAL,
      vitamin_a_mcg REAL,
      vitamin_b6_mg REAL,
      vitamin_b12_mcg REAL,
      vitamin_c_mg REAL,
      vitamin_d_mcg REAL,
      vitamin_e_mg REAL,
      vitamin_k_mcg REAL,
      entry_count INTEGER NOT NULL,
      meal_count INTEGER,
      all_nutrients_json TEXT NOT NULL,
      source_modified_at TEXT,
      imported_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS daily_metrics (
      date TEXT PRIMARY KEY NOT NULL,
      data_completeness TEXT NOT NULL,
      wellness_data_status TEXT NOT NULL,
      source_count INTEGER NOT NULL,
      has_platform_wellness INTEGER NOT NULL,
      has_activity INTEGER NOT NULL,
      has_nutrition INTEGER NOT NULL,
      has_sleep INTEGER NOT NULL,
      has_steps INTEGER NOT NULL,
      has_energy INTEGER NOT NULL,
      steps REAL,
      active_kcal REAL,
      total_kcal REAL,
      distance_km REAL,
      sleep_seconds REAL,
      time_in_bed_seconds REAL,
      sleep_efficiency REAL,
      resting_hr REAL,
      heart_rate_avg_bpm REAL,
      heart_rate_min_bpm REAL,
      heart_rate_max_bpm REAL,
      hrv_last_night_avg REAL,
      hrv_method TEXT,
      hrv_canonical_type TEXT,
      hrv_source_app TEXT,
      hrv_source_key TEXT,
      hrv_sample_count INTEGER,
      workout_count INTEGER,
      run_workout_count INTEGER,
      ride_workout_count INTEGER,
      strength_workout_count INTEGER,
      activity_elapsed_seconds REAL,
      activity_kcal REAL,
      kcal_in REAL,
      protein_g REAL,
      carbs_g REAL,
      fat_g REAL,
      saturated_fat_g REAL,
      monounsaturated_fat_g REAL,
      polyunsaturated_fat_g REAL,
      trans_fat_g REAL,
      fiber_g REAL,
      sugar_g REAL,
      cholesterol_mg REAL,
      caffeine_mg REAL,
      sodium_mg REAL,
      potassium_mg REAL,
      calcium_mg REAL,
      iron_mg REAL,
      magnesium_mg REAL,
      zinc_mg REAL,
      vitamin_a_mcg REAL,
      vitamin_b6_mg REAL,
      vitamin_b12_mcg REAL,
      vitamin_c_mg REAL,
      vitamin_d_mcg REAL,
      vitamin_e_mg REAL,
      vitamin_k_mcg REAL,
      water_ml REAL,
      weight_kg REAL,
      body_fat_pct REAL,
      lean_body_mass_kg REAL,
      vo2max REAL,
      generated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sync_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider TEXT NOT NULL,
      sync_type TEXT NOT NULL DEFAULT 'manual',
      started_at TEXT NOT NULL,
      ended_at TEXT NOT NULL,
      range_start TEXT NOT NULL,
      range_end TEXT NOT NULL,
      sample_count INTEGER NOT NULL,
      health_sample_count INTEGER NOT NULL DEFAULT 0,
      workout_count INTEGER NOT NULL DEFAULT 0,
      sleep_session_count INTEGER NOT NULL DEFAULT 0,
      nutrition_day_count INTEGER NOT NULL DEFAULT 0,
      warning_count INTEGER NOT NULL DEFAULT 0,
      diagnostic_count INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL,
      error TEXT
    );

    CREATE TABLE IF NOT EXISTS health_connect_diagnostics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sync_started_at TEXT NOT NULL,
      record_type TEXT NOT NULL,
      canonical_type TEXT NOT NULL,
      permission TEXT NOT NULL,
      read_kind TEXT NOT NULL,
      records_read INTEGER NOT NULL,
      samples_written INTEGER NOT NULL,
      message TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_health_connect_diagnostics_started
      ON health_connect_diagnostics(sync_started_at);

    CREATE TABLE IF NOT EXISTS goal_profile (
      id TEXT PRIMARY KEY NOT NULL CHECK (id = 'current'),
      primary_goal TEXT NOT NULL,
      secondary_goals_json TEXT NOT NULL,
      motivation TEXT,
      timeframe TEXT,
      experience_level TEXT NOT NULL,
      preferred_activities_json TEXT NOT NULL,
      disliked_activities_json TEXT NOT NULL,
      constraints_json TEXT NOT NULL,
      risk_flags_json TEXT NOT NULL,
      coaching_style TEXT NOT NULL,
      starting_strategy TEXT NOT NULL,
      confidence REAL NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  await addMissingColumns(db, "nutrition_daily", nutritionDailyAddedColumns);
  await addMissingColumns(
    db,
    "daily_metrics",
    dailyMetricsAddedNutritionColumns,
  );
  await ensureHrvSchema(db);
  await ensureSyncRunColumns(db);

  const legacyColumns = await db.getAllAsync<{ name: string }>(
    "PRAGMA table_info(health_samples_legacy)",
  );
  if (legacyColumns.length) {
    const legacyRows = await db.getAllAsync<LegacyHealthSampleRow>(`
      SELECT
        id, provider, metric, source_name, source_id, start_time, end_time,
        value, unit, raw_json, synced_at
      FROM health_samples_legacy
    `);

    for (const row of legacyRows) {
      const sample = normalizeLegacyHealthSampleRow(row);
      await db.runAsync(
        `
          INSERT OR IGNORE INTO health_samples (
            sample_id, platform, record_type, canonical_type, source_app, source_device,
            start_at, end_at, local_date, value, unit, hrv_method, metadata_json, imported_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        sample.sampleId,
        sample.platform,
        sample.recordType,
        sample.canonicalType,
        sample.sourceApp,
        sample.sourceDevice,
        sample.startAt,
        sample.endAt,
        sample.localDate,
        sample.value,
        sample.unit,
        sample.hrvMethod,
        sample.metadataJson,
        sample.importedAt,
      );
    }

    await db.execAsync("DROP TABLE health_samples_legacy;");
  }
}

async function ensureSyncRunColumns(db: SQLite.SQLiteDatabase): Promise<void> {
  const columns = await db.getAllAsync<{ name: string }>(
    "PRAGMA table_info(sync_runs)",
  );
  const present = new Set(columns.map((column) => column.name));
  const additions: Record<string, string> = {
    sync_type: "TEXT NOT NULL DEFAULT 'manual'",
    health_sample_count: "INTEGER NOT NULL DEFAULT 0",
    workout_count: "INTEGER NOT NULL DEFAULT 0",
    sleep_session_count: "INTEGER NOT NULL DEFAULT 0",
    nutrition_day_count: "INTEGER NOT NULL DEFAULT 0",
    warning_count: "INTEGER NOT NULL DEFAULT 0",
    diagnostic_count: "INTEGER NOT NULL DEFAULT 0",
  };

  for (const [name, definition] of Object.entries(additions)) {
    if (!present.has(name)) {
      await db.execAsync(
        `ALTER TABLE sync_runs ADD COLUMN ${name} ${definition};`,
      );
    }
  }

  await db.runAsync(`
    UPDATE sync_runs
    SET health_sample_count = sample_count
    WHERE sample_count > 0
      AND health_sample_count = 0
      AND workout_count = 0
      AND sleep_session_count = 0
      AND nutrition_day_count = 0
  `);
}

export async function initTrainingStore(): Promise<void> {
  await withStorageLock(async () => {
    await getDb();
  });
}

async function getGoalProfileFromDb(
  db: SQLite.SQLiteDatabase,
): Promise<GoalProfile | null> {
  const row = await db.getFirstAsync<GoalProfileRow>(
    "SELECT * FROM goal_profile WHERE id = 'current' LIMIT 1",
  );

  return row ? toGoalProfile(row) : null;
}

export async function getGoalProfile(): Promise<GoalProfile | null> {
  return withStorageLock(async () => getGoalProfileFromDb(await getDb()));
}

export async function saveGoalProfile(
  draft: GoalProfileDraft,
): Promise<GoalProfile> {
  return withStorageLock(async () => {
    const db = await getDb();
    const current = await getGoalProfileFromDb(db);
    const next = normalizeGoalProfile(
      {
        ...(current ?? {}),
        ...draft,
      },
      new Date().toISOString(),
    );

    await db.runAsync(
      `
        INSERT OR REPLACE INTO goal_profile (
          id, primary_goal, secondary_goals_json, motivation, timeframe,
          experience_level, preferred_activities_json, disliked_activities_json,
          constraints_json, risk_flags_json, coaching_style, starting_strategy,
          confidence, updated_at
        )
        VALUES ('current', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      next.primaryGoal,
      safeJsonStringify(next.secondaryGoals),
      next.motivation,
      next.timeframe,
      next.experienceLevel,
      safeJsonStringify(next.preferredActivities),
      safeJsonStringify(next.dislikedActivities),
      safeJsonStringify(next.constraints),
      safeJsonStringify(next.riskFlags),
      next.coachingStyle,
      next.startingStrategy,
      next.confidence,
      next.updatedAt,
    );

    return next;
  });
}

export async function clearGoalProfile(): Promise<void> {
  await withStorageLock(async () => {
    const db = await getDb();
    await db.runAsync("DELETE FROM goal_profile WHERE id = 'current'");
  });
}

function isHealthConnectDailyAggregate(sample: HealthSample): boolean {
  return sample.sampleId.startsWith("health_connect:daily:");
}

function sleepReplacementKey(sleep: SleepSessionRecord): string {
  return `${sleep.platform}:${sleep.sourceApp ?? ""}:${sleep.wakeDate}`;
}

export async function upsertSyncPayload(payload: SyncPayload): Promise<number> {
  return withStorageLock(async () => {
    const db = await getDb();
    const importedAt = new Date().toISOString();

    await db.withExclusiveTransactionAsync(async (txn) => {
      const dailyAggregateReplacements = new Map<string, HealthSample>();
      payload.samples.forEach((sample) => {
        if (!isHealthConnectDailyAggregate(sample)) {
          return;
        }

        dailyAggregateReplacements.set(
          `${sample.platform}:${sample.canonicalType}:${sample.localDate}`,
          sample,
        );
      });

      for (const sample of dailyAggregateReplacements.values()) {
        await txn.runAsync(
          `
            DELETE FROM health_samples
            WHERE platform = ?
              AND canonical_type = ?
              AND local_date = ?
              AND sample_id LIKE 'health_connect:daily:%'
          `,
          sample.platform,
          sample.canonicalType,
          sample.localDate,
        );
      }

      const sleepSessionReplacements = new Map<string, SleepSessionRecord>();
      payload.sleepSessions.forEach((sleep) => {
        sleepSessionReplacements.set(sleepReplacementKey(sleep), sleep);
      });

      for (const sleep of sleepSessionReplacements.values()) {
        await txn.runAsync(
          `
          DELETE FROM sleep_sessions
          WHERE platform = ?
            AND COALESCE(source_app, '') = ?
            AND wake_date = ?
        `,
          sleep.platform,
          sleep.sourceApp ?? "",
          sleep.wakeDate,
        );
      }

      for (const sample of payload.samples) {
        await txn.runAsync(
          `
          INSERT OR REPLACE INTO health_samples (
            sample_id, platform, record_type, canonical_type, source_app, source_device,
            start_at, end_at, local_date, timezone, value, unit, hrv_method, metadata_json,
            source_modified_at, imported_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
          sample.sampleId,
          sample.platform,
          sample.recordType,
          sample.canonicalType,
          sample.sourceApp ?? null,
          sample.sourceDevice ?? null,
          sample.startAt,
          sample.endAt,
          sample.localDate,
          sample.timezone ?? null,
          sample.value ?? null,
          sample.unit ?? null,
          sample.hrvMethod ??
            hrvMethodForCanonicalType(sample.canonicalType) ??
            null,
          sample.metadataJson,
          sample.sourceModifiedAt ?? null,
          importedAt,
        );
      }

      for (const workout of payload.workouts) {
        await txn.runAsync(
          `
          INSERT OR REPLACE INTO workouts (
            workout_id, platform, source_app, start_at, end_at, local_date,
            name, activity_type, sport_bucket, elapsed_seconds, moving_seconds,
            distance_km, active_kcal, total_kcal, avg_hr_bpm, max_hr_bpm,
            route_available, laps_json, streams_json, raw_json, imported_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
          workout.workoutId,
          workout.platform,
          workout.sourceApp ?? null,
          workout.startAt,
          workout.endAt,
          workout.localDate,
          workout.name ?? null,
          workout.activityType ?? null,
          workout.sportBucket,
          workout.elapsedSeconds,
          workout.movingSeconds ?? null,
          workout.distanceKm ?? null,
          workout.activeKcal ?? null,
          workout.totalKcal ?? null,
          workout.avgHrBpm ?? null,
          workout.maxHrBpm ?? null,
          workout.routeAvailable ? 1 : 0,
          workout.lapsJson ?? null,
          workout.streamsJson ?? null,
          workout.rawJson,
          importedAt,
        );
      }

      for (const sleep of payload.sleepSessions) {
        await txn.runAsync(
          `
          INSERT OR REPLACE INTO sleep_sessions (
            sleep_id, platform, source_app, start_at, end_at, wake_date,
            sleep_seconds, time_in_bed_seconds, deep_sleep_seconds, light_sleep_seconds,
            rem_sleep_seconds, awake_seconds, sleep_stage_json, sleep_efficiency,
            wakeup_count, raw_json, imported_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
          sleep.sleepId,
          sleep.platform,
          sleep.sourceApp ?? null,
          sleep.startAt,
          sleep.endAt,
          sleep.wakeDate,
          sleep.sleepSeconds,
          sleep.timeInBedSeconds,
          sleep.deepSleepSeconds ?? null,
          sleep.lightSleepSeconds ?? null,
          sleep.remSleepSeconds ?? null,
          sleep.awakeSeconds ?? null,
          sleep.sleepStageJson ?? null,
          sleep.sleepEfficiency ?? null,
          sleep.wakeupCount ?? null,
          sleep.rawJson,
          importedAt,
        );
      }

      for (const nutrition of payload.nutritionDaily) {
        await txn.runAsync(
          `
          INSERT OR REPLACE INTO nutrition_daily (
            date, kcal_in, protein_g, carbs_g, fat_g, fiber_g, sugar_g,
            saturated_fat_g, monounsaturated_fat_g, polyunsaturated_fat_g,
            trans_fat_g, cholesterol_mg, water_ml, caffeine_mg, sodium_mg,
            potassium_mg, calcium_mg, iron_mg, magnesium_mg, zinc_mg,
            vitamin_a_mcg, vitamin_b6_mg, vitamin_b12_mcg, vitamin_c_mg,
            vitamin_d_mcg, vitamin_e_mg, vitamin_k_mcg, entry_count,
            meal_count, all_nutrients_json, source_modified_at, imported_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
          nutrition.date,
          nutrition.kcalIn ?? null,
          nutrition.proteinG ?? null,
          nutrition.carbsG ?? null,
          nutrition.fatG ?? null,
          nutrition.fiberG ?? null,
          nutrition.sugarG ?? null,
          nutrition.saturatedFatG ?? null,
          nutrition.monounsaturatedFatG ?? null,
          nutrition.polyunsaturatedFatG ?? null,
          nutrition.transFatG ?? null,
          nutrition.cholesterolMg ?? null,
          nutrition.waterMl ?? null,
          nutrition.caffeineMg ?? null,
          nutrition.sodiumMg ?? null,
          nutrition.potassiumMg ?? null,
          nutrition.calciumMg ?? null,
          nutrition.ironMg ?? null,
          nutrition.magnesiumMg ?? null,
          nutrition.zincMg ?? null,
          nutrition.vitaminAMcg ?? null,
          nutrition.vitaminB6Mg ?? null,
          nutrition.vitaminB12Mcg ?? null,
          nutrition.vitaminCMg ?? null,
          nutrition.vitaminDMcg ?? null,
          nutrition.vitaminEMg ?? null,
          nutrition.vitaminKMcg ?? null,
          nutrition.entryCount,
          nutrition.mealCount ?? null,
          nutrition.allNutrientsJson,
          nutrition.sourceModifiedAt ?? null,
          importedAt,
        );
      }

      for (const diagnostic of payload.diagnostics) {
        await txn.runAsync(
          `
          INSERT INTO health_connect_diagnostics (
            sync_started_at, record_type, canonical_type, permission, read_kind,
            records_read, samples_written, message
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
          importedAt,
          diagnostic.recordType,
          diagnostic.canonicalType,
          diagnostic.permission,
          diagnostic.readKind,
          diagnostic.recordsRead,
          diagnostic.samplesWritten,
          diagnostic.message ?? null,
        );
      }
    });

    await rebuildDailyMetrics();

    return (
      payload.samples.length +
      payload.workouts.length +
      payload.sleepSessions.length +
      payload.nutritionDaily.length
    );
  });
}

export async function recordSyncRun(
  provider: HealthProvider,
  range: SyncRange,
  sampleCount: number,
  startedAt: string,
  error?: unknown,
  details: SyncRunDetails = {},
): Promise<void> {
  await withStorageLock(async () => {
    const db = await getDb();
    const endedAt = new Date().toISOString();

    await db.runAsync(
      `
        INSERT INTO sync_runs (
          provider, sync_type, started_at, ended_at, range_start, range_end,
          sample_count, health_sample_count, workout_count, sleep_session_count,
          nutrition_day_count, warning_count, diagnostic_count, status, error
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      provider,
      details.syncType ?? "manual",
      startedAt,
      endedAt,
      range.startDate.toISOString(),
      range.endDate.toISOString(),
      sampleCount,
      details.healthSampleCount ?? sampleCount,
      details.workoutCount ?? 0,
      details.sleepSessionCount ?? 0,
      details.nutritionDayCount ?? 0,
      details.warningCount ?? 0,
      details.diagnosticCount ?? 0,
      error ? "error" : "ok",
      error ? String(error instanceof Error ? error.message : error) : null,
    );
  });
}

async function distinctMetricDates(
  db: SQLite.SQLiteDatabase,
): Promise<string[]> {
  const rows = await db.getAllAsync<{ date: string }>(`
    SELECT local_date AS date FROM health_samples
    UNION
    SELECT local_date AS date FROM workouts
    UNION
    SELECT wake_date AS date FROM sleep_sessions
    UNION
    SELECT date FROM nutrition_daily
    ORDER BY date DESC
  `);

  return rows.map((row) => row.date).filter(Boolean);
}

async function valueFor(
  db: SQLite.SQLiteDatabase,
  date: string,
  canonicalType: CanonicalType,
  aggregate: "SUM" | "AVG" | "MIN" | "MAX" = "SUM",
): Promise<number | undefined> {
  const row = await db.getFirstAsync<{ value: number | null }>(
    `
      SELECT ${aggregate}(value) AS value
      FROM health_samples
      WHERE local_date = ? AND canonical_type = ? AND value IS NOT NULL
    `,
    date,
    canonicalType,
  );

  return optionalNumber(row?.value);
}

async function singleSourceSumFor(
  db: SQLite.SQLiteDatabase,
  date: string,
  canonicalType: CanonicalType,
): Promise<number | undefined> {
  const row = await db.getFirstAsync<SourceValueRow>(
    `
      SELECT
        COALESCE(NULLIF(source_app, ''), NULLIF(source_device, ''), platform || ':' || record_type)
          AS source_key,
        CASE
          WHEN SUM(CASE WHEN sample_id LIKE 'health_connect:daily:%' THEN 1 ELSE 0 END) > 0
          THEN MAX(CASE WHEN sample_id LIKE 'health_connect:daily:%' THEN value ELSE NULL END)
          ELSE SUM(value)
        END AS value,
        COUNT(*) AS sample_count,
        MAX(end_at) AS latest_end_at,
        CASE WHEN instr(COALESCE(source_app, ''), ',') > 0 THEN 1 ELSE 0 END
          AS source_is_combined
      FROM health_samples
      WHERE local_date = ? AND canonical_type = ? AND value IS NOT NULL
      GROUP BY source_key
      HAVING SUM(value) IS NOT NULL
      ORDER BY source_is_combined ASC, value DESC, sample_count DESC, latest_end_at DESC, source_key ASC
      LIMIT 1
    `,
    date,
    canonicalType,
  );

  return optionalNumber(row?.value);
}

async function selectedSleepFor(
  db: SQLite.SQLiteDatabase,
  date: string,
): Promise<SleepRollupRow | null> {
  return db.getFirstAsync<SleepRollupRow>(
    `
      WITH source_rank AS (
        SELECT
          COALESCE(NULLIF(source_app, ''), platform) AS source_key,
          COUNT(DISTINCT wake_date) AS source_days,
          SUM(sleep_seconds) AS source_sleep_seconds
        FROM sleep_sessions
        GROUP BY source_key
      ),
      day_source AS (
        SELECT
          COALESCE(NULLIF(source_app, ''), platform) AS source_key,
          SUM(sleep_seconds) AS sleep_seconds,
          SUM(time_in_bed_seconds) AS time_in_bed_seconds,
          CASE
            WHEN SUM(time_in_bed_seconds) > 0
            THEN SUM(sleep_seconds) * 1.0 / SUM(time_in_bed_seconds)
            ELSE AVG(sleep_efficiency)
          END AS sleep_efficiency,
          COUNT(*) AS session_count,
          MAX(end_at) AS latest_end_at
        FROM sleep_sessions
        WHERE wake_date = ?
        GROUP BY source_key
        HAVING SUM(sleep_seconds) > 0
      )
      SELECT
        day_source.source_key,
        day_source.sleep_seconds,
        day_source.time_in_bed_seconds,
        day_source.sleep_efficiency,
        day_source.session_count,
        source_rank.source_days,
        day_source.latest_end_at
      FROM day_source
      LEFT JOIN source_rank ON source_rank.source_key = day_source.source_key
      ORDER BY
        source_rank.source_days DESC,
        day_source.sleep_seconds DESC,
        day_source.session_count DESC,
        day_source.latest_end_at DESC,
        day_source.source_key ASC
      LIMIT 1
    `,
    date,
  );
}

async function latestValueFor(
  db: SQLite.SQLiteDatabase,
  date: string,
  canonicalType: CanonicalType,
): Promise<number | undefined> {
  const row = await db.getFirstAsync<{ value: number | null }>(
    `
      SELECT value
      FROM health_samples
      WHERE local_date = ? AND canonical_type = ? AND value IS NOT NULL
      ORDER BY end_at DESC
      LIMIT 1
    `,
    date,
    canonicalType,
  );

  return optionalNumber(row?.value);
}

async function selectedHrvFor(
  db: SQLite.SQLiteDatabase,
  date: string,
): Promise<HrvRollupRow | null> {
  return db.getFirstAsync<HrvRollupRow>(
    `
      WITH hrv_samples AS (
        SELECT
          local_date,
          canonical_type,
          COALESCE(
            hrv_method,
            CASE canonical_type
              WHEN 'hrv_rmssd' THEN 'rmssd'
              WHEN 'hrv_sdnn' THEN 'sdnn'
            END
          ) AS hrv_method,
          COALESCE(NULLIF(source_app, ''), NULLIF(source_device, ''), platform || ':' || record_type)
            AS source_key,
          source_app,
          value,
          end_at
        FROM health_samples
        WHERE canonical_type IN ('hrv_rmssd', 'hrv_sdnn')
          AND value IS NOT NULL
      ),
      source_rank AS (
        SELECT
          source_key,
          canonical_type,
          hrv_method,
          COUNT(DISTINCT local_date) AS source_days
        FROM hrv_samples
        WHERE hrv_method IS NOT NULL
        GROUP BY source_key, canonical_type, hrv_method
      ),
      day_source AS (
        SELECT
          source_key,
          MAX(source_app) AS source_app,
          canonical_type,
          hrv_method,
          AVG(value) AS value,
          COUNT(*) AS sample_count,
          MAX(end_at) AS latest_end_at
        FROM hrv_samples
        WHERE local_date = ?
          AND hrv_method IS NOT NULL
        GROUP BY source_key, canonical_type, hrv_method
        HAVING AVG(value) IS NOT NULL
      )
      SELECT
        day_source.source_key,
        day_source.source_app,
        day_source.canonical_type,
        day_source.hrv_method,
        day_source.value,
        day_source.sample_count,
        source_rank.source_days,
        day_source.latest_end_at
      FROM day_source
      LEFT JOIN source_rank
        ON source_rank.source_key = day_source.source_key
        AND source_rank.canonical_type = day_source.canonical_type
        AND source_rank.hrv_method = day_source.hrv_method
      ORDER BY
        source_rank.source_days DESC,
        day_source.sample_count DESC,
        day_source.latest_end_at DESC,
        CASE day_source.canonical_type WHEN 'hrv_rmssd' THEN 0 ELSE 1 END ASC,
        day_source.source_key ASC
      LIMIT 1
    `,
    date,
  );
}

async function rebuildDailyMetrics(): Promise<void> {
  const db = await getDb();
  const dates = await distinctMetricDates(db);
  const generatedAt = new Date().toISOString();
  const today = localDateKey(new Date());

  await db.execAsync("DELETE FROM daily_metrics;");

  for (const date of dates) {
    const steps = await singleSourceSumFor(db, date, "steps");
    const activeKcal = await valueFor(db, date, "active_energy");
    const totalKcal = await valueFor(db, date, "total_energy");
    const distanceMeters = await valueFor(db, date, "distance");
    const heartRateAvg = await valueFor(db, date, "heart_rate", "AVG");
    const heartRateMin = await valueFor(db, date, "heart_rate", "MIN");
    const heartRateMax = await valueFor(db, date, "heart_rate", "MAX");
    const restingHr = await valueFor(db, date, "resting_heart_rate", "AVG");
    const hrv = await selectedHrvFor(db, date);
    const sleepFallback = await singleSourceSumFor(db, date, "sleep_session");
    const weightKg = await latestValueFor(db, date, "weight");
    const bodyFatPct = await latestValueFor(db, date, "body_fat");
    const leanBodyMassKg = await latestValueFor(db, date, "lean_body_mass");
    const vo2max = await latestValueFor(db, date, "vo2max");
    const sleep = await selectedSleepFor(db, date);

    const workoutRows = await db.getAllAsync<WorkoutRow>(
      `
        SELECT *
        FROM workouts
        WHERE local_date = ?
        ORDER BY start_at ASC
      `,
      date,
    );
    const workout = summarizeWorkouts(workoutRows);

    const nutrition = await db.getFirstAsync<{
      kcal_in: number | null;
      protein_g: number | null;
      carbs_g: number | null;
      fat_g: number | null;
      saturated_fat_g: number | null;
      monounsaturated_fat_g: number | null;
      polyunsaturated_fat_g: number | null;
      trans_fat_g: number | null;
      fiber_g: number | null;
      sugar_g: number | null;
      cholesterol_mg: number | null;
      caffeine_mg: number | null;
      sodium_mg: number | null;
      potassium_mg: number | null;
      calcium_mg: number | null;
      iron_mg: number | null;
      magnesium_mg: number | null;
      zinc_mg: number | null;
      vitamin_a_mcg: number | null;
      vitamin_b6_mg: number | null;
      vitamin_b12_mcg: number | null;
      vitamin_c_mg: number | null;
      vitamin_d_mcg: number | null;
      vitamin_e_mg: number | null;
      vitamin_k_mcg: number | null;
      water_ml: number | null;
    }>(
      `
        SELECT
          kcal_in, protein_g, carbs_g, fat_g, saturated_fat_g,
          monounsaturated_fat_g, polyunsaturated_fat_g, trans_fat_g,
          fiber_g, sugar_g, cholesterol_mg, caffeine_mg, sodium_mg,
          potassium_mg, calcium_mg, iron_mg, magnesium_mg, zinc_mg,
          vitamin_a_mcg, vitamin_b6_mg, vitamin_b12_mcg, vitamin_c_mg,
          vitamin_d_mcg, vitamin_e_mg, vitamin_k_mcg, water_ml
        FROM nutrition_daily
        WHERE date = ?
      `,
      date,
    );

    const daily = buildDailyMetricsRollup({
      date,
      today,
      generatedAt,
      steps,
      activeKcal,
      totalKcal,
      distanceMeters,
      sleep: sleep
        ? {
            sleepSeconds: sleep.sleep_seconds ?? undefined,
            timeInBedSeconds: sleep.time_in_bed_seconds ?? undefined,
            sleepEfficiency: sleep.sleep_efficiency ?? undefined,
          }
        : null,
      sleepFallbackSeconds: sleepFallback,
      restingHr,
      heartRateAvgBpm: heartRateAvg,
      heartRateMinBpm: heartRateMin,
      heartRateMaxBpm: heartRateMax,
      hrvLastNightAvg: optionalNumber(hrv?.value),
      hrvMethod: hrv?.hrv_method ?? undefined,
      hrvCanonicalType: hrv?.canonical_type ?? undefined,
      hrvSourceApp: hrv?.source_app ?? undefined,
      hrvSourceKey: hrv?.source_key ?? undefined,
      hrvSampleCount: optionalNumber(hrv?.sample_count),
      workout: {
        workoutCount: workout.workout_count,
        runWorkoutCount: workout.run_workout_count,
        rideWorkoutCount: workout.ride_workout_count,
        strengthWorkoutCount: workout.strength_workout_count,
        activityElapsedSeconds: workout.activity_elapsed_seconds ?? undefined,
        activityKcal: workout.activity_kcal ?? undefined,
      },
      nutrition: nutrition
        ? {
            kcalIn: nutrition.kcal_in ?? undefined,
            proteinG: nutrition.protein_g ?? undefined,
            carbsG: nutrition.carbs_g ?? undefined,
            fatG: nutrition.fat_g ?? undefined,
            saturatedFatG: nutrition.saturated_fat_g ?? undefined,
            monounsaturatedFatG: nutrition.monounsaturated_fat_g ?? undefined,
            polyunsaturatedFatG: nutrition.polyunsaturated_fat_g ?? undefined,
            transFatG: nutrition.trans_fat_g ?? undefined,
            fiberG: nutrition.fiber_g ?? undefined,
            sugarG: nutrition.sugar_g ?? undefined,
            cholesterolMg: nutrition.cholesterol_mg ?? undefined,
            caffeineMg: nutrition.caffeine_mg ?? undefined,
            sodiumMg: nutrition.sodium_mg ?? undefined,
            potassiumMg: nutrition.potassium_mg ?? undefined,
            calciumMg: nutrition.calcium_mg ?? undefined,
            ironMg: nutrition.iron_mg ?? undefined,
            magnesiumMg: nutrition.magnesium_mg ?? undefined,
            zincMg: nutrition.zinc_mg ?? undefined,
            vitaminAMcg: nutrition.vitamin_a_mcg ?? undefined,
            vitaminB6Mg: nutrition.vitamin_b6_mg ?? undefined,
            vitaminB12Mcg: nutrition.vitamin_b12_mcg ?? undefined,
            vitaminCMg: nutrition.vitamin_c_mg ?? undefined,
            vitaminDMcg: nutrition.vitamin_d_mcg ?? undefined,
            vitaminEMg: nutrition.vitamin_e_mg ?? undefined,
            vitaminKMcg: nutrition.vitamin_k_mcg ?? undefined,
            waterMl: nutrition.water_ml ?? undefined,
          }
        : null,
      weightKg,
      bodyFatPct,
      leanBodyMassKg,
      vo2max,
    });

    await db.runAsync(
      `
        INSERT OR REPLACE INTO daily_metrics (
          date, data_completeness, wellness_data_status, source_count,
          has_platform_wellness, has_activity, has_nutrition, has_sleep,
          has_steps, has_energy, steps, active_kcal, total_kcal, distance_km,
          sleep_seconds, time_in_bed_seconds, sleep_efficiency, resting_hr,
          heart_rate_avg_bpm, heart_rate_min_bpm, heart_rate_max_bpm,
          hrv_last_night_avg, hrv_method, hrv_canonical_type, hrv_source_app,
          hrv_source_key, hrv_sample_count, workout_count, run_workout_count,
          ride_workout_count, strength_workout_count, activity_elapsed_seconds,
          activity_kcal, kcal_in, protein_g, carbs_g, fat_g, fiber_g, sugar_g,
          saturated_fat_g, monounsaturated_fat_g, polyunsaturated_fat_g,
          trans_fat_g, cholesterol_mg, caffeine_mg, sodium_mg, potassium_mg,
          calcium_mg, iron_mg, magnesium_mg, zinc_mg, vitamin_a_mcg,
          vitamin_b6_mg, vitamin_b12_mcg, vitamin_c_mg, vitamin_d_mcg,
          vitamin_e_mg, vitamin_k_mcg,
          water_ml, weight_kg, body_fat_pct, lean_body_mass_kg, vo2max,
          generated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      daily.date,
      daily.dataCompleteness,
      daily.wellnessDataStatus,
      daily.sourceCount,
      daily.hasPlatformWellness ? 1 : 0,
      daily.hasActivity ? 1 : 0,
      daily.hasNutrition ? 1 : 0,
      daily.hasSleep ? 1 : 0,
      daily.hasSteps ? 1 : 0,
      daily.hasEnergy ? 1 : 0,
      daily.steps ?? null,
      daily.activeKcal ?? null,
      daily.totalKcal ?? null,
      daily.distanceKm ?? null,
      daily.sleepSeconds ?? null,
      daily.timeInBedSeconds ?? null,
      daily.sleepEfficiency ?? null,
      daily.restingHr ?? null,
      daily.heartRateAvgBpm ?? null,
      daily.heartRateMinBpm ?? null,
      daily.heartRateMaxBpm ?? null,
      daily.hrvLastNightAvg ?? null,
      daily.hrvMethod ?? null,
      daily.hrvCanonicalType ?? null,
      daily.hrvSourceApp ?? null,
      daily.hrvSourceKey ?? null,
      daily.hrvSampleCount ?? null,
      daily.workoutCount ?? null,
      daily.runWorkoutCount ?? null,
      daily.rideWorkoutCount ?? null,
      daily.strengthWorkoutCount ?? null,
      daily.activityElapsedSeconds ?? null,
      daily.activityKcal ?? null,
      daily.kcalIn ?? null,
      daily.proteinG ?? null,
      daily.carbsG ?? null,
      daily.fatG ?? null,
      daily.fiberG ?? null,
      daily.sugarG ?? null,
      daily.saturatedFatG ?? null,
      daily.monounsaturatedFatG ?? null,
      daily.polyunsaturatedFatG ?? null,
      daily.transFatG ?? null,
      daily.cholesterolMg ?? null,
      daily.caffeineMg ?? null,
      daily.sodiumMg ?? null,
      daily.potassiumMg ?? null,
      daily.calciumMg ?? null,
      daily.ironMg ?? null,
      daily.magnesiumMg ?? null,
      daily.zincMg ?? null,
      daily.vitaminAMcg ?? null,
      daily.vitaminB6Mg ?? null,
      daily.vitaminB12Mcg ?? null,
      daily.vitaminCMg ?? null,
      daily.vitaminDMcg ?? null,
      daily.vitaminEMg ?? null,
      daily.vitaminKMcg ?? null,
      daily.waterMl ?? null,
      daily.weightKg ?? null,
      daily.bodyFatPct ?? null,
      daily.leanBodyMassKg ?? null,
      daily.vo2max ?? null,
      daily.generatedAt,
    );
  }
}

function average(values: (number | undefined)[]): number | undefined {
  const filtered = values.filter((value): value is number => value != null);
  if (!filtered.length) {
    return undefined;
  }

  return filtered.reduce((sum, value) => sum + value, 0) / filtered.length;
}

function recommendationFreshnessGaps(
  sourceFreshness: SourceFreshness[],
): SourceFreshness[] {
  const importantDomains: SourceFreshnessDomain[] = [
    "sleep",
    "hrv",
    "resting_hr",
    "steps",
    "energy",
  ];

  return sourceFreshness.filter(
    (item) =>
      importantDomains.includes(item.domain) &&
      (item.state === "stale" ||
        item.state === "missing" ||
        item.state === "partial"),
  );
}

function sourceFreshnessPenalty(gaps: SourceFreshness[]): number {
  if (gaps.some((gap) => gap.state === "missing")) {
    return 10;
  }

  if (gaps.some((gap) => gap.state === "stale")) {
    return 7;
  }

  return gaps.length ? 3 : 0;
}

function buildCurrentTrainingLoadSnapshot(
  genericPlatformWorkoutCount = 0,
): TrainingLoadSnapshot {
  return buildTrainingLoadSnapshot({ genericPlatformWorkoutCount });
}

function deriveRecommendation(
  current: DailyMetrics | null,
  history: DailyMetrics[],
  sourceFreshness: SourceFreshness[] = [],
  trainingLoad: TrainingLoadSnapshot = buildCurrentTrainingLoadSnapshot(),
): CoachRecommendation {
  if (!current || current.sourceCount === 0) {
    const readinessStatus = buildReadinessStatus({
      score: null,
      signalsUsed: [],
      sourceFreshness,
    });

    return completeCoachRecommendation({
      readiness: null,
      readinessStatus,
      readinessLabel: readinessStatus.ui.label,
      color: readinessStatus.ui.color,
      title: readinessStatus.ui.title,
      detail: readinessStatus.ui.detail,
      reason: readinessStatus.ui.reason,
      opener: readinessStatus.ui.opener,
      strain: 0,
      strainTarget: "—",
    });
  }

  const baselineRows = history
    .filter((row) => row.date !== current.date)
    .slice(0, 14);
  const sleepHours = (current.sleepSeconds ?? 0) / 3600;
  const hrvBaseline = hrvBaselineFor(current, history);
  const rhrBaseline = average(baselineRows.map((row) => row.restingHr));
  const sleepBaseline = average(baselineRows.map((row) => row.sleepSeconds));
  const hrvDelta = hrvBaseline.delta;
  const rhrDelta =
    current.restingHr != null && rhrBaseline
      ? current.restingHr - rhrBaseline
      : undefined;
  const sleepDelta =
    current.sleepSeconds != null && sleepBaseline
      ? current.sleepSeconds - sleepBaseline
      : undefined;

  let readiness = 56;
  const readinessSignals: string[] = [];
  const contextSignals: string[] = [];
  const freshnessGaps = recommendationFreshnessGaps(sourceFreshness);
  const trainingLoadBoundary =
    recommendationBoundaryForTrainingLoad(trainingLoad);

  if (current.sleepSeconds != null) {
    if (sleepHours >= 7.5) {
      readiness += 18;
      readinessSignals.push(
        `sleep was ${formatDuration(current.sleepSeconds)}`,
      );
    } else if (sleepHours >= 6.5) {
      readiness += 8;
      readinessSignals.push(
        `sleep was adequate at ${formatDuration(current.sleepSeconds)}`,
      );
    } else if (sleepHours < 5.75) {
      readiness -= 20;
      readinessSignals.push(
        `sleep was short at ${formatDuration(current.sleepSeconds)}`,
      );
    }
  }

  if (hrvDelta != null) {
    if (hrvDelta > 8) {
      readiness += 16;
      readinessSignals.push(
        `${hrvMethodLabel(current.hrvMethod)} HRV is up ${Math.round(hrvDelta)} ms`,
      );
    } else if (hrvDelta < -8) {
      readiness -= 22;
      readinessSignals.push(
        `${hrvMethodLabel(current.hrvMethod)} HRV is down ${Math.abs(Math.round(hrvDelta))} ms`,
      );
    }
  } else if (
    current.hrvLastNightAvg != null &&
    hrvBaseline.status === "method_incompatible"
  ) {
    contextSignals.push(
      `${hrvMethodLabel(current.hrvMethod)} HRV is available, but incompatible HRV history was ignored`,
    );
  } else if (
    current.hrvLastNightAvg != null &&
    hrvBaseline.status === "insufficient_baseline"
  ) {
    contextSignals.push(
      `${hrvMethodLabel(current.hrvMethod)} HRV needs more matching history`,
    );
  }

  if (rhrDelta != null) {
    if (rhrDelta <= -3) {
      readiness += 8;
      readinessSignals.push(
        `resting HR is down ${Math.abs(Math.round(rhrDelta))} bpm`,
      );
    } else if (rhrDelta >= 6) {
      readiness -= 18;
      readinessSignals.push(`resting HR is up ${Math.round(rhrDelta)} bpm`);
    }
  }

  if ((current.activityElapsedSeconds ?? 0) > 5400) {
    readiness -= 8;
    readinessSignals.push("you already logged a long session today");
  }

  if (freshnessGaps.length) {
    const primaryGaps = freshnessGaps.slice(0, 2);
    const labels = primaryGaps.map(
      (gap) => `${gap.label.toLowerCase()} is ${gap.state}`,
    );
    readiness -= sourceFreshnessPenalty(freshnessGaps);
    contextSignals.push(
      `${labels.join(" and ")}, so this call is conservative`,
    );
  }

  if (!trainingLoadBoundary.canUseTrainingLoad) {
    contextSignals.push(trainingLoadBoundary.recommendationNote);
  }

  readiness = Math.max(20, Math.min(96, Math.round(readiness)));

  if (!readinessSignals.length && !contextSignals.length) {
    contextSignals.push(
      "Health Connect has partial data, so this is a conservative call",
    );
  }

  const readinessStatus = buildReadinessStatus({
    score: readiness,
    signalsUsed: readinessSignals,
    sourceFreshness,
  });
  const coachSignals = readinessSignals.length
    ? [...readinessSignals, ...contextSignals]
    : contextSignals.length
      ? contextSignals
      : [readinessStatus.ui.reason];

  if (readinessStatus.status === "unknown") {
    return completeCoachRecommendation(
      {
        readiness: readinessStatus.score,
        readinessStatus,
        readinessLabel: readinessStatus.ui.label,
        color: readinessStatus.ui.color,
        title: "Easy walk + mobility",
        detail: "20-30 min easy movement · optional mobility",
        reason: `${coachSignals.join(", ")}. Readiness is unknown, so today's call stays conservative.`,
        opener: `Readiness is unknown. ${coachSignals.join(", ")}. I would keep this easy until the recovery picture is clearer.`,
        strain: 4,
        strainTarget: "3-5",
      },
      { readinessSignals, contextSignals },
    );
  }

  if (readinessStatus.status === "red") {
    return completeCoachRecommendation(
      {
        readiness: readinessStatus.score,
        readinessStatus,
        readinessLabel: readinessStatus.ui.label,
        color: readinessStatus.ui.color,
        title: "Easy walk + mobility",
        detail: "30 min Z1 walk · 10 min hips and calves",
        reason: `${coachSignals.join(", ")}. Pushing hard today would reduce the odds of stacking the next session well.`,
        opener: `Honest check-in: ${coachSignals.join(", ")}. I would keep this soft and earn tomorrow.`,
        strain: 5.5,
        strainTarget: "4-7",
      },
      { readinessSignals, contextSignals },
    );
  }

  if (readinessStatus.status === "green" && (current.workoutCount ?? 0) === 0) {
    return completeCoachRecommendation(
      {
        readiness: readinessStatus.score,
        readinessStatus,
        readinessLabel: readinessStatus.ui.label,
        color: readinessStatus.ui.color,
        title: "Quality run",
        detail: "10 min easy · 4 x 5 min strong · cool down",
        reason: `${coachSignals.join(", ")}. Current recovery supports a harder aerobic stimulus.`,
        opener: `You're primed. ${coachSignals.join(", ")}. If you were waiting for a green light, this is it.`,
        strain: 13.5,
        strainTarget: "12-15",
      },
      { readinessSignals, contextSignals },
    );
  }

  return completeCoachRecommendation(
    {
      readiness: readinessStatus.score,
      readinessStatus,
      readinessLabel: readinessStatus.ui.label,
      color: readinessStatus.ui.color,
      title: "Aerobic base",
      detail: "45 min easy run or ride · stay conversational",
      reason: `${coachSignals.join(", ")}. This is a good day to add durable aerobic volume without forcing intensity.`,
      opener: `Solid baseline today. ${coachSignals.join(", ")}. Stack the work and keep it controlled.`,
      strain: 9.5,
      strainTarget: "8-11",
    },
    { readinessSignals, contextSignals },
  );
}

export async function getPipelineSnapshot(): Promise<PipelineSnapshot> {
  return withStorageLock(async () => {
    const db = await getDb();
    await rebuildDailyMetrics();

    const countRow = await db.getFirstAsync<{ total: number }>(
      "SELECT COUNT(*) AS total FROM health_samples",
    );
    const workoutRows = await db.getAllAsync<WorkoutRow>(
      "SELECT * FROM workouts ORDER BY start_at ASC",
    );
    const sleepCountRow = await db.getFirstAsync<{ total: number }>(
      "SELECT COUNT(*) AS total FROM daily_metrics WHERE has_sleep = 1",
    );
    const nutritionCountRow = await db.getFirstAsync<{ total: number }>(
      "SELECT COUNT(*) AS total FROM nutrition_daily",
    );
    const coverageRow = await db.getFirstAsync<{ total: number }>(
      "SELECT COUNT(*) AS total FROM daily_metrics WHERE source_count > 0",
    );
    const availabilityRows = await db.getAllAsync<MetricAvailabilityRow>(`
      SELECT
        canonical_type,
        COUNT(*) AS sample_count,
        COUNT(DISTINCT local_date) AS day_count,
        MAX(local_date) AS latest_date
      FROM health_samples
      GROUP BY canonical_type
    `);
    const dedupedWorkoutCount = dedupeWorkoutRows(workoutRows).length;
    const sleepCount = Number(sleepCountRow?.total ?? 0);
    const nutritionDays = Number(nutritionCountRow?.total ?? 0);
    const metricAvailability = buildMetricAvailability(
      availabilityRows,
      workoutRows,
      sleepCount,
      nutritionDays,
    );
    const diagnosticRows = await getLatestHealthConnectDiagnostics(db);
    const sourceFreshness = await getSourceFreshness(db);

    const rows = await db.getAllAsync<DailyMetricsRow>(`
      SELECT *
      FROM daily_metrics
      ORDER BY date DESC
      LIMIT 21
    `);
    const history = rows.map(toDailyMetrics);
    const todayKey = localDateKey(new Date());
    const today =
      history.find((row) => row.date === todayKey) ?? history[0] ?? null;
    const recentWorkouts = await getRecentWorkoutsFromDb(db, 5);
    const recentSamples = await getRecentSamplesFromDb(db, 12);
    const trainingLoad = buildCurrentTrainingLoadSnapshot(dedupedWorkoutCount);

    return {
      totalSamples: Number(countRow?.total ?? 0),
      workoutCount: dedupedWorkoutCount,
      sleepCount,
      nutritionDays,
      coverageDays: Number(coverageRow?.total ?? 0),
      metricAvailability,
      sourceFreshness,
      latestDiagnostics: diagnosticRows.map((row) => ({
        recordType: row.record_type,
        canonicalType: row.canonical_type,
        permission: row.permission,
        readKind: row.read_kind,
        recordsRead: Number(row.records_read),
        samplesWritten: Number(row.samples_written),
        message: row.message ?? undefined,
      })),
      today,
      history,
      recentWorkouts: recentWorkouts.map((row) => ({
        workoutId: row.workout_id,
        platform: row.platform,
        sourceApp: row.source_app ?? undefined,
        startAt: row.start_at,
        endAt: row.end_at,
        localDate: row.local_date,
        name: row.name ?? undefined,
        activityType: row.activity_type ?? undefined,
        sportBucket: row.sport_bucket,
        elapsedSeconds: row.elapsed_seconds,
        movingSeconds: row.moving_seconds ?? undefined,
        distanceKm: row.distance_km ?? undefined,
        activeKcal: row.active_kcal ?? undefined,
        totalKcal: row.total_kcal ?? undefined,
        avgHrBpm: row.avg_hr_bpm ?? undefined,
        maxHrBpm: row.max_hr_bpm ?? undefined,
        routeAvailable: Boolean(row.route_available),
        lapsJson: row.laps_json ?? undefined,
        streamsJson: row.streams_json ?? undefined,
        rawJson: row.raw_json,
      })),
      recentSamples: recentSamples.map((row) => ({
        sampleId: row.sample_id,
        platform: row.platform,
        recordType: row.record_type,
        canonicalType: row.canonical_type,
        sourceApp: row.source_app ?? undefined,
        sourceDevice: row.source_device ?? undefined,
        startAt: row.start_at,
        endAt: row.end_at,
        localDate: row.local_date,
        timezone: row.timezone ?? undefined,
        value: row.value ?? undefined,
        unit: row.unit ?? undefined,
        hrvMethod: row.hrv_method ?? undefined,
        metadataJson: row.metadata_json,
        sourceModifiedAt: row.source_modified_at ?? undefined,
      })),
      trainingLoad,
      recommendation: deriveRecommendation(
        today,
        history,
        sourceFreshness,
        trainingLoad,
      ),
    };
  });
}

export async function getLastSyncRun(): Promise<SyncRunRow | null> {
  return withStorageLock(async () => {
    const db = await getDb();
    return db.getFirstAsync<SyncRunRow>(
      "SELECT * FROM sync_runs ORDER BY id DESC LIMIT 1",
    );
  });
}

export async function getLastSuccessfulSyncRun(): Promise<SyncRunRow | null> {
  return withStorageLock(async () => {
    const db = await getDb();
    return db.getFirstAsync<SyncRunRow>(
      "SELECT * FROM sync_runs WHERE status = 'ok' ORDER BY ended_at DESC, id DESC LIMIT 1",
    );
  });
}

export async function getRecentSyncRuns(limit = 6): Promise<SyncRunRow[]> {
  return withStorageLock(async () => {
    const db = await getDb();
    return db.getAllAsync<SyncRunRow>(
      "SELECT * FROM sync_runs ORDER BY ended_at DESC, id DESC LIMIT ?",
      limit,
    );
  });
}

export async function getCoachHealthContext({
  rebuildDaily = true,
}: {
  rebuildDaily?: boolean;
} = {}): Promise<CoachHealthContext> {
  return withStorageLock(async () => {
    const db = await getDb();
    if (rebuildDaily) {
      await rebuildDailyMetrics();
    }

    const healthSamples = await db.getFirstAsync<TableCountRow>(`
      SELECT COUNT(*) AS total, MIN(local_date) AS first_date, MAX(local_date) AS latest_date
      FROM health_samples
    `);
    const sleepSessions = await db.getFirstAsync<TableCountRow>(`
      SELECT COUNT(*) AS total, MIN(wake_date) AS first_date, MAX(wake_date) AS latest_date
      FROM sleep_sessions
    `);
    const workouts = await db.getFirstAsync<TableCountRow>(`
      SELECT COUNT(*) AS total, MIN(local_date) AS first_date, MAX(local_date) AS latest_date
      FROM workouts
    `);
    const nutritionDaily = await db.getFirstAsync<TableCountRow>(`
      SELECT COUNT(*) AS total, MIN(date) AS first_date, MAX(date) AS latest_date
      FROM nutrition_daily
    `);
    const dailyMetrics = await db.getFirstAsync<TableCountRow>(`
      SELECT COUNT(*) AS total, MIN(date) AS first_date, MAX(date) AS latest_date
      FROM daily_metrics
      WHERE source_count > 0
    `);
    const syncRunSummary = await db.getFirstAsync<{ total: number }>(
      "SELECT COUNT(*) AS total FROM sync_runs",
    );
    const latestSync = await db.getFirstAsync<SyncRunRow>(
      "SELECT * FROM sync_runs ORDER BY ended_at DESC LIMIT 1",
    );
    const availabilityRows = await db.getAllAsync<MetricAvailabilityRow>(`
      SELECT
        canonical_type,
        COUNT(*) AS sample_count,
        COUNT(DISTINCT local_date) AS day_count,
        MAX(local_date) AS latest_date
      FROM health_samples
      GROUP BY canonical_type
    `);
    const latestSamples = await db.getAllAsync<LatestSampleByTypeRow>(`
      SELECT canonical_type, record_type, source_app, local_date, start_at, value, unit, hrv_method
      FROM (
        SELECT
          canonical_type,
          record_type,
          source_app,
          local_date,
          start_at,
          value,
          unit,
          hrv_method,
          ROW_NUMBER() OVER (
            PARTITION BY canonical_type
            ORDER BY start_at DESC, imported_at DESC
          ) AS rank
        FROM health_samples
      )
      WHERE rank = 1
      ORDER BY canonical_type ASC
    `);
    const dailyRows = await db.getAllAsync<DailyMetricsRow>(`
      SELECT *
      FROM daily_metrics
      WHERE source_count > 0
      ORDER BY date DESC
      LIMIT 14
    `);
    const workoutRows = await db.getAllAsync<WorkoutRow>(
      "SELECT * FROM workouts ORDER BY start_at DESC",
    );
    const sourceFreshness = await getSourceFreshness(db);

    const healthSampleCount = Number(healthSamples?.total ?? 0);
    const sleepSessionCount = Number(sleepSessions?.total ?? 0);
    const workoutCount = Number(workouts?.total ?? 0);
    const nutritionDayCount = Number(nutritionDaily?.total ?? 0);
    const dailyMetricCount = Number(dailyMetrics?.total ?? 0);
    const hasSyncedHealthData = Boolean(
      healthSampleCount ||
      sleepSessionCount ||
      workoutCount ||
      nutritionDayCount ||
      dailyMetricCount,
    );
    const metricAvailability = buildMetricAvailability(
      availabilityRows,
      workoutRows,
      sleepSessionCount,
      nutritionDayCount,
    );
    const recentWorkouts = dedupeWorkoutRows(workoutRows).slice(0, 8);

    return {
      generatedAt: new Date().toISOString(),
      hasSyncedHealthData,
      sqliteTables: {
        healthSamples: healthSamples ?? {
          total: 0,
          first_date: null,
          latest_date: null,
        },
        sleepSessions: sleepSessions ?? {
          total: 0,
          first_date: null,
          latest_date: null,
        },
        workouts: workouts ?? { total: 0, first_date: null, latest_date: null },
        nutritionDaily: nutritionDaily ?? {
          total: 0,
          first_date: null,
          latest_date: null,
        },
        dailyMetrics: dailyMetrics ?? {
          total: 0,
          first_date: null,
          latest_date: null,
        },
        syncRuns: {
          total: Number(syncRunSummary?.total ?? 0),
          latestEndedAt: latestSync?.ended_at ?? null,
          latestStatus: latestSync?.status ?? null,
          latestSampleCount: latestSync?.sample_count ?? null,
          latestRangeStart: latestSync?.range_start ?? null,
          latestRangeEnd: latestSync?.range_end ?? null,
        },
      },
      metricAvailability,
      sourceFreshness,
      latestSamplesByType: latestSamples.map((sample) => ({
        canonicalType: sample.canonical_type,
        recordType: sample.record_type,
        sourceApp: sample.source_app ?? undefined,
        localDate: sample.local_date,
        startAt: sample.start_at,
        value: sample.value ?? undefined,
        unit: sample.unit ?? undefined,
        hrvMethod: sample.hrv_method ?? undefined,
      })),
      recentDailyMetrics: dailyRows.map(toDailyMetrics),
      recentWorkouts: recentWorkouts.map((workout) => ({
        localDate: workout.local_date,
        name: workout.name ?? undefined,
        activityType: workout.activity_type ?? undefined,
        sportBucket: workout.sport_bucket,
        elapsedSeconds: workout.elapsed_seconds,
        distanceKm: workout.distance_km ?? undefined,
        activeKcal: workout.active_kcal ?? undefined,
        avgHrBpm: workout.avg_hr_bpm ?? undefined,
        sourceApp: workout.source_app ?? undefined,
      })),
      coachDataInstruction: hasSyncedHealthData
        ? "SQLite contains synced health data. Do not tell the user there is no synced health data. If a specific metric is missing, name that exact missing metric instead."
        : "SQLite has no synced health rows yet. Ask the user to sync a health source before making data-dependent claims.",
    };
  });
}

async function getRecentSamplesFromDb(
  db: SQLite.SQLiteDatabase,
  limit = 12,
): Promise<HealthSampleRow[]> {
  return db.getAllAsync<HealthSampleRow>(
    `
      SELECT *
      FROM health_samples
      ORDER BY start_at DESC
      LIMIT ?
    `,
    limit,
  );
}

async function getRecentWorkoutsFromDb(
  db: SQLite.SQLiteDatabase,
  limit = 5,
): Promise<WorkoutRow[]> {
  const rows = await db.getAllAsync<WorkoutRow>(
    `
      SELECT *
      FROM workouts
      ORDER BY start_at DESC
    `,
  );

  return dedupeWorkoutRows(rows).slice(0, limit);
}

export async function getRecentSamples(limit = 12): Promise<HealthSampleRow[]> {
  return withStorageLock(async () =>
    getRecentSamplesFromDb(await getDb(), limit),
  );
}

export async function getRecentWorkouts(limit = 5): Promise<WorkoutRow[]> {
  return withStorageLock(async () =>
    getRecentWorkoutsFromDb(await getDb(), limit),
  );
}

export async function clearPipeline(): Promise<void> {
  await withStorageLock(async () => {
    const db = await getDb();
    await db.execAsync(`
      DELETE FROM health_samples;
      DELETE FROM sleep_sessions;
      DELETE FROM workouts;
      DELETE FROM nutrition_daily;
      DELETE FROM daily_metrics;
      DELETE FROM sync_runs;
      DELETE FROM health_connect_diagnostics;
    `);
  });
}

export async function exportPipelineArtifacts(): Promise<PipelineExportResult> {
  const pipelineSnapshot = await getPipelineSnapshot();

  return withStorageLock(async () => {
    const db = await getDb();
    const samples = await db.getAllAsync<HealthSampleRow>(
      "SELECT * FROM health_samples ORDER BY start_at ASC",
    );
    const sleepSessions = await db.getAllAsync<SleepSessionRow>(
      "SELECT * FROM sleep_sessions ORDER BY start_at ASC",
    );
    const workouts = await db.getAllAsync<WorkoutRow>(
      "SELECT * FROM workouts ORDER BY start_at ASC",
    );
    const nutritionDaily = await db.getAllAsync(
      "SELECT * FROM nutrition_daily ORDER BY date ASC",
    );
    const dailyMetrics = await db.getAllAsync<DailyMetricsRow>(
      "SELECT * FROM daily_metrics ORDER BY date ASC",
    );
    const syncRuns = await db.getAllAsync<SyncRunRow>(
      "SELECT * FROM sync_runs ORDER BY started_at ASC",
    );
    const diagnostics = await db.getAllAsync(
      "SELECT * FROM health_connect_diagnostics ORDER BY sync_started_at ASC",
    );
    const sourceFreshness = await getSourceFreshness(db);
    const goalProfileRow = await db.getFirstAsync<GoalProfileRow>(
      "SELECT * FROM goal_profile WHERE id = 'current' LIMIT 1",
    );
    const exportArtifacts = buildPipelineExportArtifacts(pipelineSnapshot);
    const exportedAt = exportArtifacts.exportedAt;
    const goalProfile = goalProfileRow ? toGoalProfile(goalProfileRow) : null;
    const riskFlags = extractRiskFlagsFromCoachRequest({
      generated_at: exportedAt,
      goal_profile: goalProfile ?? undefined,
    });

    const payload = {
      schema: "biostream_training_pipeline.v5",
      exportedAt,
      samples,
      sleepSessions,
      workouts,
      nutritionDaily,
      dailyMetrics,
      sourceFreshness,
      syncRuns,
      diagnostics,
      goalProfile,
      riskFlags,
      trainingLoad: toTrainingLoadExport(pipelineSnapshot.trainingLoad),
    };

    const directory = FileSystem.documentDirectory;
    if (!directory) {
      throw new Error(
        "No writable document directory is available on this device.",
      );
    }

    const jsonFileUri = `${directory}${exportArtifacts.jsonFileName}`;
    const healthCheckFileUri = `${directory}${exportArtifacts.healthCheckFileName}`;
    await Promise.all([
      FileSystem.writeAsStringAsync(jsonFileUri, safeJsonStringify(payload), {
        encoding: FileSystem.EncodingType.UTF8,
      }),
      FileSystem.writeAsStringAsync(
        healthCheckFileUri,
        exportArtifacts.healthCheckMarkdown,
        {
          encoding: FileSystem.EncodingType.UTF8,
        },
      ),
    ]);

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(jsonFileUri, {
        mimeType: "application/json",
        dialogTitle: "Export BioStream pipeline JSON",
      });
      await Sharing.shareAsync(healthCheckFileUri, {
        mimeType: "text/markdown",
        dialogTitle: "Export BioStream health_check.md",
      });
    }

    return { jsonFileUri, healthCheckFileUri };
  });
}

export async function exportPipelineJson(): Promise<string> {
  const result = await exportPipelineArtifacts();
  return result.jsonFileUri;
}
