import { localDateKey } from '../lib/dates';
import type {
  CanonicalType,
  DailyMetrics,
  HealthProvider,
  HrvBaselineStatus,
  HrvCanonicalType,
  HrvMethod,
} from '../health/types';

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
  saturatedFatG?: number;
  monounsaturatedFatG?: number;
  polyunsaturatedFatG?: number;
  transFatG?: number;
  fiberG?: number;
  sugarG?: number;
  cholesterolMg?: number;
  caffeineMg?: number;
  sodiumMg?: number;
  potassiumMg?: number;
  calciumMg?: number;
  ironMg?: number;
  magnesiumMg?: number;
  zincMg?: number;
  vitaminAMcg?: number;
  vitaminB6Mg?: number;
  vitaminB12Mcg?: number;
  vitaminCMg?: number;
  vitaminDMcg?: number;
  vitaminEMg?: number;
  vitaminKMcg?: number;
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
  hrvMethod?: HrvMethod;
  hrvCanonicalType?: HrvCanonicalType;
  hrvSourceApp?: string;
  hrvSourceKey?: string;
  hrvSampleCount?: number;
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
  hrvMethod: HrvMethod | null;
  metadataJson: string;
  importedAt: string;
};

const hrvMethodByCanonicalType: Partial<Record<CanonicalType, HrvMethod>> = {
  hrv_rmssd: 'rmssd',
  hrv_sdnn: 'sdnn',
};

function optionalNumber(value: number | null | undefined): number | undefined {
  return value == null ? undefined : Number(value);
}

function hasValue(value: number | null | undefined): boolean {
  return value != null;
}

function average(values: number[]): number | undefined {
  if (!values.length) {
    return undefined;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function hrvMethodForCanonicalType(type: CanonicalType): HrvMethod | undefined {
  return hrvMethodByCanonicalType[type];
}

export function hrvMethodLabel(method?: HrvMethod): string {
  if (method === 'rmssd') return 'RMSSD';
  if (method === 'sdnn') return 'SDNN';
  return 'HRV';
}

type HrvComparableDay = Pick<
  DailyMetrics,
  'date' | 'hrvLastNightAvg' | 'hrvMethod' | 'hrvCanonicalType' | 'hrvSourceKey'
>;

export type HrvBaselineResult = {
  status: HrvBaselineStatus;
  baseline?: number;
  delta?: number;
  compatibleDays: number;
  incompatibleDays: number;
  method?: HrvMethod;
  canonicalType?: HrvCanonicalType;
  sourceKey?: string;
};

function hasCompatibleHrvKey(current: HrvComparableDay, candidate: HrvComparableDay): boolean {
  if (candidate.hrvLastNightAvg == null) {
    return false;
  }

  if (
    !current.hrvMethod ||
    !candidate.hrvMethod ||
    current.hrvMethod !== candidate.hrvMethod
  ) {
    return false;
  }

  if (
    current.hrvCanonicalType &&
    candidate.hrvCanonicalType &&
    current.hrvCanonicalType !== candidate.hrvCanonicalType
  ) {
    return false;
  }

  if (current.hrvSourceKey || candidate.hrvSourceKey) {
    return current.hrvSourceKey === candidate.hrvSourceKey;
  }

  return true;
}

export function hrvBaselineFor(
  current: HrvComparableDay | null | undefined,
  history: HrvComparableDay[],
  maxDays = 14,
): HrvBaselineResult {
  if (current?.hrvLastNightAvg == null || !current.hrvMethod) {
    return {
      status: 'missing_current',
      compatibleDays: 0,
      incompatibleDays: 0,
    };
  }

  const baselineRows = history.filter((row) => row.date !== current.date).slice(0, maxDays);
  const hrvRows = baselineRows.filter((row) => row.hrvLastNightAvg != null);
  const compatibleRows = hrvRows.filter((row) => hasCompatibleHrvKey(current, row));
  const incompatibleDays = hrvRows.length - compatibleRows.length;
  const baseline = average(compatibleRows.map((row) => row.hrvLastNightAvg as number));

  if (baseline == null) {
    return {
      status: incompatibleDays ? 'method_incompatible' : 'insufficient_baseline',
      compatibleDays: 0,
      incompatibleDays,
      method: current.hrvMethod,
      canonicalType: current.hrvCanonicalType,
      sourceKey: current.hrvSourceKey,
    };
  }

  return {
    status: 'compatible',
    baseline,
    delta: current.hrvLastNightAvg - baseline,
    compatibleDays: compatibleRows.length,
    incompatibleDays,
    method: current.hrvMethod,
    canonicalType: current.hrvCanonicalType,
    sourceKey: current.hrvSourceKey,
  };
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
    hrvMethod: input.hrvMethod,
    hrvCanonicalType: input.hrvCanonicalType,
    hrvSourceApp: input.hrvSourceApp,
    hrvSourceKey: input.hrvSourceKey,
    hrvSampleCount: optionalNumber(input.hrvSampleCount),
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
    saturatedFatG: optionalNumber(input.nutrition?.saturatedFatG),
    monounsaturatedFatG: optionalNumber(input.nutrition?.monounsaturatedFatG),
    polyunsaturatedFatG: optionalNumber(input.nutrition?.polyunsaturatedFatG),
    transFatG: optionalNumber(input.nutrition?.transFatG),
    fiberG: optionalNumber(input.nutrition?.fiberG),
    sugarG: optionalNumber(input.nutrition?.sugarG),
    cholesterolMg: optionalNumber(input.nutrition?.cholesterolMg),
    caffeineMg: optionalNumber(input.nutrition?.caffeineMg),
    sodiumMg: optionalNumber(input.nutrition?.sodiumMg),
    potassiumMg: optionalNumber(input.nutrition?.potassiumMg),
    calciumMg: optionalNumber(input.nutrition?.calciumMg),
    ironMg: optionalNumber(input.nutrition?.ironMg),
    magnesiumMg: optionalNumber(input.nutrition?.magnesiumMg),
    zincMg: optionalNumber(input.nutrition?.zincMg),
    vitaminAMcg: optionalNumber(input.nutrition?.vitaminAMcg),
    vitaminB6Mg: optionalNumber(input.nutrition?.vitaminB6Mg),
    vitaminB12Mcg: optionalNumber(input.nutrition?.vitaminB12Mcg),
    vitaminCMg: optionalNumber(input.nutrition?.vitaminCMg),
    vitaminDMcg: optionalNumber(input.nutrition?.vitaminDMcg),
    vitaminEMg: optionalNumber(input.nutrition?.vitaminEMg),
    vitaminKMcg: optionalNumber(input.nutrition?.vitaminKMcg),
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
    hrvMethod: hrvMethodForCanonicalType(row.metric as CanonicalType) ?? null,
    metadataJson: row.raw_json,
    importedAt: row.synced_at,
  };
}
