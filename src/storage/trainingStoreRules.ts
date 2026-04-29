import { localDateKey } from '../lib/dates';
import type { CanonicalType, DailyMetrics, HealthProvider } from '../health/types';

export type DailyWorkoutRollup = {
  workoutCount: number;
  runWorkoutCount: number;
  rideWorkoutCount: number;
  strengthWorkoutCount: number;
  activityElapsedSeconds?: number;
  activityKcal?: number;
};

export type DailyNutritionRollup = {
  kcalIn?: number;
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
  fiberG?: number;
  sugarG?: number;
  waterMl?: number;
};

export type DailySleepRollup = {
  sleepSeconds?: number;
  timeInBedSeconds?: number;
  sleepEfficiency?: number;
};

export type DailyMetricsRollupInput = {
  date: string;
  today: string;
  generatedAt: string;
  providerLabel?: string;
  steps?: number;
  activeKcal?: number;
  totalKcal?: number;
  distanceMeters?: number;
  sleep?: DailySleepRollup | null;
  sleepFallbackSeconds?: number;
  restingHr?: number;
  heartRateAvgBpm?: number;
  heartRateMinBpm?: number;
  heartRateMaxBpm?: number;
  hrvLastNightAvg?: number;
  workout: DailyWorkoutRollup;
  nutrition?: DailyNutritionRollup | null;
  weightKg?: number;
  bodyFatPct?: number;
  leanBodyMassKg?: number;
  vo2max?: number;
};

export type LegacyHealthSampleRow = {
  id: string;
  provider: string;
  metric: string;
  source_name: string | null;
  source_id: string | null;
  start_time: string;
  end_time: string;
  value: number | null;
  unit: string | null;
  raw_json: string;
  synced_at: string;
};

export type NormalizedLegacyHealthSample = {
  sampleId: string;
  platform: HealthProvider;
  recordType: string;
  canonicalType: CanonicalType;
  sourceApp: string | null;
  sourceDevice: string | null;
  startAt: string;
  endAt: string;
  localDate: string;
  value: number | null;
  unit: string | null;
  metadataJson: string;
  importedAt: string;
};

function optionalNumber(value: number | null | undefined): number | undefined {
  return value == null ? undefined : Number(value);
}

function hasValue(value: number | null | undefined): boolean {
  return value != null;
}

export function buildDailyMetricsRollup(input: DailyMetricsRollupInput): DailyMetrics {
  const sleepSeconds = input.sleep?.sleepSeconds ?? input.sleepFallbackSeconds;
  const timeInBedSeconds = input.sleep?.timeInBedSeconds ?? input.sleepFallbackSeconds;
  const hasSleep = hasValue(sleepSeconds);
  const hasActivity = input.workout.workoutCount > 0;
  const hasNutrition = Boolean(input.nutrition);
  const hasSteps = hasValue(input.steps);
  const hasEnergy = hasValue(input.activeKcal) || hasValue(input.totalKcal);
  const hasVitals = [
    input.restingHr,
    input.hrvLastNightAvg,
    input.heartRateAvgBpm,
    input.weightKg,
    input.bodyFatPct,
  ].some(hasValue);
  const hasPlatformWellness = hasSleep || hasVitals;
  const sourceCount = [
    hasPlatformWellness,
    hasActivity,
    hasNutrition,
    hasSteps,
    hasEnergy,
  ].filter(Boolean).length;
  const dataCompleteness =
    input.date === input.today
      ? 'partial'
      : sourceCount >= 4
        ? 'full'
        : sourceCount > 0
          ? 'partial'
          : 'empty';
  const wellnessDataStatus = sourceCount
    ? `${input.providerLabel ?? 'Health Connect'} ${dataCompleteness}`
    : 'No platform data';

  return {
    date: input.date,
    dataCompleteness,
    wellnessDataStatus,
    sourceCount,
    hasPlatformWellness,
    hasActivity,
    hasNutrition,
    hasSleep,
    hasSteps,
    hasEnergy,
    steps: optionalNumber(input.steps),
    activeKcal: optionalNumber(input.activeKcal),
    totalKcal: optionalNumber(input.totalKcal),
    distanceKm: input.distanceMeters == null ? undefined : input.distanceMeters / 1000,
    sleepSeconds: optionalNumber(sleepSeconds),
    timeInBedSeconds: optionalNumber(timeInBedSeconds),
    sleepEfficiency: optionalNumber(input.sleep?.sleepEfficiency),
    restingHr: optionalNumber(input.restingHr),
    heartRateAvgBpm: optionalNumber(input.heartRateAvgBpm),
    heartRateMinBpm: optionalNumber(input.heartRateMinBpm),
    heartRateMaxBpm: optionalNumber(input.heartRateMaxBpm),
    hrvLastNightAvg: optionalNumber(input.hrvLastNightAvg),
    workoutCount: input.workout.workoutCount,
    runWorkoutCount: input.workout.runWorkoutCount,
    rideWorkoutCount: input.workout.rideWorkoutCount,
    strengthWorkoutCount: input.workout.strengthWorkoutCount,
    activityElapsedSeconds: optionalNumber(input.workout.activityElapsedSeconds),
    activityKcal: optionalNumber(input.workout.activityKcal),
    kcalIn: optionalNumber(input.nutrition?.kcalIn),
    proteinG: optionalNumber(input.nutrition?.proteinG),
    carbsG: optionalNumber(input.nutrition?.carbsG),
    fatG: optionalNumber(input.nutrition?.fatG),
    fiberG: optionalNumber(input.nutrition?.fiberG),
    sugarG: optionalNumber(input.nutrition?.sugarG),
    waterMl: optionalNumber(input.nutrition?.waterMl),
    weightKg: optionalNumber(input.weightKg),
    bodyFatPct: optionalNumber(input.bodyFatPct),
    leanBodyMassKg: optionalNumber(input.leanBodyMassKg),
    vo2max: optionalNumber(input.vo2max),
    generatedAt: input.generatedAt,
  };
}

export function normalizeLegacyHealthSampleRow(
  row: LegacyHealthSampleRow,
): NormalizedLegacyHealthSample {
  return {
    sampleId: row.id,
    platform: (row.provider === 'apple_health' ? 'healthkit' : row.provider) as HealthProvider,
    recordType: row.metric,
    canonicalType: row.metric as CanonicalType,
    sourceApp: row.source_name,
    sourceDevice: row.source_id,
    startAt: row.start_time,
    endAt: row.end_time,
    localDate: localDateKey(row.start_time),
    value: row.value,
    unit: row.unit,
    metadataJson: row.raw_json,
    importedAt: row.synced_at,
  };
}
