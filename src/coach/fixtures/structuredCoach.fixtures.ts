import {
  structuredCoachSchemaVersion,
  type StructuredCoachOutput,
} from '../schemas';

const generatedAt = '2026-04-29T12:00:00.000Z';

export const completeStructuredCoachOutputFixture: StructuredCoachOutput = {
  schema_version: structuredCoachSchemaVersion,
  generated_at: generatedAt,
  goal_profile: {
    primary_goal: 'endurance',
    secondary_goals: ['general_fitness'],
    motivation: 'Build consistent aerobic fitness.',
    timeframe: 'next 8 weeks',
    experience_level: 'recreational',
    preferred_activities: ['run', 'walk', 'strength'],
    disliked_activities: [],
    constraints: ['avoid sudden mileage jumps'],
    coaching_style: 'direct',
    starting_strategy: 'Keep the first recommendation conservative until freshness improves.',
    confidence: 0.72,
    updated_at: generatedAt,
  },
  event_profile: {
    event_intent: false,
    event_name: null,
    event_type: null,
    event_date: null,
    location: null,
    distance_or_format: null,
    missing_fields: [],
    confidence: 0.4,
  },
  risk_flags: {
    generated_at: generatedAt,
    highest_severity: 'none',
    has_blocking_risk: false,
    summary: 'No risk flags were supplied in the current structured input.',
    items: [
      {
        id: 'no-risk-reported',
        category: 'other',
        severity: 'none',
        source: 'coach_service',
        evidence: 'No pain, illness, injury, or severe fatigue signal was provided.',
        recommendation_impact: 'none',
        professional_care_guidance: null,
        created_at: generatedAt,
      },
    ],
  },
  stale_data_report: {
    generated_at: generatedAt,
    stale_signals: ['training_load'],
    missing_signals: ['daily_check_in'],
    ignored_signals: ['stale training load'],
    limitations: [
      'Training load is unavailable until a source or local model provides it.',
      'No same-day subjective check-in was supplied.',
    ],
  },
  readiness_status: {
    status: 'yellow',
    confidence: 0.62,
    score: 58,
    signals_used: ['recent workouts', 'sleep duration', 'resting heart rate'],
    stale_signals_ignored: ['training load'],
    missing_signals: ['daily check-in'],
    conservative_adjustment_reason:
      'Freshness is mixed and there is no subjective check-in, so intensity should stay easy.',
    summary: 'Mixed but usable readiness signals support an easy session.',
  },
  daily_recommendation: {
    readiness_status: 'yellow',
    short_explanation:
      'Use today to build consistency without testing fitness because freshness is mixed.',
    recommended_activity: {
      title: 'Easy aerobic run',
      activity_type: 'run',
      intensity_target: 'easy',
      duration_minutes: 35,
      volume: 'Conversational pace only',
      rationale: 'Easy aerobic work fits the goal while avoiding a load spike.',
    },
    easier_alternative: {
      title: 'Walk plus mobility',
      activity_type: 'walk',
      intensity_target: 'recovery',
      duration_minutes: 25,
      volume: 'Relaxed walk and 5 minutes mobility',
      rationale: 'This keeps momentum if subjective readiness is lower than the data suggests.',
    },
    what_to_avoid_today: ['hard intervals', 'testing max pace', 'large volume increase'],
    confidence: 0.62,
    sources_used: ['recent workouts', 'sleep duration', 'resting heart rate'],
    sources_ignored: ['stale training load'],
    check_in_question: 'Any pain, illness, unusual breathlessness, or severe fatigue today?',
    risk_flags_applied: false,
  },
  health_check: {
    generated_at: generatedAt,
    known: ['Recent workout history exists', 'Some recovery signals are available'],
    uncertain: ['Subjective soreness and energy are unknown'],
    stale: ['Training load'],
    missing: ['Daily check-in'],
    risks: ['No risk flags supplied'],
    summary_markdown:
      'Readiness is usable but incomplete. Keep the recommendation easy and source-aware.',
  },
  inspection_notes: [
    'Mock fixture is deterministic and does not require an OpenAI API key.',
    'Issue 6 owns actual risk flag extraction and conservative override logic.',
  ],
};

export const unknownReadinessStructuredCoachOutputFixture: StructuredCoachOutput = {
  ...completeStructuredCoachOutputFixture,
  readiness_status: {
    status: 'unknown',
    confidence: 0.35,
    score: null,
    signals_used: [],
    stale_signals_ignored: [],
    missing_signals: ['sleep', 'recent workouts', 'daily check-in', 'risk flag inputs'],
    conservative_adjustment_reason:
      'Missing inputs lower confidence and require a safer recommendation.',
    summary: 'Readiness is unknown because there is not enough fresh data.',
  },
  daily_recommendation: {
    ...completeStructuredCoachOutputFixture.daily_recommendation,
    readiness_status: 'unknown',
    short_explanation:
      'Not enough fresh data is available, so choose a low-risk baseline option.',
    recommended_activity: {
      title: 'Baseline walk',
      activity_type: 'walk',
      intensity_target: 'recovery',
      duration_minutes: 20,
      volume: 'Relaxed pace',
      rationale: 'Unknown readiness should not be treated as neutral.',
    },
    easier_alternative: {
      title: 'Mobility reset',
      activity_type: 'mobility',
      intensity_target: 'recovery',
      duration_minutes: 10,
      volume: 'Gentle range of motion',
      rationale: 'A shorter option is appropriate when confidence is low.',
    },
    what_to_avoid_today: ['hard efforts', 'new maxes', 'long sessions'],
    confidence: 0.35,
    sources_used: [],
    sources_ignored: [],
    check_in_question: 'How are sleep, soreness, energy, and pain today?',
    risk_flags_applied: false,
  },
  health_check: {
    ...completeStructuredCoachOutputFixture.health_check,
    known: [],
    uncertain: ['Current readiness'],
    stale: [],
    missing: ['Fresh wearable data', 'Daily check-in', 'Risk flag inputs'],
    summary_markdown:
      'Current readiness is unknown. Recommend a conservative baseline option.',
  },
};
