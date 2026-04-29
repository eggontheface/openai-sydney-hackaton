export type PrimaryGoal =
  | 'general_fitness'
  | 'body_composition'
  | 'strength'
  | 'endurance'
  | 'event_preparation'
  | 'return_to_training'
  | 'health_and_energy'
  | 'unknown';

export type ExperienceLevel =
  | 'first_time'
  | 'returning_after_gap'
  | 'inconsistent'
  | 'recreational'
  | 'advanced'
  | 'unknown';

export type CoachingStyle =
  | 'supportive'
  | 'direct'
  | 'educational'
  | 'minimal'
  | 'unknown';

export type StartingStrategy =
  | 'baseline'
  | 'conservative_build'
  | 'maintain'
  | 'event_phases'
  | 'unknown';

export type GoalProfile = {
  primaryGoal: PrimaryGoal;
  secondaryGoals: PrimaryGoal[];
  motivation: string | null;
  timeframe: string | null;
  experienceLevel: ExperienceLevel;
  preferredActivities: string[];
  dislikedActivities: string[];
  constraints: string[];
  riskFlags: string[];
  coachingStyle: CoachingStyle;
  startingStrategy: StartingStrategy;
  confidence: number;
  updatedAt: string;
};

export type GoalProfileDraft = Partial<Omit<GoalProfile, 'updatedAt'>>;

export const emptyGoalProfile: GoalProfile = {
  primaryGoal: 'unknown',
  secondaryGoals: [],
  motivation: null,
  timeframe: null,
  experienceLevel: 'unknown',
  preferredActivities: [],
  dislikedActivities: [],
  constraints: [],
  riskFlags: [],
  coachingStyle: 'unknown',
  startingStrategy: 'unknown',
  confidence: 0,
  updatedAt: '',
};

const primaryGoals = new Set<PrimaryGoal>([
  'general_fitness',
  'body_composition',
  'strength',
  'endurance',
  'event_preparation',
  'return_to_training',
  'health_and_energy',
  'unknown',
]);

const experienceLevels = new Set<ExperienceLevel>([
  'first_time',
  'returning_after_gap',
  'inconsistent',
  'recreational',
  'advanced',
  'unknown',
]);

const coachingStyles = new Set<CoachingStyle>([
  'supportive',
  'direct',
  'educational',
  'minimal',
  'unknown',
]);

const startingStrategies = new Set<StartingStrategy>([
  'baseline',
  'conservative_build',
  'maintain',
  'event_phases',
  'unknown',
]);

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean);
}

function numberInRange(value: unknown): number {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return 0;
  }

  return Math.max(0, Math.min(1, number));
}

function primaryGoal(value: unknown): PrimaryGoal {
  return primaryGoals.has(value as PrimaryGoal) ? (value as PrimaryGoal) : 'unknown';
}

function experienceLevel(value: unknown): ExperienceLevel {
  return experienceLevels.has(value as ExperienceLevel)
    ? (value as ExperienceLevel)
    : 'unknown';
}

function coachingStyle(value: unknown): CoachingStyle {
  return coachingStyles.has(value as CoachingStyle)
    ? (value as CoachingStyle)
    : 'unknown';
}

function startingStrategy(value: unknown): StartingStrategy {
  return startingStrategies.has(value as StartingStrategy)
    ? (value as StartingStrategy)
    : 'unknown';
}

export function normalizeGoalProfile(
  draft: GoalProfileDraft,
  updatedAt = new Date().toISOString(),
): GoalProfile {
  return {
    primaryGoal: primaryGoal(draft.primaryGoal),
    secondaryGoals: stringArray(draft.secondaryGoals).map(primaryGoal),
    motivation: stringOrNull(draft.motivation),
    timeframe: stringOrNull(draft.timeframe),
    experienceLevel: experienceLevel(draft.experienceLevel),
    preferredActivities: stringArray(draft.preferredActivities),
    dislikedActivities: stringArray(draft.dislikedActivities),
    constraints: stringArray(draft.constraints),
    riskFlags: stringArray(draft.riskFlags),
    coachingStyle: coachingStyle(draft.coachingStyle),
    startingStrategy: startingStrategy(draft.startingStrategy),
    confidence: numberInRange(draft.confidence),
    updatedAt,
  };
}
