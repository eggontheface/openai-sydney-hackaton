import type {
  CanonicalType,
  DailyMetrics,
  HealthProvider,
  PipelineSnapshot,
  SyncPayload,
  SyncRange,
} from '../health/types';

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

const demoSnapshot: PipelineSnapshot = {
  totalSamples: 428,
  workoutCount: 9,
  sleepCount: 14,
  nutritionDays: 8,
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

export async function initTrainingStore(): Promise<void> {}

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
