export const structuredCoachSchemaVersion = '2026-04-29' as const;

export const goalCategories = [
  'general_fitness',
  'body_composition',
  'strength',
  'endurance',
  'event_preparation',
  'return_to_training',
  'health_and_energy',
  'unknown',
] as const;

export const readinessStatuses = ['green', 'yellow', 'red', 'unknown'] as const;

export const riskFlagSeverities = [
  'none',
  'low',
  'moderate',
  'high',
  'urgent',
] as const;

export const riskFlagCategories = [
  'pain',
  'injury',
  'illness',
  'cardiovascular_symptom',
  'respiratory_symptom',
  'fainting',
  'pregnancy_related',
  'disordered_eating_signal',
  'severe_fatigue',
  'other',
] as const;

export const riskFlagSources = [
  'goal_profile',
  'event_profile',
  'daily_check_in',
  'typed_adjustment',
  'health_data',
  'coach_service',
  'unknown',
] as const;

export const recommendationImpacts = [
  'none',
  'lower_confidence',
  'reduce_intensity',
  'recovery_only',
  'professional_care',
] as const;

export const activityTypes = [
  'rest',
  'walk',
  'run',
  'ride',
  'strength',
  'mobility',
  'mixed',
  'unknown',
] as const;

export const intensityTargets = [
  'recovery',
  'easy',
  'steady',
  'moderate',
  'hard',
  'unknown',
] as const;

export type GoalCategory = (typeof goalCategories)[number];
export type ReadinessStatusValue = (typeof readinessStatuses)[number];
export type RiskFlagSeverity = (typeof riskFlagSeverities)[number];
export type RiskFlagCategory = (typeof riskFlagCategories)[number];
export type RiskFlagSource = (typeof riskFlagSources)[number];
export type RecommendationImpact = (typeof recommendationImpacts)[number];
export type ActivityType = (typeof activityTypes)[number];
export type IntensityTarget = (typeof intensityTargets)[number];

export type GoalProfile = {
  primary_goal: GoalCategory;
  secondary_goals: GoalCategory[];
  motivation: string | null;
  timeframe: string | null;
  experience_level: 'beginner' | 'recreational' | 'advanced' | 'returning' | 'unknown';
  preferred_activities: string[];
  disliked_activities: string[];
  constraints: string[];
  coaching_style: 'direct' | 'supportive' | 'technical' | 'unknown';
  starting_strategy: string;
  confidence: number;
  updated_at: string | null;
};

export type EventProfile = {
  event_intent: boolean;
  event_name: string | null;
  event_type: string | null;
  event_date: string | null;
  location: string | null;
  distance_or_format: string | null;
  missing_fields: string[];
  confidence: number;
};

export type RiskFlag = {
  id: string;
  category: RiskFlagCategory;
  severity: RiskFlagSeverity;
  source: RiskFlagSource;
  evidence: string;
  recommendation_impact: RecommendationImpact;
  professional_care_guidance: string | null;
  created_at: string;
};

export type RiskFlags = {
  generated_at: string;
  highest_severity: RiskFlagSeverity;
  has_blocking_risk: boolean;
  summary: string;
  items: RiskFlag[];
};

export type StaleDataReport = {
  generated_at: string;
  stale_signals: string[];
  missing_signals: string[];
  ignored_signals: string[];
  limitations: string[];
};

export type ReadinessStatus = {
  status: ReadinessStatusValue;
  confidence: number;
  score: number | null;
  signals_used: string[];
  stale_signals_ignored: string[];
  missing_signals: string[];
  conservative_adjustment_reason: string | null;
  summary: string;
};

export type RecommendationActivity = {
  title: string;
  activity_type: ActivityType;
  intensity_target: IntensityTarget;
  duration_minutes: number | null;
  volume: string | null;
  rationale: string;
};

export type DailyRecommendation = {
  readiness_status: ReadinessStatusValue;
  short_explanation: string;
  recommended_activity: RecommendationActivity;
  easier_alternative: RecommendationActivity;
  what_to_avoid_today: string[];
  confidence: number;
  sources_used: string[];
  sources_ignored: string[];
  check_in_question: string;
  risk_flags_applied: boolean;
};

export type HealthCheck = {
  generated_at: string;
  known: string[];
  uncertain: string[];
  stale: string[];
  missing: string[];
  risks: string[];
  summary_markdown: string;
};

export type StructuredCoachOutput = {
  schema_version: typeof structuredCoachSchemaVersion;
  generated_at: string;
  goal_profile: GoalProfile;
  event_profile: EventProfile;
  risk_flags: RiskFlags;
  stale_data_report: StaleDataReport;
  readiness_status: ReadinessStatus;
  daily_recommendation: DailyRecommendation;
  health_check: HealthCheck;
  inspection_notes: string[];
};

type RecordValue = Record<string, unknown>;

function isRecord(value: unknown): value is RecordValue {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function fail(path: string, message = 'is required'): never {
  throw new Error(`${path} ${message}`);
}

function requireRecord(value: unknown, path: string): RecordValue {
  if (value == null) {
    return fail(path);
  }
  if (!isRecord(value)) {
    return fail(path, 'must be an object');
  }
  return value;
}

function requireString(value: unknown, path: string): string {
  if (value == null) {
    return fail(path);
  }
  if (typeof value !== 'string' || !value.trim()) {
    return fail(path, 'must be a non-empty string');
  }
  return value;
}

function requireNullableString(value: unknown, path: string): string | null {
  if (value === null) {
    return null;
  }
  return requireString(value, path);
}

function requireBoolean(value: unknown, path: string): boolean {
  if (value == null) {
    return fail(path);
  }
  if (typeof value !== 'boolean') {
    return fail(path, 'must be a boolean');
  }
  return value;
}

function requireNumber(value: unknown, path: string): number {
  if (value == null) {
    return fail(path);
  }
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fail(path, 'must be a finite number');
  }
  return value;
}

function requireNullableNumber(value: unknown, path: string): number | null {
  if (value === null) {
    return null;
  }
  return requireNumber(value, path);
}

function requireScore(value: unknown, path: string): number {
  const score = requireNumber(value, path);
  if (score < 0 || score > 1) {
    return fail(path, 'must be between 0 and 1');
  }
  return score;
}

function requireStringArray(value: unknown, path: string): string[] {
  if (value == null) {
    return fail(path);
  }
  if (!Array.isArray(value)) {
    return fail(path, 'must be an array');
  }
  return value.map((item, index) => requireString(item, `${path}[${index}]`));
}

function requireUnion<T extends readonly string[]>(
  value: unknown,
  path: string,
  allowed: T,
): T[number] {
  if (value == null) {
    return fail(path);
  }
  if (typeof value !== 'string' || !allowed.includes(value)) {
    return fail(path, `must be one of ${allowed.join(', ')}`);
  }
  return value;
}

function parseGoalProfile(value: unknown): GoalProfile {
  const profile = requireRecord(value, 'goal_profile');
  return {
    primary_goal: requireUnion(profile.primary_goal, 'goal_profile.primary_goal', goalCategories),
    secondary_goals: requireStringArray(
      profile.secondary_goals,
      'goal_profile.secondary_goals',
    ).map((goal, index) =>
      requireUnion(goal, `goal_profile.secondary_goals[${index}]`, goalCategories),
    ),
    motivation: requireNullableString(profile.motivation, 'goal_profile.motivation'),
    timeframe: requireNullableString(profile.timeframe, 'goal_profile.timeframe'),
    experience_level: requireUnion(profile.experience_level, 'goal_profile.experience_level', [
      'beginner',
      'recreational',
      'advanced',
      'returning',
      'unknown',
    ] as const),
    preferred_activities: requireStringArray(
      profile.preferred_activities,
      'goal_profile.preferred_activities',
    ),
    disliked_activities: requireStringArray(
      profile.disliked_activities,
      'goal_profile.disliked_activities',
    ),
    constraints: requireStringArray(profile.constraints, 'goal_profile.constraints'),
    coaching_style: requireUnion(profile.coaching_style, 'goal_profile.coaching_style', [
      'direct',
      'supportive',
      'technical',
      'unknown',
    ] as const),
    starting_strategy: requireString(profile.starting_strategy, 'goal_profile.starting_strategy'),
    confidence: requireScore(profile.confidence, 'goal_profile.confidence'),
    updated_at: requireNullableString(profile.updated_at, 'goal_profile.updated_at'),
  };
}

function parseEventProfile(value: unknown): EventProfile {
  const profile = requireRecord(value, 'event_profile');
  return {
    event_intent: requireBoolean(profile.event_intent, 'event_profile.event_intent'),
    event_name: requireNullableString(profile.event_name, 'event_profile.event_name'),
    event_type: requireNullableString(profile.event_type, 'event_profile.event_type'),
    event_date: requireNullableString(profile.event_date, 'event_profile.event_date'),
    location: requireNullableString(profile.location, 'event_profile.location'),
    distance_or_format: requireNullableString(
      profile.distance_or_format,
      'event_profile.distance_or_format',
    ),
    missing_fields: requireStringArray(profile.missing_fields, 'event_profile.missing_fields'),
    confidence: requireScore(profile.confidence, 'event_profile.confidence'),
  };
}

function parseRiskFlags(value: unknown): RiskFlags {
  const flags = requireRecord(value, 'risk_flags');
  const itemsValue = flags.items;

  if (!Array.isArray(itemsValue)) {
    fail('risk_flags.items', 'must be an array');
  }

  return {
    generated_at: requireString(flags.generated_at, 'risk_flags.generated_at'),
    highest_severity: requireUnion(
      flags.highest_severity,
      'risk_flags.highest_severity',
      riskFlagSeverities,
    ),
    has_blocking_risk: requireBoolean(flags.has_blocking_risk, 'risk_flags.has_blocking_risk'),
    summary: requireString(flags.summary, 'risk_flags.summary'),
    items: itemsValue.map((item, index) => {
      const flag = requireRecord(item, `risk_flags.items[${index}]`);
      return {
        id: requireString(flag.id, `risk_flags.items[${index}].id`),
        category: requireUnion(
          flag.category,
          `risk_flags.items[${index}].category`,
          riskFlagCategories,
        ),
        severity: requireUnion(
          flag.severity,
          `risk_flags.items[${index}].severity`,
          riskFlagSeverities,
        ),
        source: requireUnion(
          flag.source,
          `risk_flags.items[${index}].source`,
          riskFlagSources,
        ),
        evidence: requireString(flag.evidence, `risk_flags.items[${index}].evidence`),
        recommendation_impact: requireUnion(
          flag.recommendation_impact,
          `risk_flags.items[${index}].recommendation_impact`,
          recommendationImpacts,
        ),
        professional_care_guidance: requireNullableString(
          flag.professional_care_guidance,
          `risk_flags.items[${index}].professional_care_guidance`,
        ),
        created_at: requireString(flag.created_at, `risk_flags.items[${index}].created_at`),
      };
    }),
  };
}

function parseStaleDataReport(value: unknown): StaleDataReport {
  const report = requireRecord(value, 'stale_data_report');
  return {
    generated_at: requireString(report.generated_at, 'stale_data_report.generated_at'),
    stale_signals: requireStringArray(report.stale_signals, 'stale_data_report.stale_signals'),
    missing_signals: requireStringArray(
      report.missing_signals,
      'stale_data_report.missing_signals',
    ),
    ignored_signals: requireStringArray(
      report.ignored_signals,
      'stale_data_report.ignored_signals',
    ),
    limitations: requireStringArray(report.limitations, 'stale_data_report.limitations'),
  };
}

function parseReadinessStatus(value: unknown): ReadinessStatus {
  const readiness = requireRecord(value, 'readiness_status');
  return {
    status: requireUnion(readiness.status, 'readiness_status.status', readinessStatuses),
    confidence: requireScore(readiness.confidence, 'readiness_status.confidence'),
    score: requireNullableNumber(readiness.score, 'readiness_status.score'),
    signals_used: requireStringArray(readiness.signals_used, 'readiness_status.signals_used'),
    stale_signals_ignored: requireStringArray(
      readiness.stale_signals_ignored,
      'readiness_status.stale_signals_ignored',
    ),
    missing_signals: requireStringArray(
      readiness.missing_signals,
      'readiness_status.missing_signals',
    ),
    conservative_adjustment_reason: requireNullableString(
      readiness.conservative_adjustment_reason,
      'readiness_status.conservative_adjustment_reason',
    ),
    summary: requireString(readiness.summary, 'readiness_status.summary'),
  };
}

function parseRecommendationActivity(value: unknown, path: string): RecommendationActivity {
  const activity = requireRecord(value, path);
  return {
    title: requireString(activity.title, `${path}.title`),
    activity_type: requireUnion(activity.activity_type, `${path}.activity_type`, activityTypes),
    intensity_target: requireUnion(
      activity.intensity_target,
      `${path}.intensity_target`,
      intensityTargets,
    ),
    duration_minutes: requireNullableNumber(activity.duration_minutes, `${path}.duration_minutes`),
    volume: requireNullableString(activity.volume, `${path}.volume`),
    rationale: requireString(activity.rationale, `${path}.rationale`),
  };
}

function parseDailyRecommendation(value: unknown): DailyRecommendation {
  const recommendation = requireRecord(value, 'daily_recommendation');
  return {
    readiness_status: requireUnion(
      recommendation.readiness_status,
      'daily_recommendation.readiness_status',
      readinessStatuses,
    ),
    short_explanation: requireString(
      recommendation.short_explanation,
      'daily_recommendation.short_explanation',
    ),
    recommended_activity: parseRecommendationActivity(
      recommendation.recommended_activity,
      'daily_recommendation.recommended_activity',
    ),
    easier_alternative: parseRecommendationActivity(
      recommendation.easier_alternative,
      'daily_recommendation.easier_alternative',
    ),
    what_to_avoid_today: requireStringArray(
      recommendation.what_to_avoid_today,
      'daily_recommendation.what_to_avoid_today',
    ),
    confidence: requireScore(recommendation.confidence, 'daily_recommendation.confidence'),
    sources_used: requireStringArray(
      recommendation.sources_used,
      'daily_recommendation.sources_used',
    ),
    sources_ignored: requireStringArray(
      recommendation.sources_ignored,
      'daily_recommendation.sources_ignored',
    ),
    check_in_question: requireString(
      recommendation.check_in_question,
      'daily_recommendation.check_in_question',
    ),
    risk_flags_applied: requireBoolean(
      recommendation.risk_flags_applied,
      'daily_recommendation.risk_flags_applied',
    ),
  };
}

function parseHealthCheck(value: unknown): HealthCheck {
  const healthCheck = requireRecord(value, 'health_check');
  return {
    generated_at: requireString(healthCheck.generated_at, 'health_check.generated_at'),
    known: requireStringArray(healthCheck.known, 'health_check.known'),
    uncertain: requireStringArray(healthCheck.uncertain, 'health_check.uncertain'),
    stale: requireStringArray(healthCheck.stale, 'health_check.stale'),
    missing: requireStringArray(healthCheck.missing, 'health_check.missing'),
    risks: requireStringArray(healthCheck.risks, 'health_check.risks'),
    summary_markdown: requireString(healthCheck.summary_markdown, 'health_check.summary_markdown'),
  };
}

export function parseStructuredCoachOutput(value: unknown): StructuredCoachOutput {
  const output = requireRecord(value, 'structured_coach_output');
  const schemaVersion = requireString(output.schema_version, 'schema_version');

  if (schemaVersion !== structuredCoachSchemaVersion) {
    fail('schema_version', `must be ${structuredCoachSchemaVersion}`);
  }

  return {
    schema_version: structuredCoachSchemaVersion,
    generated_at: requireString(output.generated_at, 'generated_at'),
    goal_profile: parseGoalProfile(output.goal_profile),
    event_profile: parseEventProfile(output.event_profile),
    risk_flags: parseRiskFlags(output.risk_flags),
    stale_data_report: parseStaleDataReport(output.stale_data_report),
    readiness_status: parseReadinessStatus(output.readiness_status),
    daily_recommendation: parseDailyRecommendation(output.daily_recommendation),
    health_check: parseHealthCheck(output.health_check),
    inspection_notes: requireStringArray(output.inspection_notes, 'inspection_notes'),
  };
}
