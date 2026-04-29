import {
  isHealthDataAvailable,
  queryQuantitySamples,
  queryWorkoutSamples,
  requestAuthorization,
} from '@kingstinct/react-native-healthkit';
import type { QuantityTypeIdentifier } from '@kingstinct/react-native-healthkit';

import { localDateKey } from '../lib/dates';
import { safeJsonStringify } from '../lib/json';
import type {
  HealthMetric,
  HealthSample,
  SyncRange,
  SyncResult,
} from './types';

type HealthKitQuantityConfig = {
  identifier: QuantityTypeIdentifier;
  metric: HealthMetric;
  unit: string;
};

const quantityConfigs: HealthKitQuantityConfig[] = [
  {
    identifier: 'HKQuantityTypeIdentifierStepCount',
    metric: 'steps',
    unit: 'count',
  },
  {
    identifier: 'HKQuantityTypeIdentifierActiveEnergyBurned',
    metric: 'active_energy',
    unit: 'kcal',
  },
  {
    identifier: 'HKQuantityTypeIdentifierDistanceWalkingRunning',
    metric: 'distance',
    unit: 'm',
  },
  {
    identifier: 'HKQuantityTypeIdentifierHeartRate',
    metric: 'heart_rate',
    unit: 'count/min',
  },
];

function iso(value: Date | string): string {
  return new Date(value).toISOString();
}

function sourceName(sample: {
  sourceRevision?: { source?: { name?: string; bundleIdentifier?: string } };
}): string | undefined {
  return sample.sourceRevision?.source?.name;
}

function sourceId(sample: {
  sourceRevision?: { source?: { bundleIdentifier?: string } };
}): string | undefined {
  return sample.sourceRevision?.source?.bundleIdentifier;
}

export async function syncAppleHealth(range: SyncRange): Promise<SyncResult> {
  if (!isHealthDataAvailable()) {
    throw new Error('HealthKit data is not available on this device.');
  }

  await requestAuthorization({
    toRead: [
      ...quantityConfigs.map((config) => config.identifier),
      'HKWorkoutTypeIdentifier',
    ],
  });

  const samples: HealthSample[] = [];
  const warnings: string[] = [];

  for (const config of quantityConfigs) {
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

      for (const record of records) {
        samples.push({
          sampleId: `healthkit:${config.metric}:${record.uuid}`,
          platform: 'healthkit',
          recordType: config.identifier,
          canonicalType: config.metric,
          sourceApp: sourceId(record) ?? sourceName(record),
          sourceDevice: sourceName(record),
          startAt: iso(record.startDate),
          endAt: iso(record.endDate),
          localDate: localDateKey(record.startDate),
          value: Number(record.quantity),
          unit: record.unit ?? config.unit,
          metadataJson: safeJsonStringify(record),
        });
      }
    } catch (error) {
      warnings.push(`${config.metric}: ${String(error instanceof Error ? error.message : error)}`);
    }
  }

  try {
    const workouts = await queryWorkoutSamples({
      ascending: true,
      limit: 1000,
      filter: {
        date: {
          startDate: range.startDate,
          endDate: range.endDate,
        },
      },
    });

    for (const workout of workouts) {
      const raw = typeof workout.toJSON === 'function' ? workout.toJSON() : workout;
      const durationMinutes =
        Number(workout.duration?.quantity ?? 0) / 60 ||
        (new Date(workout.endDate).getTime() - new Date(workout.startDate).getTime()) /
          60000;

      samples.push({
        sampleId: `healthkit:workout:${workout.uuid}`,
        platform: 'healthkit',
        recordType: 'HKWorkoutTypeIdentifier',
        canonicalType: 'workout',
        startAt: iso(workout.startDate),
        endAt: iso(workout.endDate),
        localDate: localDateKey(workout.startDate),
        value: Number.isFinite(durationMinutes) ? durationMinutes : 0,
        unit: 'min',
        sourceApp: sourceId(workout) ?? sourceName(workout),
        sourceDevice: sourceName(workout),
        metadataJson: safeJsonStringify(raw),
      });
    }
  } catch (error) {
    warnings.push(`workout: ${String(error instanceof Error ? error.message : error)}`);
  }

  return {
    provider: 'healthkit',
    samples,
    workouts: [],
    sleepSessions: [],
    nutritionDaily: [],
    diagnostics: [],
    warnings,
  };
}
