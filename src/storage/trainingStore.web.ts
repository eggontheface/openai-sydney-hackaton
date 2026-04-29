import type {
  CanonicalType,
  DailyMetrics,
  HealthConnectReadDiagnostic,
  HealthProvider,
  MetricAvailability,
  PipelineSnapshot,
  SourceFreshness,
  SyncPayload,
  SyncRange,
} from '../health/types';
import {
  normalizeGoalProfile,
  type GoalProfile,
  type GoalProfileDraft,
} from '../goals/goalProfile';

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
  sport_bucket: 'run' | 'ride' | 'strength' | 'swim' | 'walk' | 'other';
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

export type SyncRunRow = {
  id: number;
  provider: HealthProvider;
  started_at: string;
  ended_at: string;
  range_start: string;
  range_end: string;
  sample_count: number;
  status: 'ok' | 'error';
  error: string | null;
};

const dayMs = 24 * 60 * 60 * 1000;

function dateKey(offset = 0) {
  return new Date(Date.now() + offset * dayMs).toISOString().slice(0, 10);
}

function day(offset = 0): DailyMetrics {
  return {
    date: dateKey(offset),
    dataCompleteness: 'full',
    wellnessDataStatus: 'Watch, sleep, workouts',
    sourceCount: 4,
    hasPlatformWellness: true,
    hasActivity: true,
    hasNutrition: offset % 2 === 0,
    hasSleep: true,
    hasSteps: true,
    hasEnergy: true,
    steps: 7600 + Math.abs(offset) * 430,
    activeKcal: 520 - Math.abs(offset) * 12,
    totalKcal: 2240,
    distanceKm: 6.8,
    sleepSeconds: offset === 0 ? 7.4 * 3600 : (7 + Math.abs(offset % 2) * 0.4) * 3600,
    timeInBedSeconds: 8 * 3600,
    sleepEfficiency: 0.91,
    restingHr: 51 + Math.abs(offset % 3),
    heartRateAvgBpm: 73,
    heartRateMinBpm: 45,
    heartRateMaxBpm: 161,
    hrvLastNightAvg: offset === 0 ? 62 : 56 + Math.abs(offset),
    workoutCount: offset === -1 || offset === -3 ? 1 : 0,
    runWorkoutCount: offset === -1 ? 1 : 0,
    rideWorkoutCount: 0,
    strengthWorkoutCount: offset === -3 ? 1 : 0,
    activityElapsedSeconds: 2800,
    activityKcal: 480,
    kcalIn: 2180,
    proteinG: 134,
    carbsG: 245,
    fatG: 72,
    waterMl: 2600,
    weightKg: 78.4,
    bodyFatPct: 17.8,
    leanBodyMassKg: 64.4,
    vo2max: 48,
    generatedAt: new Date().toISOString(),
  };
}

const history = Array.from({ length: 14 }, (_, index) => day(-index));
const latestDate = dateKey(0);

const demoMetricAvailability: MetricAvailability[] = [
  { canonicalType: 'sleep_session', sampleCount: 14, dayCount: 14, latestDate },
  { canonicalType: 'hrv_rmssd', sampleCount: 14, dayCount: 14, latestDate },
  { canonicalType: 'resting_heart_rate', sampleCount: 14, dayCount: 14, latestDate },
  { canonicalType: 'heart_rate', sampleCount: 96, dayCount: 14, latestDate },
  { canonicalType: 'workout', sampleCount: 9, dayCount: 7, latestDate: dateKey(-1) },
  { canonicalType: 'steps', sampleCount: 14, dayCount: 14, latestDate },
  { canonicalType: 'active_energy', sampleCount: 14, dayCount: 14, latestDate },
  { canonicalType: 'distance', sampleCount: 14, dayCount: 14, latestDate },
  { canonicalType: 'nutrition', sampleCount: 8, dayCount: 8, latestDate },
  { canonicalType: 'hydration', sampleCount: 8, dayCount: 8, latestDate },
  { canonicalType: 'weight', sampleCount: 4, dayCount: 4, latestDate: dateKey(-1) },
  { canonicalType: 'body_fat', sampleCount: 4, dayCount: 4, latestDate: dateKey(-1) },
  { canonicalType: 'lean_body_mass', sampleCount: 4, dayCount: 4, latestDate: dateKey(-1) },
  { canonicalType: 'vo2max', sampleCount: 2, dayCount: 2, latestDate: dateKey(-2) },
];

const demoDiagnostics: HealthConnectReadDiagnostic[] = [
  {
    recordType: 'SleepSession',
    canonicalType: 'sleep_session',
    permission: 'granted',
    readKind: 'records',
    recordsRead: 14,
    samplesWritten: 14,
  },
  {
    recordType: 'HeartRate',
    canonicalType: 'heart_rate',
    permission: 'granted',
    readKind: 'records',
    recordsRead: 96,
    samplesWritten: 96,
  },
  {
    recordType: 'RestingHeartRate',
    canonicalType: 'resting_heart_rate',
    permission: 'granted',
    readKind: 'records',
    recordsRead: 14,
    samplesWritten: 14,
  },
  {
    recordType: 'HeartRateVariabilityRmssd',
    canonicalType: 'hrv_rmssd',
    permission: 'granted',
    readKind: 'records',
    recordsRead: 14,
    samplesWritten: 14,
  },
];

const demoSourceFreshness: SourceFreshness[] = [
  {
    domain: 'sleep',
    label: 'Sleep',
    state: 'fresh',
    canonicalTypes: ['sleep_session'],
    sampleCount: 14,
    dayCount: 14,
    latestLocalDate: latestDate,
    lastUpdatedAt: `${latestDate}T06:45:00.000Z`,
    ageDays: 0,
    limitations: [],
  },
  {
    domain: 'workouts',
    label: 'Workouts',
    state: 'fresh',
    canonicalTypes: ['workout'],
    sampleCount: 9,
    dayCount: 7,
    latestLocalDate: dateKey(-1),
    lastUpdatedAt: `${dateKey(-1)}T07:52:00.000Z`,
    ageDays: 1,
    limitations: [],
  },
  {
    domain: 'steps',
    label: 'Steps',
    state: 'partial',
    canonicalTypes: ['steps'],
    sampleCount: 14,
    dayCount: 14,
    latestLocalDate: latestDate,
    lastUpdatedAt: `${latestDate}T10:15:00.000Z`,
    ageDays: 0,
    limitations: ['Today is still in progress; this domain may change after the next sync.'],
  },
  {
    domain: 'energy',
    label: 'Energy',
    state: 'partial',
    canonicalTypes: ['active_energy', 'total_energy'],
    sampleCount: 28,
    dayCount: 14,
    latestLocalDate: latestDate,
    lastUpdatedAt: `${latestDate}T10:15:00.000Z`,
    ageDays: 0,
    limitations: ['Today is still in progress; this domain may change after the next sync.'],
  },
  {
    domain: 'hrv',
    label: 'HRV',
    state: 'fresh',
    canonicalTypes: ['hrv_rmssd'],
    sampleCount: 14,
    dayCount: 14,
    latestLocalDate: latestDate,
    lastUpdatedAt: `${latestDate}T06:45:00.000Z`,
    ageDays: 0,
    limitations: [],
  },
  {
    domain: 'resting_hr',
    label: 'Resting HR',
    state: 'fresh',
    canonicalTypes: ['resting_heart_rate'],
    sampleCount: 14,
    dayCount: 14,
    latestLocalDate: latestDate,
    lastUpdatedAt: `${latestDate}T06:45:00.000Z`,
    ageDays: 0,
    limitations: [],
  },
  {
    domain: 'nutrition',
    label: 'Nutrition',
    state: 'partial',
    canonicalTypes: ['nutrition', 'hydration'],
    sampleCount: 8,
    dayCount: 8,
    latestLocalDate: latestDate,
    lastUpdatedAt: `${latestDate}T09:00:00.000Z`,
    ageDays: 0,
    limitations: ['Today is still in progress; this domain may change after the next sync.'],
  },
  {
    domain: 'body_composition',
    label: 'Body composition',
    state: 'fresh',
    canonicalTypes: ['weight', 'body_fat', 'lean_body_mass'],
    sampleCount: 12,
    dayCount: 4,
    latestLocalDate: dateKey(-1),
    lastUpdatedAt: `${dateKey(-1)}T06:30:00.000Z`,
    ageDays: 1,
    limitations: [],
  },
  {
    domain: 'check_ins',
    label: 'Check-ins',
    state: 'missing',
    canonicalTypes: [],
    sampleCount: 0,
    dayCount: 0,
    limitations: ['Daily check-ins are not implemented in local storage yet.'],
  },
];

const demoSnapshot: PipelineSnapshot = {
  totalSamples: 428,
  workoutCount: 9,
  sleepCount: 14,
  nutritionDays: 8,
  coverageDays: history.length,
  metricAvailability: demoMetricAvailability,
  sourceFreshness: demoSourceFreshness,
  latestDiagnostics: demoDiagnostics,
  today: history[0],
  history,
  recentWorkouts: [
    {
      workoutId: 'demo-run-1',
      platform: 'healthkit',
      sourceApp: 'Apple Watch',
      startAt: `${dateKey(-1)}T07:10:00.000Z`,
      endAt: `${dateKey(-1)}T07:52:00.000Z`,
      localDate: dateKey(-1),
      name: 'Easy Run',
      activityType: 'Running',
      sportBucket: 'run',
      elapsedSeconds: 2520,
      distanceKm: 6.4,
      activeKcal: 438,
      avgHrBpm: 142,
      maxHrBpm: 166,
      routeAvailable: true,
      rawJson: '{}',
    },
    {
      workoutId: 'demo-strength-1',
      platform: 'healthkit',
      sourceApp: 'Strength Log',
      startAt: `${dateKey(-3)}T18:20:00.000Z`,
      endAt: `${dateKey(-3)}T19:02:00.000Z`,
      localDate: dateKey(-3),
      name: 'Lower Strength',
      activityType: 'Traditional Strength Training',
      sportBucket: 'strength',
      elapsedSeconds: 2520,
      activeKcal: 220,
      rawJson: '{}',
    },
  ],
  recentSamples: [],
  recommendation: {
    readiness: 78,
    readinessLabel: 'Primed',
    color: 'positive',
    title: 'Aerobic base',
    detail: '40 min easy run, stay conversational',
    reason: 'Sleep is solid, HRV is above baseline, and recent training load is consistent.',
    opener: 'Morning. Your wearable data already shows a strong recovery profile today.',
    strain: 9.5,
    strainTarget: '8-11',
  },
};

let lastSync: SyncRunRow | null = {
  id: 1,
  provider: 'healthkit',
  started_at: new Date(Date.now() - 38 * 60 * 1000).toISOString(),
  ended_at: new Date(Date.now() - 37 * 60 * 1000).toISOString(),
  range_start: dateKey(-7),
  range_end: dateKey(0),
  sample_count: demoSnapshot.totalSamples,
  status: 'ok',
  error: null,
};

let goalProfile: GoalProfile | null = normalizeGoalProfile({
  primaryGoal: 'endurance',
  secondaryGoals: ['strength'],
  motivation: 'Build toward a confident half marathon block without overreaching.',
  timeframe: '12 weeks',
  experienceLevel: 'recreational',
  preferredActivities: ['run', 'strength', 'walk'],
  dislikedActivities: [],
  constraints: ['protect recovery', 'avoid sudden volume jumps'],
  riskFlags: [],
  coachingStyle: 'supportive',
  startingStrategy: 'conservative_build',
  confidence: 0.74,
});

export async function initTrainingStore(): Promise<void> {}

export async function getGoalProfile(): Promise<GoalProfile | null> {
  return goalProfile;
}

export async function saveGoalProfile(draft: GoalProfileDraft): Promise<GoalProfile> {
  goalProfile = normalizeGoalProfile({
    ...(goalProfile ?? {}),
    ...draft,
  });
  return goalProfile;
}

export async function clearGoalProfile(): Promise<void> {
  goalProfile = null;
}

export async function upsertSyncPayload(payload: SyncPayload): Promise<number> {
  return (
    payload.samples.length +
    payload.workouts.length +
    payload.sleepSessions.length +
    payload.nutritionDaily.length
  );
}

export async function recordSyncRun(
  provider: HealthProvider,
  range: SyncRange,
  sampleCount: number,
  startedAt: string,
  error?: unknown,
): Promise<void> {
  lastSync = {
    id: Date.now(),
    provider,
    started_at: startedAt,
    ended_at: new Date().toISOString(),
    range_start: range.startDate.toISOString(),
    range_end: range.endDate.toISOString(),
    sample_count: sampleCount,
    status: error ? 'error' : 'ok',
    error: error instanceof Error ? error.message : error ? String(error) : null,
  };
}

export async function getPipelineSnapshot(): Promise<PipelineSnapshot> {
  return demoSnapshot;
}

function demoTableCount(total: number, firstDate: string | null, latestDate: string | null) {
  return {
    total,
    first_date: firstDate,
    latest_date: latestDate,
  };
}

export async function getCoachHealthContext(_options: { rebuildDaily?: boolean } = {}) {
  const firstDate = dateKey(-13);
  const syncRuns = lastSync
    ? {
        total: 1,
        latestEndedAt: lastSync.ended_at,
        latestStatus: lastSync.status,
        latestSampleCount: lastSync.sample_count,
        latestRangeStart: lastSync.range_start,
        latestRangeEnd: lastSync.range_end,
      }
    : {
        total: 0,
        latestEndedAt: null,
        latestStatus: null,
        latestSampleCount: null,
        latestRangeStart: null,
        latestRangeEnd: null,
      };

  return {
    generatedAt: new Date().toISOString(),
    hasSyncedHealthData: true,
    sqliteTables: {
      healthSamples: demoTableCount(demoSnapshot.totalSamples, firstDate, latestDate),
      sleepSessions: demoTableCount(demoSnapshot.sleepCount, firstDate, latestDate),
      workouts: demoTableCount(demoSnapshot.workoutCount, dateKey(-12), dateKey(-1)),
      nutritionDaily: demoTableCount(demoSnapshot.nutritionDays, dateKey(-12), latestDate),
      dailyMetrics: demoTableCount(history.length, firstDate, latestDate),
      syncRuns,
    },
    metricAvailability: demoMetricAvailability,
    latestSamplesByType: [
      {
        canonicalType: 'hrv_rmssd' as CanonicalType,
        recordType: 'HeartRateVariabilityRmssd',
        sourceApp: 'Apple Watch',
        localDate: latestDate,
        startAt: `${latestDate}T06:45:00.000Z`,
        value: history[0].hrvLastNightAvg,
        unit: 'ms',
      },
      {
        canonicalType: 'resting_heart_rate' as CanonicalType,
        recordType: 'RestingHeartRate',
        sourceApp: 'Apple Watch',
        localDate: latestDate,
        startAt: `${latestDate}T06:45:00.000Z`,
        value: history[0].restingHr,
        unit: 'bpm',
      },
      {
        canonicalType: 'steps' as CanonicalType,
        recordType: 'Steps',
        sourceApp: 'Apple Watch',
        localDate: latestDate,
        startAt: `${latestDate}T23:59:00.000Z`,
        value: history[0].steps,
        unit: 'count',
      },
    ],
    recentDailyMetrics: demoSnapshot.history.slice(0, 7),
    recentWorkouts: demoSnapshot.recentWorkouts.slice(0, 5).map((workout) => ({
      localDate: workout.localDate,
      name: workout.name,
      activityType: workout.activityType,
      sportBucket: workout.sportBucket,
      elapsedSeconds: workout.elapsedSeconds,
      distanceKm: workout.distanceKm,
      activeKcal: workout.activeKcal,
      avgHrBpm: workout.avgHrBpm,
      sourceApp: workout.sourceApp,
    })),
    coachDataInstruction:
      'Expo web is using local mock SQLite-style demo data. Treat it as synced demo health data, not live device records.',
  };
}

export async function getLastSyncRun(): Promise<SyncRunRow | null> {
  return lastSync;
}

export async function getRecentSamples(): Promise<HealthSampleRow[]> {
  return [];
}

export async function getRecentWorkouts(): Promise<WorkoutRow[]> {
  return [];
}

export async function clearPipeline(): Promise<void> {
  lastSync = null;
}

export async function exportPipelineJson(): Promise<string> {
  return 'web-demo://biostream-pipeline.json';
}
