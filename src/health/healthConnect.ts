import {
  aggregateGroupByDuration,
  ExerciseType,
  getSdkStatus,
  initialize,
  openHealthConnectSettings,
  readRecords,
  requestPermission,
  SdkAvailabilityStatus,
  SleepStageType,
} from 'react-native-health-connect';
import type {
  AggregateResultRecordType,
  Permission,
  RecordResult,
  RecordType,
} from 'react-native-health-connect';

import { localDateKey, secondsBetween } from '../lib/dates';
import { safeJsonStringify } from '../lib/json';
import type {
  CanonicalType,
  HealthSample,
  NutritionDailyRecord,
  SleepSessionRecord,
  SportBucket,
  SyncRange,
  SyncResult,
  WorkoutRecord,
} from './types';

type HealthConnectRecordConfig = {
  recordType: RecordType;
  canonicalType: CanonicalType;
};

const aggregateConfigs: HealthConnectRecordConfig[] = [
  { recordType: 'Steps', canonicalType: 'steps' },
  { recordType: 'ActiveCaloriesBurned', canonicalType: 'active_energy' },
  { recordType: 'TotalCaloriesBurned', canonicalType: 'total_energy' },
  { recordType: 'Distance', canonicalType: 'distance' },
  { recordType: 'HeartRate', canonicalType: 'heart_rate' },
];

const rawRecordConfigs: HealthConnectRecordConfig[] = [
  { recordType: 'ExerciseSession', canonicalType: 'workout' },
  { recordType: 'SleepSession', canonicalType: 'sleep_session' },
  { recordType: 'RestingHeartRate', canonicalType: 'resting_heart_rate' },
  { recordType: 'HeartRateVariabilityRmssd', canonicalType: 'hrv_rmssd' },
  { recordType: 'Weight', canonicalType: 'weight' },
  { recordType: 'BodyFat', canonicalType: 'body_fat' },
  { recordType: 'LeanBodyMass', canonicalType: 'lean_body_mass' },
  { recordType: 'Nutrition', canonicalType: 'nutrition' },
  { recordType: 'Hydration', canonicalType: 'hydration' },
  { recordType: 'Vo2Max', canonicalType: 'vo2max' },
];

const permissions: Permission[] = [...aggregateConfigs, ...rawRecordConfigs].map((config) => ({
  accessType: 'read',
  recordType: config.recordType,
}));

const readTimeoutMs = 12000;
const maxPagesPerType = 4;
const pageSize = 1000;

type RecordMetadata = {
  id?: string;
  dataOrigin?: string;
  lastModifiedTime?: string;
  device?: {
    manufacturer?: string;
    model?: string;
    type?: number;
  };
};

type TimedRecord = {
  metadata?: RecordMetadata;
  time?: string;
  startTime?: string;
  endTime?: string;
};

type NutritionAccumulator = Omit<
  NutritionDailyRecord,
  'entryCount' | 'allNutrientsJson'
> & {
  entryCount: number;
  records: unknown[];
  allNutrients: Record<string, number>;
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

function recordStart(record: TimedRecord): string {
  return record.startTime ?? record.time ?? new Date().toISOString();
}

function recordEnd(record: TimedRecord): string {
  return record.endTime ?? record.time ?? recordStart(record);
}

function sourceDevice(metadata?: RecordMetadata): string | undefined {
  if (!metadata?.device) {
    return undefined;
  }

  return [metadata.device.manufacturer, metadata.device.model]
    .filter(Boolean)
    .join(' ')
    .trim();
}

function providerId(recordType: RecordType, record: { metadata?: RecordMetadata }, index: number) {
  return (
    record.metadata?.id ??
    `${recordType}:${record.metadata?.dataOrigin ?? 'unknown'}:${index}`
  );
}

function healthSample({
  recordType,
  canonicalType,
  record,
  index,
  value,
  unit,
  startAt,
  endAt,
  metadata,
}: {
  recordType: RecordType | string;
  canonicalType: CanonicalType;
  record: unknown;
  index: number | string;
  value?: number;
  unit?: string;
  startAt?: string;
  endAt?: string;
  metadata?: RecordMetadata;
}): HealthSample {
  const timed = record as TimedRecord;
  const resolvedStart = startAt ?? recordStart(timed);
  const resolvedEnd = endAt ?? endAt ?? recordEnd(timed);

  return {
    sampleId: `health_connect:${recordType}:${metadata?.id ?? index}:${resolvedStart}`,
    platform: 'health_connect',
    recordType: `${recordType}Record`,
    canonicalType,
    sourceApp: metadata?.dataOrigin,
    sourceDevice: sourceDevice(metadata),
    startAt: resolvedStart,
    endAt: resolvedEnd,
    localDate: localDateKey(resolvedStart),
    value,
    unit,
    metadataJson: safeJsonStringify(record),
    sourceModifiedAt: metadata?.lastModifiedTime,
  };
}

function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`${label} timed out after ${readTimeoutMs / 1000}s`));
    }, readTimeoutMs);

    promise
      .then(resolve)
      .catch(reject)
      .finally(() => clearTimeout(timeout));
  });
}

async function readAllRecords<T extends RecordType>(
  recordType: T,
  range: SyncRange,
): Promise<RecordResult<T>[]> {
  const records: RecordResult<T>[] = [];
  let pageToken: string | undefined;
  let page = 0;

  do {
    page += 1;
    const response = await withTimeout(
      readRecords(recordType, {
        timeRangeFilter: {
          operator: 'between',
          startTime: range.startDate.toISOString(),
          endTime: range.endDate.toISOString(),
        },
        ascendingOrder: true,
        pageSize,
        pageToken,
      }),
      `${recordType} page ${page}`,
    );

    records.push(...response.records);
    pageToken = response.pageToken;

    if (pageToken && page >= maxPagesPerType) {
      throw new Error(`${recordType} hit the ${maxPagesPerType * pageSize} record safety cap`);
    }
  } while (pageToken);

  return records;
}

async function readDailyAggregates<T extends AggregateResultRecordType>(
  recordType: T,
  range: SyncRange,
) {
  return withTimeout(
    aggregateGroupByDuration({
      recordType,
      timeRangeFilter: {
        operator: 'between',
        startTime: range.startDate.toISOString(),
        endTime: range.endDate.toISOString(),
      },
      timeRangeSlicer: {
        duration: 'DAYS',
        length: 1,
      },
    }),
    `${recordType} daily aggregate`,
  );
}

function exerciseTypeName(value?: number): string | undefined {
  if (value == null) {
    return undefined;
  }

  return Object.entries(ExerciseType).find(([, candidate]) => candidate === value)?.[0];
}

function sportBucket(type?: number, title?: string): SportBucket {
  const normalized = `${exerciseTypeName(type) ?? ''} ${title ?? ''}`.toLowerCase();

  if (normalized.includes('running')) return 'run';
  if (normalized.includes('biking') || normalized.includes('cycling')) return 'ride';
  if (
    normalized.includes('strength') ||
    normalized.includes('weight') ||
    normalized.includes('deadlift') ||
    normalized.includes('bench') ||
    normalized.includes('squat')
  ) {
    return 'strength';
  }
  if (normalized.includes('swimming')) return 'swim';
  if (normalized.includes('walking')) return 'walk';

  return 'other';
}

function numeric(value: unknown): number | undefined {
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function grams(value: any): number | undefined {
  return numeric(value?.inGrams);
}

function milligrams(value: any): number | undefined {
  return numeric(value?.inMilligrams ?? (value?.inGrams != null ? value.inGrams * 1000 : undefined));
}

function kilocalories(value: any): number | undefined {
  return numeric(value?.inKilocalories);
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
  record: any,
) {
  const date = localDateKey(record.startTime ?? record.endTime ?? new Date());
  const accumulator = getNutritionAccumulator(map, date);
  accumulator.entryCount += 1;
  accumulator.records.push(record);

  addNumber(accumulator, 'kcalIn', kilocalories(record.energy));
  addNumber(accumulator, 'proteinG', grams(record.protein));
  addNumber(accumulator, 'carbsG', grams(record.totalCarbohydrate));
  addNumber(accumulator, 'fatG', grams(record.totalFat));
  addNumber(accumulator, 'fiberG', grams(record.dietaryFiber));
  addNumber(accumulator, 'sugarG', grams(record.sugar));
  addNumber(accumulator, 'cholesterolMg', milligrams(record.cholesterol));
  addNumber(accumulator, 'caffeineMg', milligrams(record.caffeine));
  addNumber(accumulator, 'sodiumMg', milligrams(record.sodium));

  const nutrientFields = [
    'biotin',
    'calcium',
    'chloride',
    'chromium',
    'copper',
    'folate',
    'folicAcid',
    'iodine',
    'iron',
    'magnesium',
    'manganese',
    'molybdenum',
    'monounsaturatedFat',
    'niacin',
    'pantothenicAcid',
    'phosphorus',
    'polyunsaturatedFat',
    'potassium',
    'riboflavin',
    'saturatedFat',
    'selenium',
    'thiamin',
    'transFat',
    'unsaturatedFat',
    'vitaminA',
    'vitaminB12',
    'vitaminB6',
    'vitaminC',
    'vitaminD',
    'vitaminE',
    'vitaminK',
    'zinc',
  ];

  for (const field of nutrientFields) {
    const amount = grams(record[field]) ?? milligrams(record[field]);
    if (amount == null) {
      continue;
    }
    accumulator.allNutrients[field] = (accumulator.allNutrients[field] ?? 0) + amount;
  }

  if (record.name) {
    accumulator.mealCount = (accumulator.mealCount ?? 0) + 1;
  }

  if (record.metadata?.lastModifiedTime) {
    accumulator.sourceModifiedAt = record.metadata.lastModifiedTime;
  }
}

function addHydrationRecord(
  map: Map<string, NutritionAccumulator>,
  record: any,
) {
  const date = localDateKey(record.startTime ?? record.endTime ?? new Date());
  const accumulator = getNutritionAccumulator(map, date);
  accumulator.entryCount += 1;
  accumulator.records.push(record);
  addNumber(accumulator, 'waterMl', numeric(record.volume?.inMilliliters));
}

function finalizeNutrition(records: Map<string, NutritionAccumulator>): NutritionDailyRecord[] {
  return [...records.values()].map(({ records: rawRecords, allNutrients, ...record }) => ({
    ...record,
    allNutrientsJson: safeJsonStringify({
      totals: allNutrients,
      records: rawRecords,
    }),
  }));
}

function parseSleepSession(record: any, index: number): SleepSessionRecord {
  const stages = Array.isArray(record.stages) ? record.stages : [];
  const timeInBedSeconds = secondsBetween(record.startTime, record.endTime);
  let sleepSeconds = stages.length ? 0 : timeInBedSeconds;
  let deepSleepSeconds = 0;
  let lightSleepSeconds = 0;
  let remSleepSeconds = 0;
  let awakeSeconds = 0;
  let wakeupCount = 0;

  for (const stage of stages) {
    const duration = secondsBetween(stage.startTime, stage.endTime);
    if (stage.stage === SleepStageType.AWAKE || stage.stage === SleepStageType.OUT_OF_BED) {
      awakeSeconds += duration;
      wakeupCount += 1;
      continue;
    }

    sleepSeconds += duration;
    if (stage.stage === SleepStageType.DEEP) {
      deepSleepSeconds += duration;
    } else if (stage.stage === SleepStageType.REM) {
      remSleepSeconds += duration;
    } else {
      lightSleepSeconds += duration;
    }
  }

  return {
    sleepId: `health_connect:sleep:${providerId('SleepSession', record, index)}`,
    platform: 'health_connect',
    sourceApp: record.metadata?.dataOrigin,
    startAt: record.startTime,
    endAt: record.endTime,
    wakeDate: localDateKey(record.endTime),
    sleepSeconds,
    timeInBedSeconds,
    deepSleepSeconds,
    lightSleepSeconds,
    remSleepSeconds,
    awakeSeconds,
    sleepStageJson: safeJsonStringify(stages),
    sleepEfficiency: timeInBedSeconds ? sleepSeconds / timeInBedSeconds : undefined,
    wakeupCount: wakeupCount || undefined,
    rawJson: safeJsonStringify(record),
  };
}

function parseWorkout(record: any, index: number): WorkoutRecord {
  const elapsedSeconds = secondsBetween(record.startTime, record.endTime);

  return {
    workoutId: `health_connect:workout:${providerId('ExerciseSession', record, index)}`,
    platform: 'health_connect',
    sourceApp: record.metadata?.dataOrigin,
    startAt: record.startTime,
    endAt: record.endTime,
    localDate: localDateKey(record.startTime),
    name: record.title,
    activityType: exerciseTypeName(record.exerciseType) ?? String(record.exerciseType ?? 'unknown'),
    sportBucket: sportBucket(record.exerciseType, record.title),
    elapsedSeconds,
    routeAvailable: Boolean(record.exerciseRoute),
    lapsJson: record.laps ? safeJsonStringify(record.laps) : undefined,
    streamsJson: record.segments ? safeJsonStringify(record.segments) : undefined,
    rawJson: safeJsonStringify(record),
  };
}

export async function openAndroidHealthSettings(): Promise<void> {
  openHealthConnectSettings();
}

export async function syncHealthConnect(range: SyncRange): Promise<SyncResult> {
  const status = await getSdkStatus();
  if (status === SdkAvailabilityStatus.SDK_UNAVAILABLE) {
    throw new Error('Health Connect is not available on this device.');
  }
  if (status === SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) {
    throw new Error('Health Connect needs to be installed or updated.');
  }

  const initialized = await initialize();
  if (!initialized) {
    throw new Error('Health Connect could not be initialized.');
  }

  const granted = await requestPermission(permissions);
  const grantedKeys = new Set(
    granted.map((permission) => `${permission.accessType}:${permission.recordType}`),
  );
  const missing = permissions.filter(
    (permission) => !grantedKeys.has(`${permission.accessType}:${permission.recordType}`),
  );

  const samples: HealthSample[] = [];
  const workouts: WorkoutRecord[] = [];
  const sleepSessions: SleepSessionRecord[] = [];
  const nutrition = new Map<string, NutritionAccumulator>();
  const warnings = missing.length
    ? [`Missing permissions: ${missing.map((permission) => permission.recordType).join(', ')}`]
    : [];

  for (const config of aggregateConfigs) {
    try {
      const groups = await readDailyAggregates(
        config.recordType as AggregateResultRecordType,
        range,
      );

      groups.forEach((group: any) => {
        const result = group.result as Record<string, any>;
        const dataOrigins = result.dataOrigins ?? group.result.dataOrigins ?? [];
        let value: number | undefined;
        let unit: string | undefined;

        if (config.recordType === 'Steps') {
          value = Number(result.COUNT_TOTAL ?? 0);
          unit = 'count';
        } else if (config.recordType === 'ActiveCaloriesBurned') {
          value = Number(result.ACTIVE_CALORIES_TOTAL?.inKilocalories ?? 0);
          unit = 'kcal';
        } else if (config.recordType === 'TotalCaloriesBurned') {
          value = Number(result.ENERGY_TOTAL?.inKilocalories ?? 0);
          unit = 'kcal';
        } else if (config.recordType === 'Distance') {
          value = Number(result.DISTANCE?.inMeters ?? 0);
          unit = 'm';
        } else if (config.recordType === 'HeartRate') {
          value = Number(result.BPM_AVG ?? 0);
          unit = 'bpm';
          if (!value || !result.MEASUREMENTS_COUNT) {
            return;
          }
        }

        samples.push({
          sampleId: `health_connect:daily:${config.canonicalType}:${group.startTime}`,
          platform: 'health_connect',
          recordType: `${config.recordType}Record`,
          canonicalType: config.canonicalType,
          sourceApp: dataOrigins.join(', '),
          startAt: group.startTime,
          endAt: group.endTime,
          localDate: localDateKey(group.startTime),
          value,
          unit,
          metadataJson: safeJsonStringify({ recordType: config.recordType, group }),
        });
      });
    } catch (error) {
      warnings.push(
        `${config.canonicalType}: ${String(error instanceof Error ? error.message : error)}`,
      );
    }
  }

  for (const config of rawRecordConfigs) {
    try {
      const records = await readAllRecords(config.recordType, range);

      records.forEach((record, index) => {
        const anyRecord = record as any;
        const metadata = anyRecord.metadata as RecordMetadata | undefined;

        if (config.recordType === 'ExerciseSession') {
          const workout = parseWorkout(anyRecord, index);
          workouts.push(workout);
          samples.push(
            healthSample({
              recordType: config.recordType,
              canonicalType: 'workout',
              record: anyRecord,
              index,
              value: workout.elapsedSeconds / 60,
              unit: 'min',
              metadata,
            }),
          );
          return;
        }

        if (config.recordType === 'SleepSession') {
          const session = parseSleepSession(anyRecord, index);
          sleepSessions.push(session);
          samples.push(
            healthSample({
              recordType: config.recordType,
              canonicalType: 'sleep_session',
              record: anyRecord,
              index,
              value: session.sleepSeconds,
              unit: 's',
              startAt: session.startAt,
              endAt: session.endAt,
              metadata,
            }),
          );
          return;
        }

        if (config.recordType === 'RestingHeartRate') {
          samples.push(
            healthSample({
              recordType: config.recordType,
              canonicalType: 'resting_heart_rate',
              record: anyRecord,
              index,
              value: Number(anyRecord.beatsPerMinute),
              unit: 'bpm',
              metadata,
            }),
          );
          return;
        }

        if (config.recordType === 'HeartRateVariabilityRmssd') {
          samples.push(
            healthSample({
              recordType: config.recordType,
              canonicalType: 'hrv_rmssd',
              record: anyRecord,
              index,
              value: Number(anyRecord.heartRateVariabilityMillis),
              unit: 'ms',
              metadata,
            }),
          );
          return;
        }

        if (config.recordType === 'Weight') {
          samples.push(
            healthSample({
              recordType: config.recordType,
              canonicalType: 'weight',
              record: anyRecord,
              index,
              value: numeric(anyRecord.weight?.inKilograms),
              unit: 'kg',
              metadata,
            }),
          );
          return;
        }

        if (config.recordType === 'BodyFat') {
          samples.push(
            healthSample({
              recordType: config.recordType,
              canonicalType: 'body_fat',
              record: anyRecord,
              index,
              value: numeric(anyRecord.percentage),
              unit: '%',
              metadata,
            }),
          );
          return;
        }

        if (config.recordType === 'LeanBodyMass') {
          samples.push(
            healthSample({
              recordType: config.recordType,
              canonicalType: 'lean_body_mass',
              record: anyRecord,
              index,
              value: numeric(anyRecord.mass?.inKilograms),
              unit: 'kg',
              metadata,
            }),
          );
          return;
        }

        if (config.recordType === 'Nutrition') {
          addNutritionRecord(nutrition, anyRecord);
          samples.push(
            healthSample({
              recordType: config.recordType,
              canonicalType: 'nutrition',
              record: anyRecord,
              index,
              value: kilocalories(anyRecord.energy),
              unit: 'kcal',
              metadata,
            }),
          );
          return;
        }

        if (config.recordType === 'Hydration') {
          addHydrationRecord(nutrition, anyRecord);
          samples.push(
            healthSample({
              recordType: config.recordType,
              canonicalType: 'hydration',
              record: anyRecord,
              index,
              value: numeric(anyRecord.volume?.inMilliliters),
              unit: 'ml',
              metadata,
            }),
          );
          return;
        }

        if (config.recordType === 'Vo2Max') {
          samples.push(
            healthSample({
              recordType: config.recordType,
              canonicalType: 'vo2max',
              record: anyRecord,
              index,
              value: Number(anyRecord.vo2MillilitersPerMinuteKilogram),
              unit: 'ml/kg/min',
              metadata,
            }),
          );
        }
      });
    } catch (error) {
      warnings.push(
        `${config.canonicalType}: ${String(error instanceof Error ? error.message : error)}`,
      );
    }
  }

  return {
    provider: 'health_connect',
    samples,
    workouts,
    sleepSessions,
    nutritionDaily: finalizeNutrition(nutrition),
    warnings,
  };
}
