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
  ReadHealthDataHistoryPermission,
  RecordResult,
  RecordType,
} from 'react-native-health-connect';

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

type HealthConnectRecordConfig = {
  recordType: RecordType;
  canonicalType: CanonicalType;
};

type HealthConnectPermissionRequest = Permission | ReadHealthDataHistoryPermission;

const aggregateConfigs: HealthConnectRecordConfig[] = [
  { recordType: 'Steps', canonicalType: 'steps' },
  { recordType: 'ActiveCaloriesBurned', canonicalType: 'active_energy' },
  { recordType: 'TotalCaloriesBurned', canonicalType: 'total_energy' },
  { recordType: 'Distance', canonicalType: 'distance' },
  { recordType: 'HeartRate', canonicalType: 'heart_rate' },
  { recordType: 'RestingHeartRate', canonicalType: 'resting_heart_rate' },
  { recordType: 'SleepSession', canonicalType: 'sleep_session' },
];

const rawRecordConfigs: HealthConnectRecordConfig[] = [
  { recordType: 'ExerciseSession', canonicalType: 'workout' },
  { recordType: 'SleepSession', canonicalType: 'sleep_session' },
  { recordType: 'HeartRateVariabilityRmssd', canonicalType: 'hrv_rmssd' },
  { recordType: 'Weight', canonicalType: 'weight' },
  { recordType: 'BodyFat', canonicalType: 'body_fat' },
  { recordType: 'LeanBodyMass', canonicalType: 'lean_body_mass' },
  { recordType: 'Nutrition', canonicalType: 'nutrition' },
  { recordType: 'Hydration', canonicalType: 'hydration' },
  { recordType: 'Vo2Max', canonicalType: 'vo2max' },
];

const permissionRecordTypes = Array.from(
  new Set([...aggregateConfigs, ...rawRecordConfigs].map((config) => config.recordType)),
);

const permissions: Permission[] = permissionRecordTypes.map((recordType) => ({
  accessType: 'read',
  recordType,
}));

const healthDataHistoryPermission: ReadHealthDataHistoryPermission = {
  accessType: 'read',
  recordType: 'ReadHealthDataHistory',
};

function needsHistoryPermission(range: SyncRange): boolean {
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  return range.startDate.getTime() < thirtyDaysAgo;
}

function permissionsForRange(range: SyncRange): HealthConnectPermissionRequest[] {
  return needsHistoryPermission(range) ? [...permissions, healthDataHistoryPermission] : permissions;
}

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

type DailyAggregateGroup = {
  result: Record<string, any>;
  startTime: string;
  endTime: string;
};

type StepAggregateCandidate = {
  group: DailyAggregateGroup;
  sourceApp?: string;
  value: number;
};

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
  const resolvedEnd = endAt ?? recordEnd(timed);

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
  dataOriginFilter?: string[],
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
      dataOriginFilter,
    }),
    `${recordType} daily aggregate`,
  );
}

function aggregateDataOrigins(group: DailyAggregateGroup): string[] {
  const origins = group.result.dataOrigins;
  return Array.isArray(origins)
    ? origins.filter((origin): origin is string => typeof origin === 'string' && origin.length > 0)
    : [];
}

function aggregateStepCount(group: DailyAggregateGroup): number {
  const value = Number(group.result.COUNT_TOTAL ?? 0);
  return Number.isFinite(value) ? value : 0;
}

function stepSourceRank(candidates: StepAggregateCandidate[]) {
  const rank = new Map<string, { days: number; total: number }>();

  candidates.forEach((candidate) => {
    const source = candidate.sourceApp ?? 'unknown';
    const current = rank.get(source) ?? { days: 0, total: 0 };
    current.days += 1;
    current.total += candidate.value;
    rank.set(source, current);
  });

  return rank;
}

function chooseStepCandidate(
  candidates: StepAggregateCandidate[],
  rank: Map<string, { days: number; total: number }>,
): StepAggregateCandidate {
  return candidates
    .slice()
    .sort((left, right) => {
      const leftRank = rank.get(left.sourceApp ?? 'unknown') ?? { days: 0, total: 0 };
      const rightRank = rank.get(right.sourceApp ?? 'unknown') ?? { days: 0, total: 0 };

      return (
        rightRank.days - leftRank.days ||
        rightRank.total - leftRank.total ||
        right.value - left.value ||
        (left.sourceApp ?? '').localeCompare(right.sourceApp ?? '')
      );
    })[0];
}

async function stepAggregateCandidatesByDate(
  range: SyncRange,
  groups: DailyAggregateGroup[],
): Promise<{
  candidatesByDate: Map<string, StepAggregateCandidate[]>;
  dataOrigins: string[];
  groupsRead: number;
}> {
  const dataOrigins = Array.from(new Set(groups.flatMap(aggregateDataOrigins))).sort();
  const candidatesByDate = new Map<string, StepAggregateCandidate[]>();

  if (dataOrigins.length <= 1) {
    groups.forEach((group) => {
      const value = aggregateStepCount(group);
      if (!value) {
        return;
      }

      const date = localDateKey(group.startTime);
      candidatesByDate.set(date, [
        ...(candidatesByDate.get(date) ?? []),
        {
          group,
          sourceApp: dataOrigins[0],
          value,
        },
      ]);
    });

    return { candidatesByDate, dataOrigins, groupsRead: 0 };
  }

  let groupsRead = 0;
  for (const dataOrigin of dataOrigins) {
    const originGroups = (await readDailyAggregates('Steps', range, [
      dataOrigin,
    ])) as DailyAggregateGroup[];
    groupsRead += originGroups.length;

    originGroups.forEach((group) => {
      const value = aggregateStepCount(group);
      if (!value) {
        return;
      }

      const date = localDateKey(group.startTime);
      candidatesByDate.set(date, [
        ...(candidatesByDate.get(date) ?? []),
        { group, sourceApp: dataOrigin, value },
      ]);
    });
  }

  return { candidatesByDate, dataOrigins, groupsRead };
}

function aggregateSample({
  config,
  group,
  value,
  unit,
  sourceApp,
  metadata,
}: {
  config: HealthConnectRecordConfig;
  group: DailyAggregateGroup;
  value?: number;
  unit?: string;
  sourceApp?: string;
  metadata?: Record<string, unknown>;
}): HealthSample {
  return {
    sampleId: `health_connect:daily:${config.canonicalType}:${group.startTime}`,
    platform: 'health_connect',
    recordType: `${config.recordType}Record`,
    canonicalType: config.canonicalType,
    sourceApp,
    startAt: group.startTime,
    endAt: group.endTime,
    localDate: localDateKey(group.startTime),
    value,
    unit,
    metadataJson: safeJsonStringify({
      recordType: config.recordType,
      group,
      ...metadata,
    }),
  };
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

  const granted = await requestPermission(permissionsForRange(range));
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
  function permissionState(recordType: RecordType): HealthConnectReadDiagnostic['permission'] {
    return grantedKeys.has(`read:${recordType}`) ? 'granted' : 'missing';
  }

  const diagnostics: HealthConnectReadDiagnostic[] = [
    ...aggregateConfigs.map((config) => ({
      recordType: config.recordType,
      canonicalType: config.canonicalType,
      permission: permissionState(config.recordType),
      readKind: 'aggregate' as const,
      recordsRead: 0,
      samplesWritten: 0,
    })),
    ...rawRecordConfigs.map((config) => ({
      recordType: config.recordType,
      canonicalType: config.canonicalType,
      permission: permissionState(config.recordType),
      readKind: 'records' as const,
      recordsRead: 0,
      samplesWritten: 0,
    })),
  ];

  function updateDiagnostic(
    config: HealthConnectRecordConfig,
    readKind: HealthConnectReadDiagnostic['readKind'],
    values: Partial<Pick<HealthConnectReadDiagnostic, 'recordsRead' | 'samplesWritten' | 'message'>>,
  ) {
    const diagnostic = diagnostics.find(
      (item) => item.recordType === config.recordType && item.readKind === readKind,
    );
    if (!diagnostic) {
      return;
    }

    Object.assign(diagnostic, values);
  }

  function hasReadPermission(recordType: RecordType): boolean {
    return grantedKeys.has(`read:${recordType}`);
  }

  for (const config of aggregateConfigs) {
    if (!hasReadPermission(config.recordType)) {
      updateDiagnostic(config, 'aggregate', {
        message: 'Permission missing; read skipped.',
      });
      continue;
    }

    try {
      let samplesWritten = 0;
      const groups = await readDailyAggregates(
        config.recordType as AggregateResultRecordType,
        range,
      ) as DailyAggregateGroup[];
      let extraGroupsRead = 0;
      let successMessage: string | undefined;

      if (config.recordType === 'Steps') {
        const { candidatesByDate, dataOrigins, groupsRead } = await stepAggregateCandidatesByDate(
          range,
          groups,
        );
        extraGroupsRead = groupsRead;
        const candidates = [...candidatesByDate.values()].flat();
        const rank = stepSourceRank(candidates);

        [...candidatesByDate.entries()]
          .sort(([left], [right]) => left.localeCompare(right))
          .forEach(([, stepCandidates]) => {
            const candidate = chooseStepCandidate(stepCandidates, rank);
            const ignoredDataOrigins = dataOrigins.filter(
              (origin) => origin !== candidate.sourceApp,
            );

            samples.push(
              aggregateSample({
                config,
                group: candidate.group,
                value: candidate.value,
                unit: 'count',
                sourceApp: candidate.sourceApp,
                metadata: ignoredDataOrigins.length
                  ? {
                      selectedDataOrigin: candidate.sourceApp,
                      ignoredDataOrigins,
                    }
                  : undefined,
              }),
            );
            samplesWritten += 1;
          });

        if (dataOrigins.length > 1 && samplesWritten) {
          successMessage = `Multiple step sources found; selected one source per day from ${dataOrigins.length} origins.`;
        }
      } else {
        groups.forEach((group) => {
          const result = group.result;
          const dataOrigins = aggregateDataOrigins(group);
          let value: number | undefined;
          let unit: string | undefined;

          if (config.recordType === 'ActiveCaloriesBurned') {
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
          } else if (config.recordType === 'RestingHeartRate') {
            value = Number(result.BPM_AVG ?? 0);
            unit = 'bpm';
            if (!value) {
              return;
            }
          } else if (config.recordType === 'SleepSession') {
            value = Number(result.SLEEP_DURATION_TOTAL ?? 0);
            unit = 's';
            if (!value) {
              return;
            }
          }

          samples.push(
            aggregateSample({
              config,
              group,
              value,
              unit,
              sourceApp: dataOrigins.join(', '),
            }),
          );
          samplesWritten += 1;
        });
      }

      updateDiagnostic(config, 'aggregate', {
        recordsRead: groups.length + extraGroupsRead,
        samplesWritten,
        message:
          groups.length && samplesWritten
            ? successMessage
            : 'Permission granted, but no aggregate data returned in range.',
      });
    } catch (error) {
      const message = String(error instanceof Error ? error.message : error);
      updateDiagnostic(config, 'aggregate', {
        message,
      });
      warnings.push(
        `${config.canonicalType}: ${message}`,
      );
    }
  }

  for (const config of rawRecordConfigs) {
    if (!hasReadPermission(config.recordType)) {
      updateDiagnostic(config, 'records', {
        message: 'Permission missing; read skipped.',
      });
      continue;
    }

    try {
      const sampleStartCount = samples.length;
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
      const samplesWritten = samples.length - sampleStartCount;
      updateDiagnostic(config, 'records', {
        recordsRead: records.length,
        samplesWritten,
        message: records.length
          ? undefined
          : 'Permission granted, but no records returned in range.',
      });
    } catch (error) {
      const message = String(error instanceof Error ? error.message : error);
      updateDiagnostic(config, 'records', {
        message,
      });
      warnings.push(
        `${config.canonicalType}: ${message}`,
      );
    }
  }

  return {
    provider: 'health_connect',
    samples,
    workouts,
    sleepSessions,
    nutritionDaily: finalizeNutrition(nutrition),
    diagnostics,
    warnings,
  };
}
