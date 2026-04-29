export type HealthPlatform = 'health_connect' | 'healthkit';

export type HealthProvider = HealthPlatform;

export type CanonicalType =
  | 'steps'
  | 'active_energy'
  | 'total_energy'
  | 'distance'
  | 'heart_rate'
  | 'resting_heart_rate'
  | 'hrv_rmssd'
  | 'hrv_sdnn'
  | 'sleep_session'
  | 'workout'
  | 'weight'
  | 'body_fat'
  | 'lean_body_mass'
  | 'nutrition'
  | 'hydration'
  | 'vo2max';

export type HealthMetric = CanonicalType;

export type SportBucket = 'run' | 'ride' | 'strength' | 'swim' | 'walk' | 'other';

export type SourceFreshnessState = 'fresh' | 'stale' | 'missing' | 'partial';

export type SourceFreshnessDomain =
  | 'sleep'
  | 'workouts'
  | 'steps'
  | 'energy'
  | 'hrv'
  | 'resting_hr'
  | 'nutrition'
  | 'body_composition'
  | 'check_ins';

export type HrvMethod = 'RMSSD' | 'SDNN';

export type SourceFreshness = {
  domain: SourceFreshnessDomain;
  label: string;
  state: SourceFreshnessState;
  canonicalTypes: CanonicalType[];
  sampleCount: number;
  dayCount: number;
  latestLocalDate?: string;
  lastUpdatedAt?: string;
  ageDays?: number;
  limitations: string[];
};

export type HealthSample = {
  sampleId: string;
  platform: HealthPlatform;
  recordType: string;
  canonicalType: CanonicalType;
  sourceApp?: string;
  sourceDevice?: string;
  startAt: string;
  endAt: string;
  localDate: string;
  timezone?: string;
  value?: number;
  unit?: string;
  metadataJson: string;
  sourceModifiedAt?: string;
};

export type WorkoutRecord = {
  workoutId: string;
  platform: HealthPlatform;
  sourceApp?: string;
  startAt: string;
  endAt: string;
  localDate: string;
  name?: string;
  activityType?: string;
  sportBucket: SportBucket;
  elapsedSeconds: number;
  movingSeconds?: number;
  distanceKm?: number;
  activeKcal?: number;
  totalKcal?: number;
  avgHrBpm?: number;
  maxHrBpm?: number;
  routeAvailable?: boolean;
  lapsJson?: string;
  streamsJson?: string;
  rawJson: string;
};

export type SleepSessionRecord = {
  sleepId: string;
  platform: HealthPlatform;
  sourceApp?: string;
  startAt: string;
  endAt: string;
  wakeDate: string;
  sleepSeconds: number;
  timeInBedSeconds: number;
  deepSleepSeconds?: number;
  lightSleepSeconds?: number;
  remSleepSeconds?: number;
  awakeSeconds?: number;
  sleepStageJson?: string;
  sleepEfficiency?: number;
  wakeupCount?: number;
  rawJson: string;
};

export type NutritionDailyRecord = {
  date: string;
  kcalIn?: number;
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
  fiberG?: number;
  sugarG?: number;
  cholesterolMg?: number;
  waterMl?: number;
  caffeineMg?: number;
  sodiumMg?: number;
  entryCount: number;
  mealCount?: number;
  allNutrientsJson: string;
  sourceModifiedAt?: string;
};

export type SyncRange = {
  startDate: Date;
  endDate: Date;
};

export type SyncPayload = {
  provider: HealthProvider;
  samples: HealthSample[];
  workouts: WorkoutRecord[];
  sleepSessions: SleepSessionRecord[];
  nutritionDaily: NutritionDailyRecord[];
  diagnostics: HealthConnectReadDiagnostic[];
  warnings: string[];
};

export type SyncResult = SyncPayload;

export type HealthConnectReadDiagnostic = {
  recordType: string;
  canonicalType: CanonicalType;
  permission: 'granted' | 'missing';
  readKind: 'aggregate' | 'records';
  recordsRead: number;
  samplesWritten: number;
  message?: string;
};

export type MetricSummary = {
  metric: CanonicalType;
  value: number;
  unit: string;
  samples: number;
};

export type DailyMetrics = {
  date: string;
  dataCompleteness: 'empty' | 'partial' | 'full';
  wellnessDataStatus: string;
  sourceCount: number;
  hasPlatformWellness: boolean;
  hasActivity: boolean;
  hasNutrition: boolean;
  hasSleep: boolean;
  hasSteps: boolean;
  hasEnergy: boolean;
  steps?: number;
  activeKcal?: number;
  totalKcal?: number;
  distanceKm?: number;
  sleepSeconds?: number;
  timeInBedSeconds?: number;
  sleepEfficiency?: number;
  restingHr?: number;
  heartRateAvgBpm?: number;
  heartRateMinBpm?: number;
  heartRateMaxBpm?: number;
  hrvLastNightAvg?: number;
  hrvMethod?: HrvMethod;
  hrvSourceApp?: string;
  workoutCount?: number;
  runWorkoutCount?: number;
  rideWorkoutCount?: number;
  strengthWorkoutCount?: number;
  activityElapsedSeconds?: number;
  activityKcal?: number;
  kcalIn?: number;
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
  fiberG?: number;
  sugarG?: number;
  waterMl?: number;
  weightKg?: number;
  bodyFatPct?: number;
  leanBodyMassKg?: number;
  vo2max?: number;
  generatedAt: string;
};

export type CoachTone = 'positive' | 'warm' | 'cool' | 'neutral';

export type CoachRecommendation = {
  readiness: number | null;
  readinessLabel: string;
  color: CoachTone;
  title: string;
  detail: string;
  reason: string;
  opener: string;
  strain: number;
  strainTarget: string;
};

export type MetricAvailability = {
  canonicalType: CanonicalType;
  sampleCount: number;
  dayCount: number;
  latestDate?: string;
};

export type PipelineSnapshot = {
  totalSamples: number;
  workoutCount: number;
  sleepCount: number;
  nutritionDays: number;
  coverageDays: number;
  metricAvailability: MetricAvailability[];
  sourceFreshness: SourceFreshness[];
  latestDiagnostics: HealthConnectReadDiagnostic[];
  today: DailyMetrics | null;
  history: DailyMetrics[];
  recentWorkouts: WorkoutRecord[];
  recentSamples: HealthSample[];
  recommendation: CoachRecommendation;
};
