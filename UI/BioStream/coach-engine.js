(function attachCoachEngine(root) {
  const RAW_USER_DATA = {
    profile: {
      name: 'Martin',
      goal: 'run',
      event: 'Half marathon',
      eventDate: '2026-09-14',
      trainingDays: 4,
      experience: 'returning-consistent',
    },
    readiness: {
      label: 'Ready',
      score: 71,
      band: 'green',
      reason: "You're in the green band. Building aerobic capacity here pays into your half marathon block.",
    },
    syncedSignals: {
      source: 'Apple Watch',
      syncedAt: '6:41 am',
      sleep: '7h 12m',
      sleepScore: 76,
      hrv: 64,
      hrvDelta: '+2',
      rhr: 53,
      rhrDelta: '0',
      recentLoad: 'steady',
    },
    subjective: {
      soreness: 'none',
      pain: false,
      energy: 'medium',
      availableMinutes: 45,
    },
    strengthTemplate: [
      { lift: 'Goblet squat', target: '3 x 8', load: '24 kg', reps: '8', rpe: '7' },
      { lift: 'DB bench press', target: '3 x 10', load: '22 kg', reps: '10', rpe: '7' },
      { lift: 'Cable row', target: '3 x 10', load: '40 kg', reps: '10', rpe: '6' },
    ],
  };

  const watchMetrics = ['distance', 'pace', 'heart rate', 'route', 'splits', 'duration'];
  const manualStrengthMetrics = ['load', 'reps', 'sets', 'rpe'];

  function day(day, title, detail, icon, type, capture, toneKey) {
    return {
      day,
      title,
      detail,
      icon,
      type,
      capture,
      watchMetrics: capture === 'watch' ? watchMetrics : [],
      manualMetrics: capture === 'manual' ? manualStrengthMetrics : [],
      toneKey,
    };
  }

  function weekForGoal(goal) {
    const plans = {
      run: [
        day('Today', 'Run · tempo intervals', '45 min · captured by Apple Watch', 'run', 'run', 'watch', 'ink'),
        day('Thu', 'Strength · full body', 'Manual load, reps, sets, RPE', 'dumbbell', 'strength', 'manual', 'accent'),
        day('Fri', 'Recovery walk', '25 min · watch captured', 'walk', 'walk', 'watch', 'muted'),
        day('Sat', 'Long easy run', '70 min · watch captured', 'run', 'run', 'watch', 'cool'),
        day('Sun', 'Rest + mobility', 'Optional 12 min hips', 'heart', 'recovery', 'none', 'muted'),
        day('Mon', 'Easy run', '35 min · watch captured', 'run', 'run', 'watch', 'cool'),
        day('Tue', 'Strength · lower body', 'Manual strength log', 'dumbbell', 'strength', 'manual', 'accent'),
      ],
      cycle: [
        day('Today', 'Ride · cadence work', '60 min · captured by Apple Watch', 'bike', 'cycle', 'watch', 'ink'),
        day('Thu', 'Strength · posterior chain', 'Manual load, reps, sets, RPE', 'dumbbell', 'strength', 'manual', 'accent'),
        day('Fri', 'Recovery spin', '35 min · watch captured', 'bike', 'cycle', 'watch', 'muted'),
        day('Sat', 'Endurance ride', '95 min · watch captured', 'bike', 'cycle', 'watch', 'cool'),
        day('Sun', 'Rest + mobility', 'Optional 12 min hips', 'heart', 'recovery', 'none', 'muted'),
        day('Mon', 'Tempo ride', '45 min · watch captured', 'bike', 'cycle', 'watch', 'cool'),
        day('Tue', 'Strength · core', 'Manual strength log', 'dumbbell', 'strength', 'manual', 'accent'),
      ],
      event: [
        day('Today', 'Run · tempo intervals', '45 min · captured by Apple Watch', 'run', 'run', 'watch', 'ink'),
        day('Thu', 'Swim technique', '1.4 km · watch captured', 'swim', 'swim', 'watch', 'cool'),
        day('Fri', 'Strength · full body', 'Manual load, reps, sets, RPE', 'dumbbell', 'strength', 'manual', 'accent'),
        day('Sat', 'Endurance ride', '75 min · watch captured', 'bike', 'cycle', 'watch', 'cool'),
        day('Sun', 'Rest + mobility', 'Optional 12 min hips', 'heart', 'recovery', 'none', 'muted'),
        day('Mon', 'Easy run', '30 min · watch captured', 'run', 'run', 'watch', 'cool'),
        day('Tue', 'Strength · lower body', 'Manual strength log', 'dumbbell', 'strength', 'manual', 'accent'),
      ],
      muscle: [
        day('Today', 'Strength · full body', 'Manual load, reps, sets, RPE', 'dumbbell', 'strength', 'manual', 'ink'),
        day('Thu', 'Walk · recovery', '25 min · watch captured', 'walk', 'walk', 'watch', 'muted'),
        day('Fri', 'Strength · upper body', 'Manual strength log', 'dumbbell', 'strength', 'manual', 'accent'),
        day('Sat', 'Mobility + easy walk', '30 min · watch captured', 'heart', 'recovery', 'watch', 'muted'),
        day('Sun', 'Rest', 'Keep steps relaxed', 'heart', 'recovery', 'none', 'muted'),
        day('Mon', 'Strength · lower body', 'Manual strength log', 'dumbbell', 'strength', 'manual', 'accent'),
        day('Tue', 'Zone 2 walk', '35 min · watch captured', 'walk', 'walk', 'watch', 'cool'),
      ],
    };

    return plans[goal] || plans.run;
  }

  function generatePlan(rawData, options = {}) {
    const goal = options.goal || rawData.profile.goal;
    const week = weekForGoal(goal);
    const today = week[0];

    return {
      goal,
      readiness: rawData.readiness,
      syncedSignals: rawData.syncedSignals,
      subjective: rawData.subjective,
      today: {
        ...today,
        title: today.type === 'strength' ? 'Full-body strength baseline' : '6 x 800m at 5K pace',
        duration: today.type === 'strength' ? '42:00' : '45:00',
        volume: today.type === 'strength' ? '3 lifts' : '~7.2 km',
        intensity: today.type === 'strength' ? 'Moderate' : 'Hard',
        segments: today.type === 'strength'
          ? rawData.strengthTemplate
          : [
              { name: 'Warm-up', detail: '10 min easy · Z1', dur: '10:00', hr: '120-135' },
              { name: 'Build', detail: '5 min progressive · Z2 to Z3', dur: '5:00', hr: '140-155' },
              { name: 'Intervals', detail: '6 x 800m @ 5K · 2:00 rest', dur: '24:00', hr: '170-180', accent: true },
              { name: 'Cool down', detail: '6 min easy · Z1', dur: '6:00', hr: '120-130' },
            ],
      },
      week,
    };
  }

  function createCoachSession() {
    return { messages: [] };
  }

  function createMorningBrief(rawData, plan) {
    return [
      {
        role: 'coach',
        text: `Good morning ${rawData.profile.name}.`,
      },
      {
        role: 'coach',
        type: 'sleep_card',
        data: {
          source: rawData.syncedSignals.source,
          syncedAt: rawData.syncedSignals.syncedAt,
          sleep: rawData.syncedSignals.sleep,
          sleepScore: rawData.syncedSignals.sleepScore,
          hrv: rawData.syncedSignals.hrv,
          hrvDelta: rawData.syncedSignals.hrvDelta,
          rhr: rawData.syncedSignals.rhr,
          rhrDelta: rawData.syncedSignals.rhrDelta,
          insight: `Sleep was ${rawData.syncedSignals.sleep} with a score of ${rawData.syncedSignals.sleepScore}. HRV and resting heart rate are steady, so recovery looks solid today.`,
        },
      },
      {
        role: 'coach',
        type: 'plan_card',
        data: {
          title: plan.today.title,
          duration: plan.today.duration,
          volume: plan.today.volume,
          intensity: plan.today.intensity,
          capture: plan.today.capture,
          detail: plan.today.capture === 'watch'
            ? 'Your Apple Watch will capture distance, pace, heart rate, route, splits, and duration.'
            : 'Log load, reps, sets, and RPE. The watch can still capture heart rate and duration.',
        },
      },
      {
        role: 'coach',
        text: 'Is there anything else I should be aware of before we lock this in?',
      },
    ];
  }

  function answerCoachQuestion(question, context = {}) {
    const q = String(question || '').toLowerCase();
    const plan = context.plan || generatePlan(RAW_USER_DATA);

    if (q.includes('why')) {
      return { role: 'coach', text: plan.readiness.reason };
    }

    if (q.includes('swap') || q.includes('change') || q.includes('swim')) {
      return {
        role: 'coach',
        text: 'We can swap it, but I’d keep the intent the same: controlled aerobic work, no max effort. If you swim, keep it easy-to-steady and let the watch capture distance, heart rate, and duration.',
      };
    }

    if (q.includes('strength') || q.includes('weights')) {
      return {
        role: 'coach',
        text: 'For strength, I’ll ask you to log load, reps, sets, and RPE. The watch can still capture heart rate and duration, but it cannot reliably know what you lifted.',
      };
    }

    return {
      role: 'coach',
      text: 'Good question. I’d keep today aligned to the plan unless pain, unusual fatigue, or schedule constraints change the risk. Tell me what changed and I’ll adjust it.',
    };
  }

  const api = {
    RAW_USER_DATA,
    generatePlan,
    createCoachSession,
    createMorningBrief,
    answerCoachQuestion,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  root.BioStreamCoach = api;
})(typeof window !== 'undefined' ? window : globalThis);
