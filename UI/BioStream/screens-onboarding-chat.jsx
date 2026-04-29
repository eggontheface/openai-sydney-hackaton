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
