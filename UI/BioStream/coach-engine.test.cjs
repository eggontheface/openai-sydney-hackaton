const assert = require('assert');
const {
  RAW_USER_DATA,
  generatePlan,
  createCoachSession,
  createMorningBrief,
  answerCoachQuestion,
} = require('./coach-engine.js');

function test(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    console.error(error.message);
    process.exitCode = 1;
  }
}

test('run goal excludes swim and cycle sessions from the default seven-day plan', () => {
  const plan = generatePlan(RAW_USER_DATA, { goal: 'run' });
  const titles = plan.week.map((day) => day.title.toLowerCase()).join(' ');

  assert.equal(plan.today.capture, 'watch');
  assert.equal(titles.includes('swim'), false);
  assert.equal(titles.includes('ride'), false);
  assert.equal(titles.includes('cycle'), false);
});

test('event goal can include swim and cycle sessions when they align to the goal', () => {
  const plan = generatePlan(RAW_USER_DATA, { goal: 'event' });
  const titles = plan.week.map((day) => day.title.toLowerCase()).join(' ');

  assert.equal(titles.includes('swim'), true);
  assert.equal(titles.includes('ride'), true);
});

test('strength days require manual load reps sets and rpe metrics', () => {
  const plan = generatePlan(RAW_USER_DATA, { goal: 'run' });
  const strengthDay = plan.week.find((day) => day.type === 'strength');

  assert.equal(strengthDay.capture, 'manual');
  assert.deepEqual(strengthDay.manualMetrics, ['load', 'reps', 'sets', 'rpe']);
});

test('coach chat starts blank and answers questions from the generated plan', () => {
  const plan = generatePlan(RAW_USER_DATA, { goal: 'run' });
  const session = createCoachSession();

  assert.deepEqual(session.messages, []);

  const answer = answerCoachQuestion('Why this today?', { plan });
  assert.equal(answer.role, 'coach');
  assert.match(answer.text, /green band|aerobic capacity|half marathon/i);
});

test('morning brief opens with greeting sleep insight plan and context question', () => {
  const plan = generatePlan(RAW_USER_DATA, { goal: 'run' });
  const brief = createMorningBrief(RAW_USER_DATA, plan);

  assert.match(brief[0].text, /Good morning Martin/i);
  assert.equal(brief[1].type, 'sleep_card');
  assert.equal(brief[1].data.sleep, '7h 12m');
  assert.equal(brief[1].data.sleepScore, 76);
  assert.equal(brief[2].type, 'plan_card');
  assert.match(brief[2].data.title, /6 x 800m|5K pace/i);
  assert.match(brief[3].text, /anything else.*aware|should be aware/i);
});
