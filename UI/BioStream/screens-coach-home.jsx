// BioStream — Coach Home (the default tab; morning check-in + ongoing chat)
// Warm + encouraging voice. Mix of conversation and rich data cards.

function CoachHome({ tokens, persona, goal = 'run', stage = 'briefing', onTab, active = 'coach', onOpenWorkout }) {
  const [coachCollapsed, setCoachCollapsed] = React.useState(false);
  const [draft, setDraft] = React.useState('');
  const plan = window.BioStreamCoach?.generatePlan(window.BioStreamCoach.RAW_USER_DATA, { goal });
  const storageKey = `biostream.coach.messages.v2.${goal}`;
  const morningBrief = () => window.BioStreamCoach?.createMorningBrief(window.BioStreamCoach.RAW_USER_DATA, plan) || [];
  const [messages, setMessages] = React.useState(() => {
    try {
      const saved = window.localStorage.getItem(storageKey);
      return saved ? JSON.parse(saved) : morningBrief();
    } catch {
      return morningBrief();
    }
  });
  React.useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(messages));
    } catch {}
  }, [messages, storageKey]);
  const askCoach = (text = draft) => {
    const question = text.trim();
    if (!question) return;
    const answer = window.BioStreamCoach?.answerCoachQuestion(question, { plan });
    setMessages((current) => [
      ...current,
      { role: 'user', text: question },
      { role: 'coach', text: answer?.text || 'I can answer that once the coach engine is connected.' },
    ]);
    setDraft('');
    setCoachCollapsed(false);
  };
  // stages: 'greeting' | 'check' | 'briefing' (default - all expanded)
  const ringColor = ({ positive: tokens.positive, warm: tokens.warm, cool: tokens.cool }[persona.color]) || tokens.accent;
  const goalLabel = (window.GOALS[goal] || {}).primary || '—';

  // Build conversation script driven by persona
  const persLines = {
    peak: {
      open: <>Morning, Dane. <em style={{ fontStyle: 'italic' }}>You slept well</em>, and your body's loving it.</>,
      followup: <>HRV jumped 12 ms over your baseline and RHR dropped to 48. You're <em>primed</em>. If we've been waiting for a green light, this is it.</>,
      rec: 'Hard intervals',
      recDetail: '6 × 800m at 5K pace · 45 min',
      why: <>You're 4 days off your last hard one and the half is six weeks out. Today's the day to put a deposit in the bank.</>,
      pep: 'You earned this readiness. Go use it.',
    },
    steady: {
      open: <>Morning, Dane. You're <em style={{ fontStyle: 'italic' }}>right in the pocket</em> today.</>,
      followup: <>Sleep was 7:12, score 76. HRV's steady, RHR's steady. Solid baseline — exactly what an aerobic block looks like when it's working.</>,
      rec: 'Tempo run',
      recDetail: '20 min easy · 25 min @ tempo · 10 min cool',
      why: <>This is the bread-and-butter session for your half. 25 minutes is the sweet spot — long enough to matter, short enough to recover from.</>,
      pep: "Trust the work. You're stacking weeks.",
    },
    low: {
      open: <>Morning, Dane. <em style={{ fontStyle: 'italic' }}>Honest check-in:</em> your body's asking for a softer day.</>,
      followup: <>HRV dropped 18 ms, RHR is up 8 bpm, and sleep was short. None of that is a problem — it's information. We listen, and we earn tomorrow.</>,
      rec: 'Easy walk + mobility',
      recDetail: '30 min Z1 walk · 10 min hip mobility',
      why: <>Pushing today would dig the hole deeper and cost us mid-week. Backing off is the move that protects the bigger build.</>,
      pep: "Rest is part of the program. Tomorrow we go.",
    },
  };
  const L = persLines[persona.color === 'positive' ? 'peak' : persona.color === 'warm' ? 'low' : 'steady'];

  const SleepInsightCard = ({ data }) => (
    <div style={{ marginLeft: 42, padding: 14, background: tokens.surface, border: `1px solid ${tokens.lineSoft}`, borderRadius: tokens.radius, borderLeft: `2px solid ${tokens.cool}` }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <SectionLabel tokens={tokens}>Sleep & recovery</SectionLabel>
        <span style={{ fontSize: 10.5, color: tokens.muted }}>{data.source} · {data.syncedAt}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {[
          ['Sleep', data.sleep],
          ['Score', data.sleepScore],
          ['HRV', `${data.hrv} ${data.hrvDelta}`],
          ['RHR', `${data.rhr} ${data.rhrDelta}`],
        ].map(([label, value]) => (
          <div key={label} style={{ padding: 12, borderRadius: tokens.radiusSm, background: tokens.surfaceAlt, border: `1px solid ${tokens.lineSoft}` }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', color: tokens.muted }}>{label}</div>
            <div style={{ marginTop: 4, fontFamily: tokens.serif, fontSize: 21, color: tokens.ink, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 12, fontSize: 12.5, color: tokens.inkSoft, lineHeight: 1.45 }}>{data.insight}</div>
    </div>
  );

  const TodayPlanCard = ({ data }) => (
    <button onClick={onOpenWorkout} style={{ marginLeft: 42, width: 'calc(88% - 42px)', padding: 14, background: tokens.surface, border: `1px solid ${tokens.lineSoft}`, borderRadius: tokens.radius, borderLeft: `2px solid ${tokens.ink}`, textAlign: 'left', fontFamily: tokens.sans, cursor: 'pointer' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ width: 38, height: 38, borderRadius: 99, background: tokens.ink, color: tokens.surface, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon name={data.capture === 'manual' ? 'dumbbell' : 'run'} size={17} color={tokens.surface}/>
        </div>
        <div style={{ flex: 1 }}>
          <SectionLabel tokens={tokens}>Today’s workout</SectionLabel>
          <div style={{ marginTop: 5, fontFamily: tokens.serif, fontSize: 21, fontWeight: 400, lineHeight: 1.08, color: tokens.ink }}>{data.title}</div>
          <div style={{ display: 'flex', gap: 10, marginTop: 8, fontSize: 12, color: tokens.muted, fontVariantNumeric: 'tabular-nums' }}>
            <span><strong style={{ color: tokens.ink }}>{data.duration}</strong></span>
            <span><strong style={{ color: tokens.ink }}>{data.volume}</strong></span>
            <span><strong style={{ color: tokens.ink }}>{data.intensity}</strong></span>
          </div>
          <div style={{ marginTop: 10, fontSize: 12, color: tokens.muted, lineHeight: 1.4 }}>{data.detail}</div>
        </div>
        <Icon name="arrow-right" size={14} color={tokens.muted}/>
      </div>
    </button>
  );

  const renderMessage = (message, index) => {
    if (message.role === 'user') {
      return <UserBubbleV2 key={index} tokens={tokens}>{message.text}</UserBubbleV2>;
    }
    if (message.type === 'sleep_card') {
      return <SleepInsightCard key={index} data={message.data}/>;
    }
    if (message.type === 'plan_card') {
      return <TodayPlanCard key={index} data={message.data}/>;
    }
    return <CoachLine key={index} tokens={tokens} first={index === 0 || messages[index - 1]?.role === 'user'}>{message.text}</CoachLine>;
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: tokens.bg, overflow: 'hidden' }}>
      {/* Slim app bar */}
      <div style={{ padding: '10px 18px 6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${tokens.lineSoft}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <CoachAvatar tokens={tokens} size={30}/>
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: tokens.ink, letterSpacing: -0.1 }}>Coach</div>
            <div style={{ fontSize: 10.5, color: tokens.muted, fontFamily: tokens.mono }}>Wed · Apr 29 · 6:41 am</div>
          </div>
        </div>
        <Icon name="more" size={18} color={tokens.muted}/>
      </div>

      {/* Conversation feed */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 12px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Date divider */}
        <div style={{ alignSelf: 'center', fontSize: 10, fontWeight: 600, letterSpacing: 1.4, textTransform: 'uppercase', color: tokens.muted }}>
          This morning
        </div>

        {messages.length === 0 ? (
          <div style={{ flex: 1, minHeight: 420, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0 22px' }}>
            <CoachAvatar tokens={tokens} size={42}/>
            <h1 style={{ margin: '18px 0 8px', fontFamily: tokens.serif, fontSize: 30, fontWeight: 400, lineHeight: 1.08, color: tokens.ink }}>
              Ask your coach anything
            </h1>
            <p style={{ margin: 0, fontSize: 13.5, color: tokens.muted, lineHeight: 1.5 }}>
              Start with a blank chat. I’ll use the raw data, today’s generated plan, and the seven-day outlook to answer.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, justifyContent: 'center', marginTop: 18 }}>
              {['Why this today?', 'Can I swap this?', 'What if my knee hurts?'].map((prompt) => (
                <button key={prompt} onClick={() => askCoach(prompt)} style={{ padding: '8px 12px', borderRadius: 99, background: tokens.surface, border: `1px solid ${tokens.line}`, color: tokens.ink, fontFamily: tokens.sans, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map(renderMessage)
        )}

        {false && <>
        <CoachLine tokens={tokens} first>{L.open}</CoachLine>

        {/* Synced data card */}
        <DataCard tokens={tokens} kind="Synced from watch" accent={ringColor}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
            <Ring value={persona.readiness} size={68} stroke={6} color={ringColor} track={tokens.line} tokens={tokens}/>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontFamily: tokens.serif, fontSize: 15, color: tokens.ink, fontStyle: 'italic' }}>{persona.readinessLabel}</span>
                <span style={{ fontSize: 11, color: tokens.muted, fontVariantNumeric: 'tabular-nums' }}>readiness</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 10px', fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>
                <div><span style={{ color: tokens.muted }}>HRV </span><strong style={{ fontFamily: tokens.serif, fontWeight: 500 }}>{persona.hrv}</strong> <span style={{ color: ringColor, fontWeight: 600, fontSize: 11 }}>{persona.hrvDelta}</span></div>
                <div><span style={{ color: tokens.muted }}>RHR </span><strong style={{ fontFamily: tokens.serif, fontWeight: 500 }}>{persona.rhr}</strong> <span style={{ color: tokens.muted, fontSize: 11 }}>{persona.rhrDelta}</span></div>
                <div><span style={{ color: tokens.muted }}>Sleep </span><strong style={{ fontFamily: tokens.serif, fontWeight: 500 }}>{persona.sleep}</strong></div>
                <div><span style={{ color: tokens.muted }}>Score </span><strong style={{ fontFamily: tokens.serif, fontWeight: 500 }}>{persona.sleepScore}</strong></div>
              </div>
              <div style={{ marginTop: 4, paddingTop: 8, borderTop: `1px solid ${tokens.lineSoft}`, fontSize: 11.5, color: tokens.muted, lineHeight: 1.4 }}>
                Pulled from Health Connect at 6:41 am. No manual sleep entry needed.
              </div>
            </div>
          </div>
        </DataCard>

        <CoachLine tokens={tokens}>{L.followup}</CoachLine>

        <CoachLine tokens={tokens} first>I’ve got the watch data. I just need the parts it can’t know.</CoachLine>

        <DataCard tokens={tokens} kind="Quick human context" accent={tokens.ink}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: 12 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 650, color: tokens.ink }}>Soreness or pain?</div>
                <div style={{ fontSize: 11.5, color: tokens.muted, marginTop: 2 }}>Subjective context changes the plan.</div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {['None', 'Mild', 'Pain'].map((label, index) => (
                  <span key={label} style={{
                    padding: '6px 9px',
                    borderRadius: 99,
                    background: index === 0 ? tokens.ink : tokens.surfaceAlt,
                    color: index === 0 ? tokens.surface : tokens.inkSoft,
                    border: `1px solid ${index === 0 ? tokens.ink : tokens.lineSoft}`,
                    fontSize: 11.5,
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                  }}>{label}</span>
                ))}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: 12 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 650, color: tokens.ink }}>How much time today?</div>
                <div style={{ fontSize: 11.5, color: tokens.muted, marginTop: 2 }}>This is about your schedule, not fitness.</div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {['15', '30', '45+'].map((label, index) => (
                  <span key={label} style={{
                    padding: '6px 9px',
                    borderRadius: 99,
                    background: index === 1 ? tokens.ink : tokens.surfaceAlt,
                    color: index === 1 ? tokens.surface : tokens.inkSoft,
                    border: `1px solid ${index === 1 ? tokens.ink : tokens.lineSoft}`,
                    fontSize: 11.5,
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                  }}>{label}</span>
                ))}
              </div>
            </div>
          </div>
        </DataCard>

        <UserBubbleV2 tokens={tokens}>So what should I do today?</UserBubbleV2>

        <CoachLine tokens={tokens} first>Glad you asked. Here's what I'd run:</CoachLine>

        {/* Today's plan card */}
        <DataCard tokens={tokens} kind="Today's plan" accent={tokens.ink}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: tokens.radius, background: tokens.surfaceAlt, border: `1px solid ${tokens.lineSoft}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon name={(window.GOALS[goal] || {}).icon || 'run'} size={18} color={tokens.ink}/>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: tokens.serif, fontSize: 19, fontWeight: 400, color: tokens.ink, letterSpacing: -0.2 }}>{L.rec}</div>
              <div style={{ fontSize: 12.5, color: tokens.muted, marginTop: 2 }}>{L.recDetail}</div>
            </div>
          </div>
          {/* effort profile mini */}
          <div style={{ marginTop: 12, height: 36, position: 'relative', background: tokens.surfaceAlt, borderRadius: tokens.radiusSm, padding: 4 }}>
            <svg viewBox="0 0 280 28" width="100%" height="28" preserveAspectRatio="none">
              <path d="M0,22 L40,20 L60,14 L75,8 L90,16 L100,8 L115,16 L125,8 L140,16 L150,8 L165,16 L175,8 L190,16 L200,8 L215,16 L225,8 L240,20 L280,24"
                stroke={tokens.ink} strokeWidth={1.5} fill="none" strokeLinejoin="round"/>
            </svg>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button onClick={onOpenWorkout} style={{ flex: 1, padding: '10px 14px', borderRadius: tokens.radius, background: tokens.ink, color: tokens.surface, border: 'none', fontFamily: tokens.sans, fontSize: 13, fontWeight: 600, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer' }}>
              See full plan <Icon name="arrow-right" size={13}/>
            </button>
            <button style={{ padding: '10px 14px', borderRadius: tokens.radius, background: 'transparent', color: tokens.ink, border: `1px solid ${tokens.line}`, fontFamily: tokens.sans, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
              Send to Strava
            </button>
          </div>
        </DataCard>

        <CoachLine tokens={tokens} first>
          <span style={{ fontStyle: 'italic' }}>Why this:</span> {L.why}
        </CoachLine>

        <CoachLine tokens={tokens}>
          <span style={{ color: tokens.accent, fontStyle: 'italic' }}>{L.pep}</span>
        </CoachLine>
        </>}
      </div>

      {/* Suggested chips */}
      <div style={{ padding: '6px 14px 4px', display: 'flex', gap: 6, overflowX: 'auto' }}>
        {[
          { label: 'Easier option' },
          { label: 'Move to tomorrow' },
          { label: 'How about a swim?' },
          { label: 'I\'m short on time' },
        ].map(s => (
          <div key={s.label} style={{ padding: '7px 12px', borderRadius: 99, background: tokens.surface, border: `1px solid ${tokens.line}`, fontSize: 12, color: tokens.inkSoft, fontWeight: 500, whiteSpace: 'nowrap', flexShrink: 0 }}>
            {s.label}
          </div>
        ))}
      </div>

      {/* Composer with mic, collapsible across tabs */}
      <div style={{ padding: coachCollapsed ? '8px 14px' : '8px 14px 12px', display: 'flex', gap: 8, alignItems: 'center', justifyContent: coachCollapsed ? 'flex-end' : 'stretch', borderTop: `1px solid ${tokens.lineSoft}`, background: tokens.bg }}>
        {coachCollapsed ? (
          <button onClick={() => setCoachCollapsed(false)} style={{ width: 46, height: 46, borderRadius: 99, background: tokens.ink, color: tokens.surface, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} aria-label="Expand coach chat">
            <Icon name="sparkles" size={15} color={tokens.surface}/>
          </button>
        ) : (
          <>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: tokens.surface, border: `1px solid ${tokens.line}`, borderRadius: 99 }}>
              <Icon name="plus" size={16} color={tokens.muted}/>
              <input value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') askCoach(); }} placeholder="Ask your coach…" style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', fontFamily: tokens.sans, fontSize: 13.5, color: tokens.ink }}/>
              <Icon name="mic" size={16} color={tokens.muted}/>
            </div>
            <button onClick={draft.trim() ? () => askCoach() : () => setCoachCollapsed(true)} style={{ width: 36, height: 36, borderRadius: 99, background: draft.trim() ? tokens.ink : tokens.surface, border: `1px solid ${draft.trim() ? tokens.ink : tokens.line}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} aria-label={draft.trim() ? 'Send coach question' : 'Collapse coach chat'}>
              <Icon name={draft.trim() ? 'send' : 'arrow-down'} size={14} color={draft.trim() ? tokens.surface : tokens.muted}/>
            </button>
          </>
        )}
      </div>

      <CoachTabBar tokens={tokens} active={active} onChange={onTab}/>
    </div>
  );
}

// ── New tab bar: Coach is the first/default ──
function CoachTabBar({ tokens, active = 'coach', onChange }) {
  const tabs = [
    { id: 'coach',   label: 'Coach',   icon: 'sparkles' },
    { id: 'workout', label: 'Workout', icon: 'run' },
    { id: 'history', label: 'History', icon: 'chart' },
    { id: 'profile', label: 'You',     icon: 'profile' },
  ];
  return (
    <div style={{
      display: 'flex', borderTop: `1px solid ${tokens.line}`, background: tokens.surface,
      padding: '8px 8px 6px',
    }}>
      {tabs.map(t => {
        const on = active === t.id;
        return (
          <button key={t.id} onClick={() => onChange && onChange(t.id)}
            style={{
              flex: 1, background: 'none', border: 'none', cursor: 'pointer',
              padding: '6px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              color: on ? tokens.ink : tokens.muted,
              fontFamily: tokens.sans, fontSize: 11, fontWeight: on ? 600 : 500, letterSpacing: 0.2,
            }}>
            <Icon name={t.icon} size={22} stroke={on ? 1.9 : 1.5} />
            <span>{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}

window.CoachHome = CoachHome;
window.CoachTabBar = CoachTabBar;
