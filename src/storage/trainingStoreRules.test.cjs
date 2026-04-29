const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('node:path');

const fixtures = require('./fixtures/training-rollup.fixtures.json');
const {
  buildDailyMetricsRollup,
  deriveCompatibleHrvBaseline,
  normalizeLegacyHealthSampleRow,
} = require(path.join(process.cwd(), '.tmp/test-build/src/storage/trainingStoreRules.js'));

function valuesFor(date, canonicalType) {
  return fixtures.healthSamples
    .filter((sample) => sample.localDate === date && sample.canonicalType === canonicalType)
    .map((sample) => sample.value)
    .filter((value) => value != null);
}

function sumFor(date, canonicalType) {
  const values = valuesFor(date, canonicalType);
  return values.length ? values.reduce((sum, value) => sum + value, 0) : undefined;
}

function averageFor(date, canonicalType) {
  const values = valuesFor(date, canonicalType);
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : undefined;
}

function minFor(date, canonicalType) {
  const values = valuesFor(date, canonicalType);
  return values.length ? Math.min(...values) : undefined;
}

function maxFor(date, canonicalType) {
  const values = valuesFor(date, canonicalType);
  return values.length ? Math.max(...values) : undefined;
}

function latestFor(date, canonicalType) {
  const values = valuesFor(date, canonicalType);
  return values.length ? values[values.length - 1] : undefined;
}

function workoutRollupFor(date) {
  const workouts = fixtures.workouts.filter((workout) => workout.localDate === date);
  const activeKcal = workouts.reduce((sum, workout) => sum + (workout.activeKcal ?? 0), 0);

  return {
    workoutCount: workouts.length,
    runWorkoutCount: workouts.filter((workout) => workout.sportBucket === 'run').length,
    rideWorkoutCount: workouts.filter((workout) => workout.sportBucket === 'ride').length,
    strengthWorkoutCount: workouts.filter((workout) => workout.sportBucket === 'strength').length,
    activityElapsedSeconds: workouts.length
      ? workouts.reduce((sum, workout) => sum + workout.elapsedSeconds, 0)
      : undefined,
    activityKcal: activeKcal || undefined,
  };
}

function nutritionFor(date) {
  return fixtures.nutritionDaily.find((nutrition) => nutrition.date === date) ?? null;
}

function sleepForWakeDate(date) {
  const sleep = fixtures.sleepSessions.find((session) => session.wakeDate === date);
  return sleep
    ? {
        sleepSeconds: sleep.sleepSeconds,
        timeInBedSeconds: sleep.timeInBedSeconds,
        sleepEfficiency: sleep.sleepEfficiency,
      }
    : null;
}

function rollupFor(date, overrides = {}) {
  return buildDailyMetricsRollup({
    date,
    today: fixtures.today,
    generatedAt: fixtures.generatedAt,
    steps: sumFor(date, 'steps'),
    activeKcal: sumFor(date, 'active_energy'),
    totalKcal: sumFor(date, 'total_energy'),
    distanceMeters: sumFor(date, 'distance'),
    sleep: sleepForWakeDate(date),
    restingHr: averageFor(date, 'resting_heart_rate'),
    heartRateAvgBpm: averageFor(date, 'heart_rate'),
    heartRateMinBpm: minFor(date, 'heart_rate'),
    heartRateMaxBpm: maxFor(date, 'heart_rate'),
    hrvLastNightAvg: averageFor(date, 'hrv_rmssd'),
    workout: workoutRollupFor(date),
    nutrition: nutritionFor(date),
    weightKg: latestFor(date, 'weight'),
    ...overrides,
  });
}

test('rolls up a full fixture day without assigning sleep to its start date', () => {
  const wakeDay = rollupFor('2026-04-28');
  const sleepStartDay = rollupFor('2026-04-27');

  assert.equal(wakeDay.dataCompleteness, 'full');
  assert.equal(wakeDay.sourceCount, 5);
  assert.equal(wakeDay.hasSleep, true);
  assert.equal(wakeDay.sleepSeconds, 25200);
  assert.equal(wakeDay.distanceKm, 6.4);
  assert.equal(wakeDay.workoutCount, 1);
  assert.equal(wakeDay.kcalIn, 2210);

  assert.equal(sleepStartDay.hasSleep, false);
  assert.equal(sleepStartDay.sleepSeconds, undefined);
});

test('keeps partial days partial and does not coerce missing values to zero', () => {
  const partialDay = rollupFor('2026-04-27');

  assert.equal(partialDay.dataCompleteness, 'partial');
  assert.equal(partialDay.sourceCount, 2);
  assert.equal(partialDay.hasSteps, true);
  assert.equal(partialDay.hasNutrition, true);
  assert.equal(partialDay.hasEnergy, false);
  assert.equal(partialDay.activeKcal, undefined);
  assert.equal(partialDay.totalKcal, undefined);
  assert.equal(partialDay.sleepSeconds, undefined);
  assert.equal(partialDay.waterMl, 1200);
});

test('marks the current local day partial even when enough sources are present', () => {
  const today = rollupFor(fixtures.today, {
    steps: 9000,
    activeKcal: 600,
    totalKcal: 2400,
    sleep: { sleepSeconds: 26000, timeInBedSeconds: 29000 },
    workout: {
      workoutCount: 1,
      runWorkoutCount: 1,
      rideWorkoutCount: 0,
      strengthWorkoutCount: 0,
    },
    nutrition: { kcalIn: 2100, waterMl: 2400 },
  });

  assert.equal(today.sourceCount, 5);
  assert.equal(today.dataCompleteness, 'partial');
});

test('normalizes supported legacy sample rows before migration insert', () => {
  const sample = normalizeLegacyHealthSampleRow(fixtures.legacyHealthSamples[0]);

  assert.equal(sample.sampleId, 'legacy-steps-1');
  assert.equal(sample.platform, 'healthkit');
  assert.equal(sample.recordType, 'steps');
  assert.equal(sample.canonicalType, 'steps');
  assert.equal(sample.localDate, '2026-04-28');
  assert.equal(sample.sourceApp, 'Apple Health');
  assert.equal(sample.sourceDevice, 'iphone');
  assert.equal(sample.metadataJson, '{"legacy":true}');
});

test('derives HRV baselines only from matching source and method', () => {
  const current = {
    date: '2026-04-29',
    hrvLastNightAvg: 74,
    hrvMethod: 'SDNN',
    hrvSourceApp: 'com.apple.Health',
  };
  const history = [
    {
      date: '2026-04-28',
      hrvLastNightAvg: 70,
      hrvMethod: 'SDNN',
      hrvSourceApp: 'com.apple.Health',
    },
    {
      date: '2026-04-27',
      hrvLastNightAvg: 72,
      hrvMethod: 'SDNN',
      hrvSourceApp: 'com.apple.Health',
    },
    {
      date: '2026-04-26',
      hrvLastNightAvg: 54,
      hrvMethod: 'RMSSD',
      hrvSourceApp: 'com.google.android.apps.healthdata',
    },
  ];

  const baseline = deriveCompatibleHrvBaseline(current, history);

  assert.equal(baseline.baseline, 71);
  assert.equal(baseline.compatibleCount, 2);
  assert.equal(baseline.incompatibleCount, 1);
});

test('reports incompatible HRV history instead of mixing methods', () => {
  const baseline = deriveCompatibleHrvBaseline(
    {
      date: '2026-04-29',
      hrvLastNightAvg: 74,
      hrvMethod: 'SDNN',
      hrvSourceApp: 'com.apple.Health',
    },
    [
      {
        date: '2026-04-28',
        hrvLastNightAvg: 54,
        hrvMethod: 'RMSSD',
        hrvSourceApp: 'com.google.android.apps.healthdata',
      },
    ],
  );

  assert.equal(baseline.baseline, undefined);
  assert.equal(baseline.compatibleCount, 0);
  assert.equal(baseline.incompatibleCount, 1);
});
