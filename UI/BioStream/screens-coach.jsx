// BioStream — chat (coach) + profile screens

// ============================================================
// CHAT — coach-led with insight cards + user bubbles
// ============================================================
function ChatScreen({ tokens, persona, onTab, active = 'chat', goal = 'run' }) {
  const ringColor = ({positive: tokens.positive, warm: tokens.warm, cool: tokens.cool}[persona.color]) || tokens.accent;

  const InsightCard = ({ kind, children }) => (
    <div style={{
      background: tokens.surface, borderLeft: `2px solid ${ringColor}`,
      borderRadius: tokens.radius, padding: '14px 16px',
      maxWidth: '88%', alignSelf: 'flex-start',
      border: `1px solid ${tokens.lineSoft}`, borderLeftWidth: 2, borderLeftColor: ringColor,
    }}>
      {kind && <SectionLabel tokens={tokens} style={{ color: ringColor, marginBottom: 8 }}>{kind}</SectionLabel>}
      {children}
    </div>
  );

  const UserBubble = ({ children }) => (
    <div style={{
      alignSelf: 'flex-end', maxWidth: '78%',
      background: tokens.ink, color: tokens.surface,
      padding: '10px 14px', borderRadius: tokens.radius,
      fontSize: 14, lineHeight: 1.45,
    }}>{children}</div>
  );

  const CoachText = ({ children }) => (
    <div style={{
      alignSelf: 'flex-start', maxWidth: '88%',
      fontFamily: tokens.serif, fontSize: 16, lineHeight: 1.5,
      color: tokens.ink, padding: '4px 6px', fontWeight: 400,
    }}>{children}</div>
  );

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: tokens.bg, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 18px 8px', borderBottom: `1px solid ${tokens.lineSoft}` }}>
        <div style={{ width: 36, height: 36, borderRadius: 99, background: tokens.ink, color: tokens.surface, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="sparkles" size={16} color={tokens.surface}/>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: tokens.ink }}>Coach</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: tokens.muted }}>
            <div style={{ width: 6, height: 6, borderRadius: 99, background: tokens.positive }}/> Synced 9:38 am
          </div>
        </div>
        <Icon name="more" size={18} color={tokens.muted}/>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 12px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ alignSelf: 'center', fontSize: 11, color: tokens.muted, padding: '4px 10px', background: tokens.surfaceAlt, borderRadius: 99 }}>
          Today, 9:38
        </div>

        <CoachText>{persona.coachOpener}</CoachText>

        <InsightCard kind="Recovery snapshot">
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
            <Ring value={persona.readiness} size={64} stroke={6} color={ringColor} track={tokens.line} tokens={tokens}/>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, color: tokens.ink, fontWeight: 600 }}>{persona.readinessLabel}</div>
              <div style={{ marginTop: 6, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 14px', fontSize: 12 }}>
                <div><span style={{ color: tokens.muted }}>HRV </span><strong style={{ fontFamily: tokens.serif }}>{persona.hrv}</strong> <span style={{ color: ringColor, fontWeight: 600, fontSize: 11 }}>{persona.hrvDelta}</span></div>
                <div><span style={{ color: tokens.muted }}>RHR </span><strong style={{ fontFamily: tokens.serif }}>{persona.rhr}</strong> <span style={{ color: tokens.muted, fontSize: 11 }}>{persona.rhrDelta}</span></div>
                <div><span style={{ color: tokens.muted }}>Sleep </span><strong style={{ fontFamily: tokens.serif }}>{persona.sleep}</strong></div>
                <div><span style={{ color: tokens.muted }}>Score </span><strong style={{ fontFamily: tokens.serif }}>{persona.sleepScore}</strong></div>
              </div>
            </div>
          </div>
        </InsightCard>

        <UserBubble>What should I do today?</UserBubble>

        <CoachText>Given the data, I'd go with this:</CoachText>

        <InsightCard kind="Today's prescription">
          <div style={{ fontFamily: tokens.serif, fontSize: 18, color: tokens.ink, fontWeight: 400, letterSpacing: -0.2 }}>{persona.recommendation}</div>
          <div style={{ fontSize: 12.5, color: tokens.muted, marginTop: 4, lineHeight: 1.5 }}>{persona.recDetail}</div>
          <div style={{ marginTop: 10, padding: 10, background: tokens.surfaceAlt, borderRadius: tokens.radiusSm, fontSize: 12, color: tokens.inkSoft, lineHeight: 1.5 }}>
            <em style={{ fontFamily: tokens.serif, color: ringColor, fontStyle: 'italic' }}>Why: </em>{persona.recReason}
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
            <Btn tokens={tokens} primary size="sm" icon="arrow-right">Open plan</Btn>
            <Btn tokens={tokens} size="sm">Alternatives</Btn>
          </div>
        </InsightCard>

        <UserBubble>can you push it to tomorrow? meeting at lunch</UserBubble>

        <CoachText>Yep, that works. Tomorrow's HRV will likely still be in range. Tonight, aim for lights-out by 10:30 — you're carrying a small sleep debt.</CoachText>

        {/* typing */}
        <div style={{ alignSelf: 'flex-start', display: 'flex', gap: 4, padding: '8px 12px', background: tokens.surface, border: `1px solid ${tokens.lineSoft}`, borderRadius: 99 }}>
          {[0,1,2].map(i => <div key={i} style={{ width: 5, height: 5, borderRadius: 99, background: tokens.muted, opacity: 0.6 - i*0.15 }}/>)}
        </div>
      </div>

      {/* Quick chips */}
      <div style={{ display: 'flex', gap: 6, padding: '8px 16px 4px', overflowX: 'auto' }}>
        {['Move to tomorrow','Easier option','Why this?','Skip today'].map(s => (
          <div key={s} style={{ padding: '7px 12px', borderRadius: 99, background: tokens.surface, border: `1px solid ${tokens.line}`, fontSize: 12, color: tokens.inkSoft, fontWeight: 500, whiteSpace: 'nowrap' }}>{s}</div>
        ))}
      </div>

      {/* Composer */}
      <div style={{ padding: '8px 14px 12px', display: 'flex', gap: 8, alignItems: 'center', borderTop: `1px solid ${tokens.lineSoft}`, background: tokens.bg }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: tokens.surface, border: `1px solid ${tokens.line}`, borderRadius: 99 }}>
          <Icon name="plus" size={16} color={tokens.muted}/>
          <span style={{ flex: 1, fontSize: 13.5, color: tokens.muted }}>Ask your coach…</span>
          <Icon name="mic" size={16} color={tokens.muted}/>
        </div>
        <div style={{ width: 42, height: 42, borderRadius: 99, background: tokens.ink, color: tokens.surface, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="send" size={16} color={tokens.surface}/>
        </div>
      </div>
      <TabBar tokens={tokens} active={active} onChange={onTab}/>
    </div>
  );
}

// ============================================================
// PROFILE & GOALS
// ============================================================
function ProfileScreen({ tokens, persona, goal = 'run', onTab, active = 'profile' }) {
  const g = window.GOALS[goal] || window.GOALS.run;
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: tokens.bg, overflow: 'hidden' }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 20px 20px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 64, height: 64, borderRadius: 99, background: tokens.accentSoft, color: tokens.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: tokens.serif, fontSize: 26, fontWeight: 500 }}>D</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: tokens.serif, fontSize: 22, color: tokens.ink, letterSpacing: -0.3 }}>Dane Holt</div>
            <div style={{ fontSize: 12, color: tokens.muted, marginTop: 2 }}>34 · Sydney · Connected since Mar 12</div>
          </div>
          <div style={{ width: 36, height: 36, borderRadius: 99, background: tokens.surface, border: `1px solid ${tokens.line}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="settings" size={16} color={tokens.ink}/>
          </div>
        </div>

        {/* Goal hero */}
        <div style={{ marginTop: 20, padding: 18, background: tokens.surface, borderRadius: tokens.radius, border: `1px solid ${tokens.lineSoft}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
            <SectionLabel tokens={tokens}>Current goal</SectionLabel>
            <span style={{ fontSize: 11, color: tokens.accent, fontWeight: 600 }}>Edit</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: tokens.accentSoft, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={g.icon} size={20} color={tokens.accent}/>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: tokens.serif, fontSize: 18, color: tokens.ink }}>{g.label}</div>
              <div style={{ fontSize: 12.5, color: tokens.muted, marginTop: 2 }}>{g.primary}</div>
            </div>
          </div>
          <div style={{ marginTop: 14, height: 4, borderRadius: 2, background: tokens.line, overflow: 'hidden' }}>
            <div style={{ width: '33%', height: '100%', background: tokens.ink }}/>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 11, color: tokens.muted }}>
            <span>Week 4 of 12</span><span>{persona.nextEvent}</span>
          </div>
        </div>

        {/* Stats row */}
        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          {[
            { v: '47', l: 'sessions' },
            { v: '312k', l: 'steps · 4w' },
            { v: '14', l: 'streak · days' },
          ].map((s, i) => (
            <div key={i} style={{ flex: 1, padding: 14, background: tokens.surface, borderRadius: tokens.radius, border: `1px solid ${tokens.lineSoft}`, textAlign: 'center' }}>
              <div style={{ fontFamily: tokens.serif, fontSize: 22, color: tokens.ink, fontVariantNumeric: 'tabular-nums' }}>{s.v}</div>
              <div style={{ fontSize: 11, color: tokens.muted, marginTop: 2 }}>{s.l}</div>
            </div>
          ))}
        </div>

        {/* Settings groups */}
        <SectionLabel tokens={tokens} style={{ marginTop: 22, marginBottom: 8 }}>Coach</SectionLabel>
        <div style={{ background: tokens.surface, borderRadius: tokens.radius, border: `1px solid ${tokens.lineSoft}`, overflow: 'hidden' }}>
          {[
            { i: 'sparkles', t: 'Coaching style', v: 'Direct · data-led' },
            { i: 'key',      t: 'OpenAI key',     v: '••••mE7Q' },
            { i: 'chat',     t: 'Daily check-in', v: '7:30 am' },
          ].map((r, i, arr) => (
            <div key={r.t} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', borderTop: i ? `1px solid ${tokens.lineSoft}` : 'none' }}>
              <Icon name={r.i} size={18} color={tokens.inkSoft}/>
              <div style={{ flex: 1, fontSize: 13.5, fontWeight: 500, color: tokens.ink }}>{r.t}</div>
              <div style={{ fontSize: 12.5, color: tokens.muted }}>{r.v}</div>
              <Icon name="arrow-right" size={14} color={tokens.muted}/>
            </div>
          ))}
        </div>

        <SectionLabel tokens={tokens} style={{ marginTop: 22, marginBottom: 8 }}>Data</SectionLabel>
        <div style={{ background: tokens.surface, borderRadius: tokens.radius, border: `1px solid ${tokens.lineSoft}`, overflow: 'hidden' }}>
          {[
            { i: 'pulse', t: 'Health Connect',   v: '6 sources' },
            { i: 'shield',t: 'Privacy & sharing',v: 'On-device' },
            { i: 'chart', t: 'Export data',      v: '' },
          ].map((r, i) => (
            <div key={r.t} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', borderTop: i ? `1px solid ${tokens.lineSoft}` : 'none' }}>
              <Icon name={r.i} size={18} color={tokens.inkSoft}/>
              <div style={{ flex: 1, fontSize: 13.5, fontWeight: 500, color: tokens.ink }}>{r.t}</div>
              {r.v && <div style={{ fontSize: 12.5, color: tokens.muted }}>{r.v}</div>}
              <Icon name="arrow-right" size={14} color={tokens.muted}/>
            </div>
          ))}
        </div>

        <div style={{ textAlign: 'center', marginTop: 22, fontSize: 11, color: tokens.muted, fontFamily: tokens.mono }}>
          BioStream · v0.1 · build 2026.04.29
        </div>
      </div>
      {window.CoachTabBar
        ? <window.CoachTabBar tokens={tokens} active={active} onChange={onTab}/>
        : <TabBar tokens={tokens} active={active} onChange={onTab}/>}
    </div>
  );
}
// (ChatScreen kept for legacy canvas frames)
window.ChatScreen = ChatScreen;
window.ProfileScreen = ProfileScreen;
