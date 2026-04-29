// BioStream — Conversational Onboarding (chat Q&A with answer chips)

function ConversationalOnboarding({ tokens, step = 4 }) {
  // step controls how many turns are visible (lets us show different states)
  const turns = [
    { kind: 'coach', text: <>Hey — I'm your coach. Before we begin, let me get to know you. <em style={{ fontStyle: 'italic' }}>What brings you here?</em></>, first: true },
    { kind: 'chips', options: [
      { value: 'run',     label: 'Improve running',  icon: 'run' },
      { value: 'muscle',  label: 'Build muscle',     icon: 'dumbbell' },
      { value: 'fat',     label: 'Lose fat',         icon: 'flame' },
      { value: 'sleep',   label: 'Sleep better',     icon: 'moon' },
      { value: 'event',   label: 'Train for event',  icon: 'flag' },
    ]},
    { kind: 'user', text: 'Improve running' },
    { kind: 'coach', text: <>Love it. Anything specific in mind — a race, a pace, or just <em>more miles in the legs</em>?</> },
    { kind: 'chips', options: [
      { value: '5k',     label: 'A faster 5K' },
      { value: 'half',   label: 'A half marathon' },
      { value: 'mara',   label: 'A marathon' },
      { value: 'longer', label: 'Just run longer' },
      { value: 'other',  label: 'Something else' },
    ]},
    { kind: 'user', text: 'A half marathon' },
    { kind: 'coach', text: <>Beautiful. When?</> },
    { kind: 'chips', options: [
      { value: '6w',  label: 'In ~6 weeks' },
      { value: '3m',  label: 'In 3 months' },
      { value: '6m',  label: 'In 6 months' },
      { value: 'tbd', label: 'Not sure yet' },
    ]},
    { kind: 'user', text: 'In ~6 weeks' },
    { kind: 'coach', text: <>Tight, but workable. Last question — how does a <em>hard</em> day feel right now? I'll calibrate from there.</> },
    { kind: 'chips', options: [
      { value: 'easy',  label: 'Honestly, easy' },
      { value: 'fair',  label: 'Hard but fair' },
      { value: 'tough', label: 'Pretty tough' },
      { value: 'rare',  label: "I haven't pushed in a while" },
    ]},
  ];

  // visible up to step * 2 + 1 turns
  const visibleTurns = turns.slice(0, Math.min(turns.length, step * 3 + 1));

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: tokens.bg }}>
      {/* Top — minimal, no app bar pretense */}
      <div style={{ padding: '12px 18px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600, letterSpacing: 1.6, textTransform: 'uppercase', color: tokens.muted }}>
          <div style={{ width: 6, height: 6, borderRadius: 99, background: tokens.positive }}/>
          Setup · {step} of 5
        </div>
        <span style={{ fontSize: 12, color: tokens.muted, fontWeight: 500 }}>Skip</span>
      </div>
      {/* progress hairline */}
      <div style={{ padding: '0 18px 8px' }}>
        <div style={{ height: 2, borderRadius: 1, background: tokens.line, overflow: 'hidden' }}>
          <div style={{ width: `${(step/5)*100}%`, height: '100%', background: tokens.ink, transition: 'width 400ms' }}/>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {visibleTurns.map((t, i) => {
          if (t.kind === 'coach') return <CoachLine key={i} tokens={tokens} first={t.first}>{t.text}</CoachLine>;
          if (t.kind === 'user')  return <UserBubbleV2 key={i} tokens={tokens}>{t.text}</UserBubbleV2>;
          if (t.kind === 'chips') return <ChipRow key={i} tokens={tokens} options={t.options}/>;
        })}
      </div>

      <div style={{ padding: '8px 14px 12px', display: 'flex', gap: 8, alignItems: 'center', borderTop: `1px solid ${tokens.lineSoft}`, background: tokens.bg }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: tokens.surface, border: `1px solid ${tokens.line}`, borderRadius: 99 }}>
          <span style={{ flex: 1, fontSize: 13.5, color: tokens.muted }}>Or type your own…</span>
          <Icon name="mic" size={16} color={tokens.muted}/>
        </div>
      </div>
    </div>
  );
}

window.ConversationalOnboarding = ConversationalOnboarding;

function MinimizedOnboarding({ tokens, onComplete }) {
  const [step, setStep] = React.useState('connect');
  const [goal, setGoal] = React.useState(null);
  const [risk, setRisk] = React.useState('No concerns');
  const [days, setDays] = React.useState('3');
  const [time, setTime] = React.useState('45');

  const progress = step === 'connect' ? 0.33 : step === 'goal' ? 0.66 : 1;
  const chipStyle = (on) => ({
    padding: '9px 13px',
    borderRadius: 99,
    background: on ? tokens.ink : tokens.surface,
    color: on ? tokens.surface : tokens.ink,
    border: `1px solid ${on ? tokens.ink : tokens.line}`,
    fontFamily: tokens.sans,
    fontSize: 12.5,
    fontWeight: 650,
    cursor: 'pointer',
  });

  const Header = ({ label }) => (
    <>
      <div style={{ padding: '14px 18px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11, fontWeight: 650, letterSpacing: 1.6, textTransform: 'uppercase', color: tokens.muted }}>
          <div style={{ width: 6, height: 6, borderRadius: 99, background: tokens.positive }}/>
          {label}
        </div>
        <button onClick={() => onComplete && onComplete(goal || 'run')} style={{ border: 'none', background: 'transparent', color: tokens.muted, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Skip</button>
      </div>
      <div style={{ padding: '0 18px 10px' }}>
        <div style={{ height: 2, borderRadius: 2, background: tokens.line, overflow: 'hidden' }}>
          <div style={{ width: `${progress * 100}%`, height: '100%', background: tokens.ink, transition: 'width 240ms ease' }}/>
        </div>
      </div>
    </>
  );

  if (step === 'connect') {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: tokens.bg }}>
        <Header label="Step 1 · connect"/>
        <div style={{ flex: 1, padding: '20px 22px 22px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ width: 58, height: 58, borderRadius: tokens.radiusLg, background: tokens.ink, color: tokens.surface, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
            <Icon name="sparkles" size={24} color={tokens.surface}/>
          </div>
          <h1 style={{ margin: '0 0 10px', fontFamily: tokens.serif, fontSize: 34, fontWeight: 400, lineHeight: 1.05, color: tokens.ink, letterSpacing: -0.6 }}>
            Set up your coach in under a minute
          </h1>
          <p style={{ margin: '0 0 20px', fontSize: 13.5, color: tokens.muted, lineHeight: 1.55 }}>
            Sign in, connect Apple Health, then tell me what you’re working toward. I’ll only ask for what your watch can’t know.
          </p>
          <button onClick={() => setStep('goal')} style={{ width: '100%', padding: '14px 16px', borderRadius: tokens.radius, border: 'none', background: tokens.ink, color: tokens.surface, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, fontFamily: tokens.sans, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
            <Icon name="apple" size={17} color={tokens.surface}/> Continue with Apple
          </button>
          <button onClick={() => setStep('goal')} style={{ marginTop: 10, width: '100%', padding: '13px 16px', borderRadius: tokens.radius, border: `1px solid ${tokens.line}`, background: tokens.surface, color: tokens.ink, fontFamily: tokens.sans, fontSize: 13.5, fontWeight: 650, cursor: 'pointer' }}>
            Connect data later
          </button>
          <div style={{ marginTop: 18, padding: 14, borderRadius: tokens.radius, background: tokens.surfaceAlt, border: `1px solid ${tokens.lineSoft}` }}>
            <SectionLabel tokens={tokens} style={{ marginBottom: 10 }}>Will sync automatically</SectionLabel>
            <div style={{ display: 'grid', gap: 9 }}>
              {[
                ['Sleep', 'Stages, duration, sleep score', 'moon'],
                ['Recovery', 'HRV and resting heart rate', 'pulse'],
                ['Workouts', 'Runs, rides, swims, walks', 'run'],
              ].map(([name, detail, icon]) => (
                <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Icon name={icon} size={16} color={tokens.inkSoft}/>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12.8, fontWeight: 650, color: tokens.ink }}>{name}</div>
                    <div style={{ fontSize: 11.5, color: tokens.muted }}>{detail}</div>
                  </div>
                  <Icon name="check" size={14} color={tokens.positive}/>
                </div>
              ))}
            </div>
          </div>
          <div style={{ marginTop: 'auto', fontSize: 11.5, color: tokens.muted, lineHeight: 1.45 }}>
            Your data stays private. The coach uses small summaries and gets more conservative when data is missing.
          </div>
        </div>
      </div>
    );
  }

  if (step === 'goal') {
    const goals = [
      { id: 'run', label: 'Get fitter', icon: 'run' },
      { id: 'event', label: 'Train for event', icon: 'flag' },
      { id: 'muscle', label: 'Build strength', icon: 'dumbbell' },
      { id: 'fat', label: 'Lose weight', icon: 'flame' },
      { id: 'sleep', label: 'More energy', icon: 'moon' },
    ];
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: tokens.bg }}>
        <Header label="Step 2 · goal"/>
        <div style={{ flex: 1, padding: '14px 16px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <CoachLine tokens={tokens} first>What are you working toward right now?</CoachLine>
          <div style={{ alignSelf: 'flex-end', width: '86%', padding: 12, borderRadius: tokens.radius, background: tokens.surface, border: `1px solid ${tokens.line}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ flex: 1, fontSize: 13.5, color: tokens.muted }}>Type or say it naturally…</span>
              <Icon name="mic" size={16} color={tokens.muted}/>
            </div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, justifyContent: 'flex-end' }}>
            {goals.map((g) => (
              <button key={g.id} onClick={() => setGoal(g.id)} style={chipStyle(goal === g.id)}>
                <Icon name={g.icon} size={13} color={goal === g.id ? tokens.surface : tokens.ink} style={{ marginRight: 5, verticalAlign: -2 }}/> {g.label}
              </button>
            ))}
          </div>
          {goal === 'event' && (
            <div style={{ marginLeft: 42, padding: 14, borderRadius: tokens.radius, background: tokens.surface, border: `1px solid ${tokens.lineSoft}` }}>
              <SectionLabel tokens={tokens} style={{ marginBottom: 8 }}>Event detected</SectionLabel>
              <div style={{ fontSize: 15, fontWeight: 700, color: tokens.ink }}>Sydney half marathon</div>
              <div style={{ marginTop: 3, fontSize: 12, color: tokens.muted }}>21.1 km · September · road run</div>
              <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
                <button style={chipStyle(true)}>That’s it</button>
                <button style={chipStyle(false)}>Edit</button>
              </div>
            </div>
          )}
        </div>
        <div style={{ padding: '12px 20px 18px', display: 'flex', gap: 10 }}>
          <Btn tokens={tokens} onClick={() => setStep('connect')}>Back</Btn>
          <Btn tokens={tokens} primary full icon="arrow-right" onClick={() => setStep('safety')} style={{ flex: 1 }}>Continue</Btn>
        </div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: tokens.bg }}>
      <Header label="Step 3 · calibrate"/>
      <div style={{ flex: 1, padding: '16px 20px 18px', overflowY: 'auto' }}>
        <h1 style={{ margin: '0 0 8px', fontFamily: tokens.serif, fontSize: 31, fontWeight: 400, lineHeight: 1.08, color: tokens.ink, letterSpacing: -0.5 }}>
          Anything I should factor in?
        </h1>
        <p style={{ margin: '0 0 18px', fontSize: 13, color: tokens.muted, lineHeight: 1.5 }}>
          This is the only safety check before your first recommendation.
        </p>
        <SectionLabel tokens={tokens} style={{ marginBottom: 9 }}>Safety</SectionLabel>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 18 }}>
          {['No concerns', 'Long training gap', 'Pain/injury', 'Illness/recovery'].map((option) => (
            <button key={option} onClick={() => setRisk(option)} style={chipStyle(risk === option)}>{option}</button>
          ))}
        </div>
        <SectionLabel tokens={tokens} style={{ marginBottom: 9 }}>Realistic week</SectionLabel>
        <div style={{ padding: 14, borderRadius: tokens.radius, background: tokens.surface, border: `1px solid ${tokens.lineSoft}`, marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 650, color: tokens.ink, marginBottom: 10 }}>Training days</div>
          <div style={{ display: 'flex', gap: 7 }}>
            {['2', '3', '4', '5+'].map((option) => (
              <button key={option} onClick={() => setDays(option)} style={chipStyle(days === option)}>{option}</button>
            ))}
          </div>
        </div>
        <div style={{ padding: 14, borderRadius: tokens.radius, background: tokens.surface, border: `1px solid ${tokens.lineSoft}` }}>
          <div style={{ fontSize: 13, fontWeight: 650, color: tokens.ink, marginBottom: 10 }}>Usual session time</div>
          <div style={{ display: 'flex', gap: 7 }}>
            {['20', '30', '45', '60+'].map((option) => (
              <button key={option} onClick={() => setTime(option)} style={chipStyle(time === option)}>{option}</button>
            ))}
          </div>
        </div>
        <div style={{ marginTop: 16, padding: 14, borderRadius: tokens.radius, background: tokens.surfaceAlt, border: `1px solid ${tokens.lineSoft}` }}>
          <SectionLabel tokens={tokens} style={{ marginBottom: 8 }}>Starting strategy</SectionLabel>
          <div style={{ fontSize: 13, color: tokens.inkSoft, lineHeight: 1.5 }}>
            {risk === 'No concerns'
              ? 'I’ll start with today’s readiness and keep the first week controlled.'
              : 'I’ll start with a baseline week and avoid aggressive jumps until your current capacity is clearer.'}
          </div>
        </div>
      </div>
      <div style={{ padding: '12px 20px 18px', display: 'flex', gap: 10 }}>
        <Btn tokens={tokens} onClick={() => setStep('goal')}>Back</Btn>
        <Btn tokens={tokens} primary full icon="sparkles" onClick={() => onComplete && onComplete(goal || 'run')} style={{ flex: 1 }}>Show my coach</Btn>
      </div>
    </div>
  );
}

window.MinimizedOnboarding = MinimizedOnboarding;
