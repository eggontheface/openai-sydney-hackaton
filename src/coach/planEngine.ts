import type { PipelineSnapshot, SportBucket } from '../health/types';

export type TrainingGoal = 'run' | 'cycle' | 'event' | 'muscle';
export type WorkoutCapture = 'watch' | 'manual' | 'none';

export type PlannedWorkout = {
  id: string;
  day: string;
  label: string;
  title: string;
  detail: string;
  sport: SportBucket | 'recovery';
  capture: WorkoutCapture;
  intensity: 'easy' | 'steady' | 'moderate' | 'hard' | 'recovery';
  durationMinutes: number;
  reason: string;
  metrics: string[];
};

export type TrainingPlan = {
  goal: TrainingGoal;
  today: PlannedWorkout;
  week: PlannedWorkout[];
  whyToday: string;
  guardrail: string;
};

type DayTemplate = Omit<PlannedWorkout, 'id' | 'day' | 'label'>;

const dayMs = 24 * 60 * 60 * 1000;

function addDays(date: Date, offset: number) {
  return new Date(date.getTime() + offset * dayMs);
}

function dayLabel(date: Date) {
  return date.toLocaleDateString(undefined, { weekday: 'short' });
}

function dayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function readinessBand(snapshot: PipelineSnapshot) {
  const readiness = snapshot.recommendation.readiness;

  if (readiness == null) return 'needs-baseline';
  if (readiness >= 72) return 'green';
  if (readiness >= 55) return 'yellow';
  return 'red';
}

function scaleDuration(base: number, snapshot: PipelineSnapshot) {
  const band = readinessBand(snapshot);
  const hasRecentTraining = snapshot.workoutCount > 2 || snapshot.recentWorkouts.length > 2;

  if (!hasRecentTraining) return Math.max(20, Math.round(base * 0.65));
  if (band === 'red') return Math.max(20, Math.round(base * 0.55));
  if (band === 'yellow' || band === 'needs-baseline') return Math.max(25, Math.round(base * 0.8));
  return base;
}

function watchMetrics(sport: PlannedWorkout['sport']) {
  if (sport === 'run' || sport === 'walk') return ['pace', 'distance', 'heart rate', 'duration'];
  if (sport === 'ride') return ['speed', 'distance', 'heart rate', 'duration'];
  if (sport === 'swim') return ['laps', 'distance', 'heart rate', 'duration'];
  return [];
}

function withDuration(template: DayTemplate, snapshot: PipelineSnapshot): DayTemplate {
  if (template.capture === 'manual' || template.capture === 'none') return template;

  return {
    ...template,
    durationMinutes: scaleDuration(template.durationMinutes, snapshot),
  };
}

function runWeek(snapshot: PipelineSnapshot): DayTemplate[] {
  return [
    withDuration({
      title: 'Easy aerobic run',
      detail: 'Stay conversational and finish feeling like you could keep going.',
      sport: 'run',
      capture: 'watch',
      intensity: 'easy',
      durationMinutes: 40,
      reason: 'Build aerobic capacity without adding unnecessary strain.',
      metrics: watchMetrics('run'),
    }, snapshot),
    {
      title: 'Strength foundation',
      detail: 'Goblet squat, Romanian deadlift, split squat, row, and calf raises.',
      sport: 'strength',
      capture: 'manual',
      intensity: 'moderate',
      durationMinutes: 35,
      reason: 'Strength protects the running block and gives the coach usable load trends.',
      metrics: ['exercise', 'sets', 'reps', 'load', 'RPE'],
    },
    withDuration({
      title: 'Recovery walk',
      detail: 'Keep it relaxed. The goal is circulation, not fitness testing.',
      sport: 'walk',
      capture: 'watch',
      intensity: 'recovery',
      durationMinutes: 30,
      reason: 'A low-pressure day helps confirm readiness before the next run.',
      metrics: watchMetrics('walk'),
    }, snapshot),
    withDuration({
      title: 'Steady run',
      detail: 'Warm up easy, then settle into a smooth controlled rhythm.',
      sport: 'run',
      capture: 'watch',
      intensity: 'steady',
      durationMinutes: 45,
      reason: 'A controlled steady effort supports the goal without overreaching.',
      metrics: watchMetrics('run'),
    }, snapshot),
    {
      title: 'Mobility reset',
      detail: 'Hips, ankles, calves, and light core work.',
      sport: 'recovery',
      capture: 'none',
      intensity: 'recovery',
      durationMinutes: 20,
      reason: 'Keep the body moving while absorbing the week.',
      metrics: [],
    },
    withDuration({
      title: 'Long easy run',
      detail: 'Hold back early. The win is consistency and even pacing.',
      sport: 'run',
      capture: 'watch',
      intensity: 'easy',
      durationMinutes: 65,
      reason: 'Long easy volume is the highest-value half-marathon builder.',
      metrics: watchMetrics('run'),
    }, snapshot),
    {
      title: 'Rest day',
      detail: 'Optional light walk only if it feels good.',
      sport: 'recovery',
      capture: 'none',
      intensity: 'recovery',
      durationMinutes: 0,
      reason: 'The plan only works if recovery is protected.',
      metrics: [],
    },
  ];
}

function eventWeek(snapshot: PipelineSnapshot): DayTemplate[] {
  return [
    withDuration({
      title: 'Aerobic run',
      detail: 'Controlled run with smooth cadence.',
      sport: 'run',
      capture: 'watch',
      intensity: 'easy',
      durationMinutes: 35,
      reason: 'Keeps run frequency without crowding the event week.',
      metrics: watchMetrics('run'),
    }, snapshot),
    withDuration({
      title: 'Swim technique',
      detail: 'Easy drills and steady relaxed lengths.',
      sport: 'swim',
      capture: 'watch',
      intensity: 'easy',
      durationMinutes: 30,
      reason: 'Technique-first swim volume adds skill without heavy fatigue.',
      metrics: watchMetrics('swim'),
    }, snapshot),
    {
      title: 'Strength maintenance',
      detail: 'Lower volume full-body work. Stop well short of failure.',
      sport: 'strength',
      capture: 'manual',
      intensity: 'moderate',
      durationMinutes: 30,
      reason: 'Maintain strength while limiting soreness.',
      metrics: ['exercise', 'sets', 'reps', 'load', 'RPE'],
    },
    withDuration({
      title: 'Bike endurance',
      detail: 'Mostly easy with a few short cadence pick-ups.',
      sport: 'ride',
      capture: 'watch',
      intensity: 'steady',
      durationMinutes: 55,
      reason: 'Bike volume builds aerobic capacity with lower impact.',
      metrics: watchMetrics('ride'),
    }, snapshot),
    {
      title: 'Mobility reset',
      detail: 'Light mobility and breathing.',
      sport: 'recovery',
      capture: 'none',
      intensity: 'recovery',
      durationMinutes: 20,
      reason: 'Reduce stiffness before the larger weekend session.',
      metrics: [],
    },
    withDuration({
      title: 'Brick session',
      detail: 'Easy bike followed by a short relaxed run.',
      sport: 'ride',
      capture: 'watch',
      intensity: 'moderate',
      durationMinutes: 70,
      reason: 'Event-specific practice without making the week too aggressive.',
      metrics: watchMetrics('ride'),
    }, snapshot),
    {
      title: 'Rest day',
      detail: 'Protect recovery and review how the week felt.',
      sport: 'recovery',
      capture: 'none',
      intensity: 'recovery',
      durationMinutes: 0,
      reason: 'Adaptation happens after the work.',
      metrics: [],
    },
  ];
}

function cycleWeek(snapshot: PipelineSnapshot): DayTemplate[] {
  return runWeek(snapshot).map((item) => {
    if (item.sport !== 'run') return item;

    return {
      ...item,
      title: item.title.replace('run', 'ride'),
      detail: item.detail.replace('conversational', 'smooth and controlled'),
      sport: 'ride',
      metrics: watchMetrics('ride'),
      durationMinutes: Math.round(item.durationMinutes * 1.35),
    };
  });
}

function muscleWeek(): DayTemplate[] {
  return [
    {
      title: 'Lower body strength',
      detail: 'Squat pattern, hinge, single-leg work, calves, and core.',
      sport: 'strength',
      capture: 'manual',
      intensity: 'moderate',
      durationMinutes: 45,
      reason: 'A measured strength day creates a baseline without chasing maxes.',
      metrics: ['exercise', 'sets', 'reps', 'load', 'RPE'],
    },
    {
      title: 'Recovery walk',
      detail: 'Easy walk to support recovery.',
      sport: 'walk',
      capture: 'watch',
      intensity: 'recovery',
      durationMinutes: 30,
      reason: 'Low-intensity movement keeps momentum without interfering with lifting.',
      metrics: watchMetrics('walk'),
    },
    {
      title: 'Upper body strength',
      detail: 'Press, row, pulldown, incline press, arms, and carries.',
      sport: 'strength',
      capture: 'manual',
      intensity: 'moderate',
      durationMinutes: 45,
      reason: 'Manual load and RPE inputs let the coach progress work gradually.',
      metrics: ['exercise', 'sets', 'reps', 'load', 'RPE'],
    },
    {
      title: 'Mobility reset',
      detail: 'Hips, t-spine, shoulders, and breathing.',
      sport: 'recovery',
      capture: 'none',
      intensity: 'recovery',
      durationMinutes: 20,
      reason: 'Keeps joints feeling good between strength days.',
      metrics: [],
    },
    {
      title: 'Full-body strength',
      detail: 'Moderate full-body session with no sets to failure.',
      sport: 'strength',
      capture: 'manual',
      intensity: 'moderate',
      durationMinutes: 45,
      reason: 'A third exposure builds consistency while protecting recovery.',
      metrics: ['exercise', 'sets', 'reps', 'load', 'RPE'],
    },
    {
      title: 'Zone 2 walk',
      detail: 'Comfortable incline walk or outdoor walk.',
      sport: 'walk',
      capture: 'watch',
      intensity: 'easy',
      durationMinutes: 40,
      reason: 'Supports conditioning without turning the week into endurance training.',
      metrics: watchMetrics('walk'),
    },
    {
      title: 'Rest day',
      detail: 'Optional stretching only.',
      sport: 'recovery',
      capture: 'none',
      intensity: 'recovery',
      durationMinutes: 0,
      reason: 'Recovery keeps progression sustainable.',
      metrics: [],
    },
  ];
}

function templatesForGoal(goal: TrainingGoal, snapshot: PipelineSnapshot) {
  if (goal === 'event') return eventWeek(snapshot);
  if (goal === 'cycle') return cycleWeek(snapshot);
  if (goal === 'muscle') return muscleWeek();
  return runWeek(snapshot);
}

function guardrailFor(snapshot: PipelineSnapshot) {
  const band = readinessBand(snapshot);

  if (snapshot.workoutCount < 3) {
    return 'Baseline first: keep the first week conservative until recent training tolerance is clear.';
  }

  if (band === 'red') {
    return 'Recovery is leading today, so intensity and duration should be reduced.';
  }

  if (band === 'yellow' || band === 'needs-baseline') {
    return 'Progression should be gradual because readiness is mixed or still being established.';
  }

  return 'You are in the green band, so the plan can build fitness while still avoiding large jumps.';
}

export function generateTrainingPlan(
  snapshot: PipelineSnapshot,
  goal: TrainingGoal = 'run',
  today = new Date(),
): TrainingPlan {
  const templates = templatesForGoal(goal, snapshot);
  const week = templates.map((template, index) => {
    const date = addDays(today, index);

    return {
      ...template,
      id: `${dayKey(date)}-${template.sport}`,
      day: dayKey(date),
      label: index === 0 ? 'Today' : dayLabel(date),
    };
  });

  const guardrail = guardrailFor(snapshot);
  const sourceReason = snapshot.recommendation.reason;

  return {
    goal,
    today: week[0],
    week,
    whyToday: sourceReason && snapshot.totalSamples > 0 ? `${sourceReason} ${guardrail}` : guardrail,
    guardrail,
  };
}

export function answerCoachQuestion(question: string, plan: TrainingPlan): string {
  const normalized = question.trim().toLowerCase();

  if (!normalized) return '';

  if (normalized.includes('why')) {
    return plan.whyToday;
  }

  if (normalized.includes('swap') || normalized.includes('change') || normalized.includes('move')) {
    return `Yes, but keep the intent. Today's session is ${plan.today.intensity}, so swap it for another ${plan.today.intensity} option and avoid adding extra volume.`;
  }

  if (normalized.includes('strength') || normalized.includes('weight') || normalized.includes('load')) {
    return 'For strength work, enter exercise, sets, reps, load, and RPE. Watch-captured activities such as run, ride, swim, and walk should come from the wearable automatically.';
  }

  if (normalized.includes('tired') || normalized.includes('sore') || normalized.includes('sleep')) {
    return 'If sleep or soreness feels worse than the wearable suggests, downgrade by one level: reduce duration, keep intensity easy, or move the session to tomorrow.';
  }

  return `I would keep the focus on ${plan.today.title.toLowerCase()}: ${plan.today.reason}`;
}
