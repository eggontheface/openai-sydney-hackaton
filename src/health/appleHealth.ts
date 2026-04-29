import {
  CategoryValueSleepAnalysis,
  WorkoutActivityType,
  isHealthDataAvailable,
  isObjectTypeAvailable,
  queryCategorySamples,
  queryQuantitySamples,
  queryWorkoutSamples,
  requestAuthorization,
} from '@kingstinct/react-native-healthkit';
import type {
  CategorySampleTyped,
  CategoryTypeIdentifier,
  QuantitySampleTyped,
  QuantityTypeIdentifier,
  SampleTypeIdentifier,
  WorkoutProxyTyped,
} from '@kingstinct/react-native-healthkit';

import { localDateKey, secondsBetween } from '../lib/dates';
import { safeJsonStringify } from '../lib/json';
import type {
  CanonicalType,
  HealthConnectReadDiagnostic,
  HealthSample,
  NutritionDailyRecord,
  SleepSessionRecord,
  SportBucket,
  SyncRange,
  SyncResult,
  WorkoutRecord,
} from './types';

type HealthKitReadableType = QuantityTypeIdentifier | CategoryTypeIdentifier | 'HKWorkoutTypeIdentifier';

type HealthKitReadConfig = {
  identifier: HealthKitReadableType;
  canonicalType: CanonicalType;
  readKind: HealthConnectReadDiagnostic['readKind'];
};

type HealthKitQuantityConfig = HealthKitReadConfig & {
  identifier: QuantityTypeIdentifier;
  unit: string;
  nutritionField?: NutritionNumberField;
  nutrientKey?: string;
  metadata?: Record<string, unknown>;
};

type HealthKitSourceSample = {
  uuid: string;
  startDate: Date | string;
  endDate: Date | string;
  sourceRevision?: {
    source?: {
      name?: string;
      bundleIdentifier?: string;
    };
    version?: string;
    operatingSystemVersion?: string;
    productType?: string;
  };
  device?: {
    name?: string;
    manufacturer?: string;
    model?: string;
  };
};

type NutritionNumberField =
  | 'kcalIn'
  | 'proteinG'
  | 'carbsG'
  | 'fatG'
  | 'fiberG'
  | 'sugarG'
  | 'cholesterolMg'
  | 'waterMl'
  | 'caffeineMg'
  | 'sodiumMg';

type NutritionAccumulator = Omit<
  NutritionDailyRecord,
  'entryCount' | 'allNutrientsJson'
> & {
  entryCount: number;
  records: unknown[];
  allNutrients: Record<string, number>;
};

type SleepStageName = 'in_bed' | 'asleep' | 'light' | 'deep' | 'rem' | 'awake';

type SleepInterval = {
  sample: CategorySampleTyped<'HKCategoryTypeIdentifierSleepAnalysis'>;
  sourceKey: string;
  sourceApp: string | undefined;
  sourceName: string | undefined;
  startAt: string;
  endAt: string;
  stage: SleepStageName;
};

const sleepCategoryIdentifier = 'HKCategoryTypeIdentifierSleepAnalysis' as const;
const workoutIdentifier = 'HKWorkoutTypeIdentifier' as const;
const sleepSessionGapMs = 4 * 60 * 60 * 1000;

const quantityConfigs: HealthKitQuantityConfig[] = [
  {
    identifier: 'HKQuantityTypeIdentifierStepCount',
    canonicalType: 'steps',
    readKind: 'records',
    unit: 'count',
  },
  {
    identifier: 'HKQuantityTypeIdentifierActiveEnergyBurned',
    canonicalType: 'active_energy',
    readKind: 'records',
    unit: 'kcal',
  },
  {
    identifier: 'HKQuantityTypeIdentifierDistanceWalkingRunning',
    canonicalType: 'distance',
    readKind: 'records',
    unit: 'm',
  },
  {
    identifier: 'HKQuantityTypeIdentifierHeartRate',
    canonicalType: 'heart_rate',
    readKind: 'records',
    unit: 'count/min',
  },
  {
    identifier: 'HKQuantityTypeIdentifierRestingHeartRate',
    canonicalType: 'resting_heart_rate',
    readKind: 'records',
    unit: 'count/min',
  },
  {
    identifier: 'HKQuantityTypeIdentifierHeartRateVariabilitySDNN',
    canonicalType: 'hrv_sdnn',
    readKind: 'records',
    unit: 'ms',
    metadata: {
      hrvMethod: 'SDNN',
      hrvMethodSource: 'Apple HealthKit heartRateVariabilitySDNN',
    },
  },
  {
    identifier: 'HKQuantityTypeIdentifierVO2Max',
    canonicalType: 'vo2max',
    readKind: 'records',
    unit: 'ml/(kg*min)',
  },
  {
    identifier: 'HKQuantityTypeIdentifierBodyMass',
    canonicalType: 'weight',
    readKind: 'records',
    unit: 'kg',
  },
  {
    identifier: 'HKQuantityTypeIdentifierBodyFatPercentage',
    canonicalType: 'body_fat',
    readKind: 'records',
    unit: '%',
  },
  {
    identifier: 'HKQuantityTypeIdentifierLeanBodyMass',
    canonicalType: 'lean_body_mass',
    readKind: 'records',
    unit: 'kg',
  },
  {
    identifier: 'HKQuantityTypeIdentifierDietaryEnergyConsumed',
    canonicalType: 'nutrition',
    readKind: 'records',
    unit: 'kcal',
    nutritionField: 'kcalIn',
    nutrientKey: 'energyKcal',
  },
  {
    identifier: 'HKQuantityTypeIdentifierDietaryProtein',
    canonicalType: 'nutrition',
    readKind: 'records',
    unit: 'g',
    nutritionField: 'proteinG',
    nutrientKey: 'proteinG',
  },
  {
    identifier: 'HKQuantityTypeIdentifierDietaryCarbohydrates',
    canonicalType: 'nutrition',
    readKind: 'records',
    unit: 'g',
    nutritionField: 'carbsG',
    nutrientKey: 'carbsG',
  },
  {
    identifier: 'HKQuantityTypeIdentifierDietaryFatTotal',
    canonicalType: 'nutrition',
    readKind: 'records',
    unit: 'g',
    nutritionField: 'fatG',
    nutrientKey: 'fatG',
  },
  {
    identifier: 'HKQuantityTypeIdentifierDietaryFiber',
    canonicalType: 'nutrition',
    readKind: 'records',
    unit: 'g',
    nutritionField: 'fiberG',
    nutrientKey: 'fiberG',
  },
  {
    identifier: 'HKQuantityTypeIdentifierDietarySugar',
    canonicalType: 'nutrition',
    readKind: 'records',
    unit: 'g',
    nutritionField: 'sugarG',
    nutrientKey: 'sugarG',
  },
  {
    identifier: 'HKQuantityTypeIdentifierDietaryCholesterol',
    canonicalType: 'nutrition',
    readKind: 'records',
    unit: 'mg',
    nutritionField: 'cholesterolMg',
    nutrientKey: 'cholesterolMg',
  },
  {
    identifier: 'HKQuantityTypeIdentifierDietaryCaffeine',
    canonicalType: 'nutrition',
    readKind: 'records',
    unit: 'mg',
    nutritionField: 'caffeineMg',
    nutrientKey: 'caffeineMg',
  },
  {
    identifier: 'HKQuantityTypeIdentifierDietarySodium',
    canonicalType: 'nutrition',
    readKind: 'records',
    unit: 'mg',
    nutritionField: 'sodiumMg',
    nutrientKey: 'sodiumMg',
  },
  {
    identifier: 'HKQuantityTypeIdentifierDietaryWater',
    canonicalType: 'hydration',
    readKind: 'records',
    unit: 'mL',
    nutritionField: 'waterMl',
    nutrientKey: 'waterMl',
  },
];

const sleepConfig: HealthKitReadConfig = {
  identifier: sleepCategoryIdentifier,
  canonicalType: 'sleep_session',
  readKind: 'records',
};

const workoutConfig: HealthKitReadConfig = {
  identifier: workoutIdentifier,
  canonicalType: 'workout',
  readKind: 'records',
};

const readConfigs: HealthKitReadConfig[] = [
  ...quantityConfigs,
  sleepConfig,
  workoutConfig,
];

function iso(value: Date | string): string {
  return new Date(value).toISOString();
}

function numeric(value: unknown): number | undefined {
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function sourceName(sample: HealthKitSourceSample): string | undefined {
  return sample.sourceRevision?.source?.name;
}

function sourceId(sample: HealthKitSourceSample): string | undefined {
  return sample.sourceRevision?.source?.bundleIdentifier;
}

function sourceDevice(sample: HealthKitSourceSample): string | undefined {
  const device = sample.device;
  const deviceLabel = [device?.manufacturer, device?.model]
    .filter(Boolean)
    .join(' ')
    .trim();

  return deviceLabel || device?.name || sample.sourceRevision?.productType;
}

function sourceKey(sample: HealthKitSourceSample): string {
  return sourceId(sample) ?? sourceName(sample) ?? 'apple_health';
}

function rawObject(sample: unknown): unknown {
  if (
    typeof sample === 'object' &&
    sample !== null &&
    'toJSON' in sample &&
    typeof (sample as { toJSON?: unknown }).toJSON === 'function'
  ) {
    return (sample as { toJSON: () => unknown }).toJSON();
  }

  return sample;
}

function metadataJson(sample: unknown, extra?: Record<string, unknown>): string {
  const raw = rawObject(sample);

  return safeJsonStringify({
    ...(typeof raw === 'object' && raw !== null ? raw : { raw }),
    healthKit: extra,
  });
}

function updateDiagnostic(
  diagnostics: HealthConnectReadDiagnostic[],
  config: HealthKitReadConfig,
  values: Partial<Pick<HealthConnectReadDiagnostic, 'permission' | 'recordsRead' | 'samplesWritten' | 'message'>>,
) {
  const diagnostic = diagnostics.find(
    (item) => item.recordType === config.identifier && item.readKind === config.readKind,
  );
  if (!diagnostic) {
    return;
  }

  Object.assign(diagnostic, values);
}

function messageFromError(error: unknown): string {
  return String(error instanceof Error ? error.message : error);
}

function isReadableTypeAvailable(
  identifier: HealthKitReadableType,
): { available: boolean; message?: string } {
  try {
    if (isObjectTypeAvailable(identifier as SampleTypeIdentifier)) {
      return { available: true };
    }

    return {
      available: false,
      message: `${identifier} is not available on this iOS version or device.`,
    };
  } catch (error) {
    return {
      available: false,
      message: `${identifier} availability check failed: ${messageFromError(error)}`,
    };
  }
}

function quantitySample(
  config: HealthKitQuantityConfig,
  record: QuantitySampleTyped<QuantityTypeIdentifier>,
): HealthSample {
  return {
    sampleId: `healthkit:${config.canonicalType}:${record.uuid}`,
    platform: 'healthkit',
    recordType: config.identifier,
    canonicalType: config.canonicalType,
    sourceApp: sourceId(record) ?? sourceName(record),
    sourceDevice: sourceDevice(record),
    startAt: iso(record.startDate),
    endAt: iso(record.endDate),
    localDate: localDateKey(record.startDate),
    value: numeric(record.quantity),
    unit: record.unit ?? config.unit,
    metadataJson: metadataJson(record, {
      quantityIdentifier: config.identifier,
      ...config.metadata,
    }),
  };
}

function addNumber(
  accumulator: NutritionAccumulator,
  field: NutritionNumberField,
  value?: number,
) {
  if (value == null) {
    return;
  }

  const current = Number(accumulator[field] ?? 0);
  (accumulator as Record<string, unknown>)[field] = current + value;
}

function getNutritionAccumulator(
  map: Map<string, NutritionAccumulator>,
  date: string,
): NutritionAccumulator {
  const existing = map.get(date);
  if (existing) {
    return existing;
  }

  const next: NutritionAccumulator = {
    date,
    entryCount: 0,
    records: [],
    allNutrients: {},
  };
  map.set(date, next);
  return next;
}

function addNutritionRecord(
  map: Map<string, NutritionAccumulator>,
  config: HealthKitQuantityConfig,
  record: QuantitySampleTyped<QuantityTypeIdentifier>,
) {
  if (!config.nutritionField && !config.nutrientKey) {
    return;
  }

  const value = numeric(record.quantity);
  if (value == null) {
    return;
  }

  const accumulator = getNutritionAccumulator(map, localDateKey(record.startDate));
  accumulator.entryCount += 1;
  accumulator.records.push({
    identifier: config.identifier,
    value,
    unit: record.unit ?? config.unit,
    sample: rawObject(record),
  });

  if (config.nutritionField) {
    addNumber(accumulator, config.nutritionField, value);
  }

  if (config.nutrientKey) {
    accumulator.allNutrients[config.nutrientKey] =
      (accumulator.allNutrients[config.nutrientKey] ?? 0) + value;
  }
}

function finalizeNutrition(records: Map<string, NutritionAccumulator>): NutritionDailyRecord[] {
  return [...records.values()]
    .sort((left, right) => left.date.localeCompare(right.date))
    .map(({ records: rawRecords, allNutrients, ...record }) => ({
      ...record,
      allNutrientsJson: safeJsonStringify({
        totals: allNutrients,
        records: rawRecords,
      }),
    }));
}

function sleepStageName(value: number): SleepStageName | undefined {
  if (value === CategoryValueSleepAnalysis.inBed) return 'in_bed';
  if (value === CategoryValueSleepAnalysis.awake) return 'awake';
  if (value === CategoryValueSleepAnalysis.asleepDeep) return 'deep';
  if (value === CategoryValueSleepAnalysis.asleepREM) return 'rem';
  if (value === CategoryValueSleepAnalysis.asleepCore) return 'light';
  if (value === CategoryValueSleepAnalysis.asleepUnspecified) return 'asleep';

  return undefined;
}

function unionSeconds(intervals: { startAt: string; endAt: string }[]): number {
  const sorted = intervals
    .map((interval) => ({
      start: new Date(interval.startAt).getTime(),
      end: new Date(interval.endAt).getTime(),
    }))
    .filter((interval) => Number.isFinite(interval.start) && interval.end > interval.start)
    .sort((left, right) => left.start - right.start);

  let total = 0;
  let currentStart: number | undefined;
  let currentEnd: number | undefined;

  for (const interval of sorted) {
    if (currentStart == null || currentEnd == null) {
      currentStart = interval.start;
      currentEnd = interval.end;
      continue;
    }

    if (interval.start > currentEnd) {
      total += currentEnd - currentStart;
      currentStart = interval.start;
      currentEnd = interval.end;
      continue;
    }

    currentEnd = Math.max(currentEnd, interval.end);
  }

  if (currentStart != null && currentEnd != null) {
    total += currentEnd - currentStart;
  }

  return total / 1000;
}

function buildSleepSession(intervals: SleepInterval[]): SleepSessionRecord {
  const sorted = intervals
    .slice()
    .sort((left, right) => left.startAt.localeCompare(right.startAt));
  const startAt = sorted[0].startAt;
  const endAt = sorted.reduce(
    (latest, interval) => (interval.endAt > latest ? interval.endAt : latest),
    sorted[0].endAt,
  );
  const sourceApp = sorted[0].sourceApp ?? sorted[0].sourceName;
  const inBedIntervals = sorted.filter((interval) => interval.stage === 'in_bed');
  const awakeIntervals = sorted.filter((interval) => interval.stage === 'awake');
  const asleepIntervals = sorted.filter((interval) =>
    ['asleep', 'light', 'deep', 'rem'].includes(interval.stage),
  );
  const deepIntervals = sorted.filter((interval) => interval.stage === 'deep');
  const remIntervals = sorted.filter((interval) => interval.stage === 'rem');
  const lightIntervals = sorted.filter((interval) =>
    ['asleep', 'light'].includes(interval.stage),
  );
  const timeInBedSeconds =
    unionSeconds(inBedIntervals) || unionSeconds(sorted) || secondsBetween(startAt, endAt);
  const awakeSeconds = unionSeconds(awakeIntervals);
  const measuredSleepSeconds = unionSeconds(asleepIntervals);
  const sleepSeconds = measuredSleepSeconds || Math.max(0, timeInBedSeconds - awakeSeconds);
  const stageJson = sorted.map((interval) => ({
    stage: interval.stage,
    value: interval.sample.value,
    startAt: interval.startAt,
    endAt: interval.endAt,
    durationSeconds: secondsBetween(interval.startAt, interval.endAt),
    sourceApp: interval.sourceApp,
    sourceName: interval.sourceName,
  }));

  return {
    sleepId: `healthkit:sleep:${sorted[0].sourceKey}:${startAt}:${endAt}`,
    platform: 'healthkit',
    sourceApp,
    startAt,
    endAt,
    wakeDate: localDateKey(endAt),
    sleepSeconds,
    timeInBedSeconds,
    deepSleepSeconds: unionSeconds(deepIntervals) || undefined,
    lightSleepSeconds: unionSeconds(lightIntervals) || undefined,
    remSleepSeconds: unionSeconds(remIntervals) || undefined,
    awakeSeconds: awakeSeconds || undefined,
    sleepStageJson: safeJsonStringify(stageJson),
    sleepEfficiency: timeInBedSeconds ? sleepSeconds / timeInBedSeconds : undefined,
    wakeupCount: awakeIntervals.length || undefined,
    rawJson: safeJsonStringify(sorted.map((interval) => rawObject(interval.sample))),
  };
}

function normalizeSleepSessions(
  records: readonly CategorySampleTyped<'HKCategoryTypeIdentifierSleepAnalysis'>[],
): SleepSessionRecord[] {
  const intervals = records
    .map((record) => {
      const stage = sleepStageName(Number(record.value));
      if (!stage) {
        return undefined;
      }

      const startAt = iso(record.startDate);
      const endAt = iso(record.endDate);
      if (new Date(endAt).getTime() <= new Date(startAt).getTime()) {
        return undefined;
      }

      return {
        sample: record,
        sourceKey: sourceKey(record),
        sourceApp: sourceId(record),
        sourceName: sourceName(record),
        startAt,
        endAt,
        stage,
      };
    })
    .filter((interval): interval is SleepInterval => Boolean(interval));

  const bySource = new Map<string, SleepInterval[]>();
  intervals.forEach((interval) => {
    bySource.set(interval.sourceKey, [...(bySource.get(interval.sourceKey) ?? []), interval]);
  });

  const sessions: SleepSessionRecord[] = [];
  bySource.forEach((sourceIntervals) => {
    const sorted = sourceIntervals
      .slice()
      .sort((left, right) => left.startAt.localeCompare(right.startAt));
    let current: SleepInterval[] = [];
    let currentEnd = 0;

    for (const interval of sorted) {
      const start = new Date(interval.startAt).getTime();
      const end = new Date(interval.endAt).getTime();
      if (current.length && start - currentEnd > sleepSessionGapMs) {
        sessions.push(buildSleepSession(current));
        current = [];
      }

      current.push(interval);
      currentEnd = Math.max(currentEnd, end);
    }

    if (current.length) {
      sessions.push(buildSleepSession(current));
    }
  });

  return sessions.sort((left, right) => left.startAt.localeCompare(right.startAt));
}

function workoutActivityName(value?: WorkoutActivityType | number): string | undefined {
  if (value == null) {
    return undefined;
  }

  return Object.entries(WorkoutActivityType).find(
    ([, candidate]) => typeof candidate === 'number' && candidate === value,
  )?.[0];
}

function sportBucket(type?: WorkoutActivityType | number, title?: string): SportBucket {
  const normalized = `${workoutActivityName(type) ?? ''} ${title ?? ''}`.toLowerCase();

  if (normalized.includes('running')) return 'run';
  if (normalized.includes('biking') || normalized.includes('cycling')) return 'ride';
  if (
    normalized.includes('strength') ||
    normalized.includes('weight') ||
    normalized.includes('barre') ||
    normalized.includes('core')
  ) {
    return 'strength';
  }
  if (normalized.includes('swimming')) return 'swim';
  if (normalized.includes('walking')) return 'walk';

  return 'other';
}

async function workoutHeartRateStats(
  workout: WorkoutProxyTyped,
): Promise<Pick<WorkoutRecord, 'avgHrBpm' | 'maxHrBpm'>> {
  try {
    const stats = await workout.getStatistic('HKQuantityTypeIdentifierHeartRate', 'count/min');

    return {
      avgHrBpm: numeric(stats?.averageQuantity?.quantity),
      maxHrBpm: numeric(stats?.maximumQuantity?.quantity),
    };
  } catch {
    return {};
  }
}

async function parseWorkout(workout: WorkoutProxyTyped): Promise<WorkoutRecord> {
  const raw = rawObject(workout) as WorkoutProxyTyped;
  const startAt = iso(workout.startDate);
  const endAt = iso(workout.endDate);
  const elapsedSeconds = numeric(workout.duration?.quantity) ?? secondsBetween(startAt, endAt);
  const activityType = workoutActivityName(workout.workoutActivityType);
  const heartRateStats = await workoutHeartRateStats(workout);

  return {
    workoutId: `healthkit:workout:${workout.uuid}`,
    platform: 'healthkit',
    sourceApp: sourceId(workout) ?? sourceName(workout),
    startAt,
    endAt,
    localDate: localDateKey(startAt),
    name: typeof workout.metadata?.HKWorkoutBrandName === 'string'
      ? workout.metadata.HKWorkoutBrandName
      : activityType,
    activityType: activityType ?? String(workout.workoutActivityType ?? 'unknown'),
    sportBucket: sportBucket(workout.workoutActivityType, activityType),
    elapsedSeconds,
    distanceKm: numeric(workout.totalDistance?.quantity) != null
      ? Number(workout.totalDistance?.quantity) / 1000
      : undefined,
    activeKcal: numeric(workout.totalEnergyBurned?.quantity),
    routeAvailable: false,
    rawJson: metadataJson(raw, {
      workoutIdentifier,
      workoutActivityType: activityType,
    }),
    ...heartRateStats,
  };
}

function workoutSample(workout: WorkoutProxyTyped, workoutRecord: WorkoutRecord): HealthSample {
  return {
    sampleId: `healthkit:workout:${workout.uuid}`,
    platform: 'healthkit',
    recordType: workoutIdentifier,
    canonicalType: 'workout',
    startAt: workoutRecord.startAt,
    endAt: workoutRecord.endAt,
    localDate: workoutRecord.localDate,
    value: workoutRecord.elapsedSeconds / 60,
    unit: 'min',
    sourceApp: sourceId(workout) ?? sourceName(workout),
    sourceDevice: sourceDevice(workout),
    metadataJson: metadataJson(workout, {
      workoutIdentifier,
      workoutActivityType: workoutRecord.activityType,
    }),
  };
}

function sleepSample(sleep: SleepSessionRecord): HealthSample {
  return {
    sampleId: sleep.sleepId,
    platform: 'healthkit',
    recordType: sleepCategoryIdentifier,
    canonicalType: 'sleep_session',
    sourceApp: sleep.sourceApp,
    startAt: sleep.startAt,
    endAt: sleep.endAt,
    localDate: sleep.wakeDate,
    value: sleep.sleepSeconds,
    unit: 's',
    metadataJson: sleep.rawJson,
  };
}

export async function syncAppleHealth(range: SyncRange): Promise<SyncResult> {
  if (!isHealthDataAvailable()) {
    throw new Error('HealthKit data is not available on this device.');
  }

  const samples: HealthSample[] = [];
  const workouts: WorkoutRecord[] = [];
  const sleepSessions: SleepSessionRecord[] = [];
  const nutrition = new Map<string, NutritionAccumulator>();
  const warnings: string[] = [];
  const diagnostics: HealthConnectReadDiagnostic[] = readConfigs.map((config) => ({
    recordType: config.identifier,
    canonicalType: config.canonicalType,
    permission: 'granted',
    readKind: config.readKind,
    recordsRead: 0,
    samplesWritten: 0,
  }));

  const availableReadTypes: HealthKitReadableType[] = [];
  for (const config of readConfigs) {
    const availability = isReadableTypeAvailable(config.identifier);
    if (availability.available) {
      availableReadTypes.push(config.identifier);
      continue;
    }

    updateDiagnostic(diagnostics, config, {
      permission: 'missing',
      message: availability.message,
    });
    warnings.push(availability.message ?? `${config.identifier} is unavailable.`);
  }

  const authorizationGranted = availableReadTypes.length
    ? await requestAuthorization({
        toRead: Array.from(new Set(availableReadTypes)),
      })
    : false;
  if (availableReadTypes.length && !authorizationGranted) {
    warnings.push('HealthKit authorization did not grant every requested read type.');
  }

  for (const config of quantityConfigs) {
    const diagnostic = diagnostics.find(
      (item) => item.recordType === config.identifier && item.permission === 'granted',
    );
    if (!diagnostic) {
      continue;
    }

    try {
      const records = await queryQuantitySamples(config.identifier, {
        ascending: true,
        limit: 2000,
        unit: config.unit as never,
        filter: {
          date: {
            startDate: range.startDate,
            endDate: range.endDate,
          },
        },
      });
      let samplesWritten = 0;

      for (const record of records) {
        samples.push(quantitySample(config, record));
        addNutritionRecord(nutrition, config, record);
        samplesWritten += 1;
      }

      updateDiagnostic(diagnostics, config, {
        recordsRead: records.length,
        samplesWritten,
        message: records.length
          ? undefined
          : 'Permission granted, but no HealthKit samples returned in range.',
      });
    } catch (error) {
      const message = messageFromError(error);
      updateDiagnostic(diagnostics, config, { message });
      warnings.push(`${config.canonicalType}: ${message}`);
    }
  }

  if (diagnostics.find((item) => item.recordType === sleepCategoryIdentifier)?.permission === 'granted') {
    try {
      const records = await queryCategorySamples(sleepCategoryIdentifier, {
        ascending: true,
        limit: 2000,
        filter: {
          date: {
            startDate: range.startDate,
            endDate: range.endDate,
          },
        },
      });
      const normalized = normalizeSleepSessions(records);
      sleepSessions.push(...normalized);
      samples.push(...normalized.map(sleepSample));
      updateDiagnostic(diagnostics, sleepConfig, {
        recordsRead: records.length,
        samplesWritten: normalized.length,
        message: records.length
          ? undefined
          : 'Permission granted, but no HealthKit sleep analysis samples returned in range.',
      });
    } catch (error) {
      const message = messageFromError(error);
      updateDiagnostic(diagnostics, sleepConfig, { message });
      warnings.push(`sleep_session: ${message}`);
    }
  }

  if (diagnostics.find((item) => item.recordType === workoutIdentifier)?.permission === 'granted') {
    try {
      const records = await queryWorkoutSamples({
        ascending: true,
        limit: 1000,
        filter: {
          date: {
            startDate: range.startDate,
            endDate: range.endDate,
          },
        },
      });

      for (const workout of records) {
        const parsed = await parseWorkout(workout);
        workouts.push(parsed);
        samples.push(workoutSample(workout, parsed));
      }

      updateDiagnostic(diagnostics, workoutConfig, {
        recordsRead: records.length,
        samplesWritten: records.length,
        message: records.length
          ? undefined
          : 'Permission granted, but no HealthKit workouts returned in range.',
      });
    } catch (error) {
      const message = messageFromError(error);
      updateDiagnostic(diagnostics, workoutConfig, { message });
      warnings.push(`workout: ${message}`);
    }
  }

  return {
    provider: 'healthkit',
    samples,
    workouts,
    sleepSessions,
    nutritionDaily: finalizeNutrition(nutrition),
    diagnostics,
    warnings,
  };
}
