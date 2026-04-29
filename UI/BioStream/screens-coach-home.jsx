// BioStream — Coach Home (the default tab; morning check-in + ongoing chat)
// Warm + encouraging voice. Mix of conversation and rich data cards.

function CoachHome({ tokens, persona, goal = 'run', stage = 'briefing', onTab, active = 'coach', onOpenWorkout }) {
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

        <CoachLine tokens={tokens} first>{L.open}</CoachLine>

        {/* Recovery snapshot card */}
        <DataCard tokens={tokens} kind="Last night" accent={ringColor}>
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
            </div>
          </div>
        </DataCard>

        <CoachLine tokens={tokens}>{L.followup}</CoachLine>

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

      {/* Composer with mic */}
      <div style={{ padding: '8px 14px 12px', display: 'flex', gap: 8, alignItems: 'center', borderTop: `1px solid ${tokens.lineSoft}`, background: tokens.bg }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: tokens.surface, border: `1px solid ${tokens.line}`, borderRadius: 99 }}>
          <Icon name="plus" size={16} color={tokens.muted}/>
          <span style={{ flex: 1, fontSize: 13.5, color: tokens.muted }}>Ask your coach…</span>
        </div>
        <div style={{ width: 42, height: 42, borderRadius: 99, background: tokens.ink, color: tokens.surface, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <Icon name="mic" size={17} color={tokens.surface}/>
        </div>
      </div>

      <CoachTabBar tokens={tokens} active={active} onChange={onTab}/>
    </div>
  );
}

// ── New tab bar: Coach is the first/default ──
function CoachTabBar({ tokens, active = 'coach', onChange }) {
  const tabs = [
    { id: 'coach',   label: 'Coach',   icon: 'sparkles' },
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
