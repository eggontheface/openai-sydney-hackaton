import {
  aggregateGroupByDuration,
  getSdkStatus,
  initialize,
  openHealthConnectSettings,
  readRecords,
  requestPermission,
  SdkAvailabilityStatus,
} from 'react-native-health-connect';
import type {
  AggregateResultRecordType,
  Permission,
  RecordResult,
  RecordType,
} from 'react-native-health-connect';

import { safeJsonStringify } from '../lib/json';
import type {
  HealthMetric,
  NormalizedHealthSample,
  SyncRange,
  SyncResult,
} from './types';

type HealthConnectRecordConfig = {
  recordType: RecordType;
  metric: HealthMetric;
};

const aggregateConfigs: HealthConnectRecordConfig[] = [
  { recordType: 'Steps', metric: 'steps' },
  { recordType: 'ActiveCaloriesBurned', metric: 'active_energy' },
  { recordType: 'Distance', metric: 'distance' },
  { recordType: 'HeartRate', metric: 'heart_rate' },
];

const rawRecordConfigs: HealthConnectRecordConfig[] = [
  { recordType: 'ExerciseSession', metric: 'workout' },
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
};

type IntervalRecord = {
  metadata?: RecordMetadata;
  startTime: string;
  endTime: string;
};

function providerId(recordType: RecordType, record: { metadata?: RecordMetadata }, index: number) {
  return (
    record.metadata?.id ??
    `${recordType}:${record.metadata?.dataOrigin ?? 'unknown'}:${index}`
  );
}

function durationMinutes(startTime: string, endTime: string): number {
  return Math.max(0, (new Date(endTime).getTime() - new Date(startTime).getTime()) / 60000);
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

  const samples: NormalizedHealthSample[] = [];
  const warnings = missing.length
    ? [`Missing permissions: ${missing.map((permission) => permission.recordType).join(', ')}`]
    : [];

  for (const config of aggregateConfigs) {
    try {
      const groups = await readDailyAggregates(
        config.recordType as AggregateResultRecordType,
        range,
      );

      groups.forEach((group) => {
        const result = group.result as Record<string, any>;
        const dataOrigins = group.result.dataOrigins ?? [];

        if (config.recordType === 'Steps') {
          const count = result.COUNT_TOTAL ?? 0;
          samples.push({
            id: `health_connect:daily:steps:${group.startTime}`,
            provider: 'health_connect',
            metric: 'steps',
            startTime: group.startTime,
            endTime: group.endTime,
            value: Number(count ?? 0),
            unit: 'count',
            sourceName: dataOrigins.join(', '),
            sourceId: dataOrigins.join(','),
            rawJson: safeJsonStringify({ recordType: config.recordType, group }),
          });
          return;
        }

        if (config.recordType === 'ActiveCaloriesBurned') {
          const energy = result.ACTIVE_CALORIES_TOTAL?.inKilocalories ?? 0;
          samples.push({
            id: `health_connect:daily:active_energy:${group.startTime}`,
            provider: 'health_connect',
            metric: 'active_energy',
            startTime: group.startTime,
            endTime: group.endTime,
            value: Number(energy ?? 0),
            unit: 'kcal',
            sourceName: dataOrigins.join(', '),
            sourceId: dataOrigins.join(','),
            rawJson: safeJsonStringify({ recordType: config.recordType, group }),
          });
          return;
        }

        if (config.recordType === 'Distance') {
          const meters = result.DISTANCE?.inMeters ?? 0;
          samples.push({
            id: `health_connect:daily:distance:${group.startTime}`,
            provider: 'health_connect',
            metric: 'distance',
            startTime: group.startTime,
            endTime: group.endTime,
            value: Number(meters ?? 0),
            unit: 'm',
            sourceName: dataOrigins.join(', '),
            sourceId: dataOrigins.join(','),
            rawJson: safeJsonStringify({ recordType: config.recordType, group }),
          });
          return;
        }

        if (config.recordType === 'HeartRate') {
          const bpm = result.BPM_AVG ?? 0;
          const measurementCount = result.MEASUREMENTS_COUNT ?? 0;
          if (!bpm || !measurementCount) {
            return;
          }

          samples.push({
            id: `health_connect:daily:heart_rate:${group.startTime}`,
            provider: 'health_connect',
            metric: 'heart_rate',
            startTime: group.startTime,
            endTime: group.endTime,
            value: Number(bpm),
            unit: 'bpm',
            sourceName: dataOrigins.join(', '),
            sourceId: dataOrigins.join(','),
            rawJson: safeJsonStringify({ recordType: config.recordType, group }),
          });
        }
      });
    } catch (error) {
      warnings.push(
        `${config.metric}: ${String(error instanceof Error ? error.message : error)}`,
      );
    }
  }

  for (const config of rawRecordConfigs) {
    try {
      const records = await readAllRecords(config.recordType, range);

      records.forEach((record, index) => {
        const base = record as IntervalRecord;
        const sourceName = base.metadata?.dataOrigin;
        const sourceId = base.metadata?.dataOrigin;

        if (config.recordType === 'Steps') {
          const steps = record as RecordResult<'Steps'>;
          samples.push({
            id: `health_connect:steps:${providerId(config.recordType, steps, index)}`,
            provider: 'health_connect',
            metric: 'steps',
            startTime: steps.startTime,
            endTime: steps.endTime,
            value: Number(steps.count),
            unit: 'count',
            sourceName,
            sourceId,
            rawJson: safeJsonStringify(steps),
          });
          return;
        }

        if (config.recordType === 'ActiveCaloriesBurned') {
          const calories = record as RecordResult<'ActiveCaloriesBurned'>;
          samples.push({
            id: `health_connect:active_energy:${providerId(config.recordType, calories, index)}`,
            provider: 'health_connect',
            metric: 'active_energy',
            startTime: calories.startTime,
            endTime: calories.endTime,
            value: Number(calories.energy.inKilocalories),
            unit: 'kcal',
            sourceName,
            sourceId,
            rawJson: safeJsonStringify(calories),
          });
          return;
        }

        if (config.recordType === 'Distance') {
          const distance = record as RecordResult<'Distance'>;
          samples.push({
            id: `health_connect:distance:${providerId(config.recordType, distance, index)}`,
            provider: 'health_connect',
            metric: 'distance',
            startTime: distance.startTime,
            endTime: distance.endTime,
            value: Number(distance.distance.inMeters),
            unit: 'm',
            sourceName,
            sourceId,
            rawJson: safeJsonStringify(distance),
          });
          return;
        }

        if (config.recordType === 'HeartRate') {
          const heartRate = record as RecordResult<'HeartRate'>;
          heartRate.samples.forEach((heartRateSample, sampleIndex) => {
            samples.push({
              id: `health_connect:heart_rate:${providerId(config.recordType, heartRate, index)}:${sampleIndex}`,
              provider: 'health_connect',
              metric: 'heart_rate',
              startTime: heartRateSample.time,
              endTime: heartRateSample.time,
              value: Number(heartRateSample.beatsPerMinute),
              unit: 'bpm',
              sourceName,
              sourceId,
              rawJson: safeJsonStringify({ record: heartRate, sample: heartRateSample }),
            });
          });
          return;
        }

        if (config.recordType === 'ExerciseSession') {
          const exercise = record as RecordResult<'ExerciseSession'>;
          samples.push({
            id: `health_connect:workout:${providerId(config.recordType, exercise, index)}`,
            provider: 'health_connect',
            metric: 'workout',
            startTime: exercise.startTime,
            endTime: exercise.endTime,
            value: durationMinutes(exercise.startTime, exercise.endTime),
            unit: 'min',
            sourceName: exercise.title ?? sourceName,
            sourceId,
            rawJson: safeJsonStringify(exercise),
          });
        }
      });
    } catch (error) {
      warnings.push(
        `${config.metric}: ${String(error instanceof Error ? error.message : error)}`,
      );
    }
  }

  return {
    provider: 'health_connect',
    samples,
    warnings,
  };
}
