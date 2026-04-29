// BioStream — main screens (home, workout, history, chat, profile)

// ============================================================
// HOME — three variants A/B/C, plus persona-driven data
// ============================================================
function HomeScreen({ tokens, persona, goal = 'run', variant = 'hero', onTab, active = 'home', density = 'balanced' }) {
  const colorMap = { positive: tokens.positive, warm: tokens.warm, cool: tokens.cool };
  const ringColor = colorMap[persona.color] || tokens.accent;
  const goalLabel = (window.GOALS[goal] || {}).primary || '—';
  
  // shared metric chip
  const Metric = ({ label, value, delta, color, spark }) => (
    <div style={{ flex: 1, padding: '12px 14px', background: tokens.surface, borderRadius: tokens.radius, border: `1px solid ${tokens.lineSoft}` }}>
      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1.2, textTransform: 'uppercase', color: tokens.muted }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 4 }}>
        <span style={{ fontFamily: tokens.serif, fontSize: 22, fontWeight: 400, color: tokens.ink, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
        {delta && <span style={{ fontSize: 11, fontWeight: 600, color: delta.startsWith('-') && label === 'HRV' ? tokens.accent : delta.startsWith('+') && label === 'HRV' ? tokens.positive : tokens.muted }}>{delta}</span>}
      </div>
      {spark && <div style={{ marginTop: 6 }}><Spark data={spark} color={color || tokens.muted} width={92} height={20}/></div>}
    </div>
  );

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: tokens.bg, overflow: 'hidden' }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 20px 20px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 12, color: tokens.muted, letterSpacing: 0.3 }}>Wednesday · Apr 29</div>
            <div style={{ fontFamily: tokens.serif, fontSize: 22, fontWeight: 400, color: tokens.ink, marginTop: 2 }}>
              Morning, <em style={{ fontStyle: 'italic' }}>Dane</em>.
            </div>
          </div>
          <div style={{ width: 38, height: 38, borderRadius: 99, background: tokens.surface, border: `1px solid ${tokens.line}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="settings" size={16} color={tokens.inkSoft}/>
          </div>
        </div>

        {variant === 'hero' && (
          <>
            {/* Hero recommendation card */}
            <div style={{
              borderRadius: tokens.radiusLg, padding: 20,
              background: tokens.ink, color: tokens.surface,
              position: 'relative', overflow: 'hidden',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600, letterSpacing: 1.4, textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)' }}>
                <Icon name="sparkles" size={12} color="rgba(255,255,255,0.55)"/> Today's call
              </div>
              <div style={{ fontFamily: tokens.serif, fontSize: 30, fontWeight: 400, lineHeight: 1.05, marginTop: 8, letterSpacing: -0.5 }}>
                {persona.recommendation}
              </div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 6, lineHeight: 1.5 }}>
                {persona.recDetail}
              </div>
              <div style={{ marginTop: 14, padding: 12, borderRadius: tokens.radius, background: 'rgba(255,255,255,0.08)', fontSize: 12.5, color: 'rgba(255,255,255,0.82)', lineHeight: 1.5 }}>
                {persona.recReason}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                <button style={{ flex: 1, padding: '10px 14px', borderRadius: tokens.radius * 2, background: tokens.surface, color: tokens.ink, border: 'none', fontFamily: tokens.sans, fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  See full plan <Icon name="arrow-right" size={14}/>
                </button>
                <button style={{ padding: '10px 14px', borderRadius: tokens.radius * 2, background: 'transparent', color: tokens.surface, border: '1px solid rgba(255,255,255,0.25)', fontFamily: tokens.sans, fontSize: 13, fontWeight: 500 }}>
                  Send to Strava
                </button>
              </div>
              {/* abstract corner mark */}
              <div style={{ position: 'absolute', top: -10, right: -10, width: 80, height: 80, borderRadius: 99, border: `2px solid ${ringColor}`, opacity: 0.6 }}/>
              <div style={{ position: 'absolute', top: 10, right: 10, fontFamily: tokens.serif, fontStyle: 'italic', fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>{persona.readinessLabel}</div>
            </div>

            {/* Today metrics */}
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <Metric label="HRV"   value={persona.hrv} delta={persona.hrvDelta} color={ringColor} spark={[55,58,52,60,64,70,persona.hrv]}/>
              <Metric label="RHR"   value={persona.rhr} delta={persona.rhrDelta} color={tokens.muted} spark={[52,54,55,53,52,51,persona.rhr].reverse()}/>
              <Metric label="Sleep" value={persona.sleep.split('h')[0] + 'h'} delta={`${persona.sleepScore}`} color={tokens.cool} spark={[6,7,5,7,8,7,persona.sleepScore/12]}/>
            </div>

            {/* Goal context */}
            <div style={{ marginTop: 16, padding: '14px 16px', background: tokens.surface, borderRadius: tokens.radius, border: `1px solid ${tokens.lineSoft}`, display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: 99, background: tokens.accentSoft, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={(window.GOALS[goal]||{}).icon || 'flag'} size={18} color={tokens.accent}/>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: tokens.ink }}>{goalLabel}</div>
                <div style={{ fontSize: 11.5, color: tokens.muted, marginTop: 2 }}>Week 4 of 12 · on plan</div>
              </div>
              <Icon name="arrow-right" size={16} color={tokens.muted}/>
            </div>

            {/* Strain progress */}
            <div style={{ marginTop: 16, padding: 16, background: tokens.surface, borderRadius: tokens.radius, border: `1px solid ${tokens.lineSoft}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <SectionLabel tokens={tokens}>Today's strain</SectionLabel>
                <span style={{ fontSize: 11, color: tokens.muted }}>Target {persona.strainTarget}</span>
              </div>
              <div style={{ marginTop: 10, height: 6, borderRadius: 4, background: tokens.line, overflow: 'hidden', position: 'relative' }}>
                <div style={{ position: 'absolute', left: '40%', right: '20%', top: 0, bottom: 0, background: tokens.accentSoft }}/>
                <div style={{ width: `${Math.min(persona.strain*5, 100)}%`, height: '100%', background: ringColor }}/>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 11, color: tokens.muted, fontVariantNumeric: 'tabular-nums' }}>
                <span>0</span><span>10</span><span>20</span>
              </div>
            </div>
          </>
        )}

        {variant === 'ring' && (
          <>
            <div style={{ background: tokens.surface, borderRadius: tokens.radiusLg, padding: '24px 20px', border: `1px solid ${tokens.lineSoft}`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
              <Ring value={persona.readiness} size={170} stroke={14} color={ringColor} track={tokens.line} label="Readiness" sub={persona.readinessLabel} tokens={tokens} big/>
              <div style={{ textAlign: 'center', maxWidth: 280, fontSize: 13.5, color: tokens.inkSoft, lineHeight: 1.55, fontFamily: tokens.serif, fontStyle: 'italic' }}>
                "{persona.coachOpener}"
              </div>
            </div>
            <div style={{ marginTop: 16, padding: '14px 16px', background: tokens.ink, color: tokens.surface, borderRadius: tokens.radius, display: 'flex', alignItems: 'center', gap: 12 }}>
              <Icon name={(window.GOALS[goal]||{}).icon || 'run'} size={20} color={tokens.surface}/>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: 1.2, fontWeight: 600 }}>Recommended</div>
                <div style={{ fontSize: 14, fontWeight: 600, marginTop: 2 }}>{persona.recommendation}</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>{persona.recDetail}</div>
              </div>
              <Icon name="arrow-right" size={18} color={tokens.surface}/>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <Metric label="HRV"   value={persona.hrv} delta={persona.hrvDelta} color={ringColor}/>
              <Metric label="RHR"   value={persona.rhr} delta={persona.rhrDelta} color={tokens.muted}/>
              <Metric label="Sleep score" value={persona.sleepScore} color={tokens.cool}/>
            </div>
            <div style={{ marginTop: 16, padding: 16, background: tokens.surface, borderRadius: tokens.radius, border: `1px solid ${tokens.lineSoft}` }}>
              <SectionLabel tokens={tokens}>14-day load</SectionLabel>
              <div style={{ marginTop: 10 }}>
                <BarRow data={[8,12,6,14,4,11,9,13,7,10,5,12,8,persona.strain]} color={ringColor} accent={13} height={50}/>
              </div>
            </div>
          </>
        )}

        {variant === 'chat' && (
          <>
            <div style={{ background: tokens.surfaceAlt, borderRadius: tokens.radiusLg, padding: '20px 20px 18px', border: `1px solid ${tokens.lineSoft}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, fontWeight: 600, letterSpacing: 1.4, textTransform: 'uppercase', color: tokens.muted }}>
                <div style={{ width: 6, height: 6, borderRadius: 99, background: ringColor }}/> Coach
              </div>
              <div style={{ fontFamily: tokens.serif, fontSize: 22, fontWeight: 400, lineHeight: 1.3, color: tokens.ink, marginTop: 12, letterSpacing: -0.2 }}>
                "{persona.coachOpener}"
              </div>
              <div style={{ marginTop: 16, padding: '14px 16px', background: tokens.surface, borderRadius: tokens.radius, border: `1px solid ${tokens.lineSoft}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Icon name={(window.GOALS[goal]||{}).icon || 'run'} size={18} color={tokens.accent}/>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{persona.recommendation}</div>
                    <div style={{ fontSize: 12, color: tokens.muted }}>{persona.recDetail}</div>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
                {['Send to Strava','Easier option','Why?','Move to tomorrow'].map(s => (
                  <div key={s} style={{ padding: '7px 12px', borderRadius: 99, background: tokens.surface, border: `1px solid ${tokens.line}`, fontSize: 12, fontWeight: 500, color: tokens.inkSoft }}>{s}</div>
                ))}
              </div>
            </div>
            <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
              <Metric label="Readiness" value={persona.readiness} delta={persona.readinessLabel} color={ringColor}/>
              <Metric label="HRV" value={persona.hrv} delta={persona.hrvDelta} color={ringColor}/>
              <Metric label="Sleep" value={persona.sleepScore} color={tokens.cool}/>
            </div>
            <div style={{ marginTop: 14, padding: '14px 16px', background: tokens.surface, borderRadius: tokens.radius, border: `1px solid ${tokens.lineSoft}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <SectionLabel tokens={tokens}>Goal</SectionLabel>
                <span style={{ fontSize: 11, color: tokens.muted }}>{persona.nextEvent}</span>
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, marginTop: 6, color: tokens.ink }}>{goalLabel}</div>
              <div style={{ marginTop: 10, height: 4, borderRadius: 2, background: tokens.line, overflow: 'hidden' }}>
                <div style={{ width: '33%', height: '100%', background: tokens.ink }}/>
              </div>
              <div style={{ fontSize: 11, color: tokens.muted, marginTop: 6 }}>Week 4 of 12</div>
            </div>
          </>
        )}
      </div>
      <TabBar tokens={tokens} active={active} onChange={onTab}/>
    </div>
  );
}

// ============================================================
// WORKOUT DETAIL
// ============================================================
function WorkoutScreen({ tokens, persona, onBack }) {
  const segments = [
    { name: 'Warm-up',   detail: '10 min easy · Z1',           dur: '10:00', hr: '120–135' },
    { name: 'Build',     detail: '5 min progressive · Z2→Z3',  dur: '5:00',  hr: '140–155' },
    { name: 'Intervals', detail: '6 × 800m @ 5K · 2:00 rest',   dur: '24:00', hr: '170–180', accent: true },
    { name: 'Cool down', detail: '6 min easy · Z1',             dur: '6:00',  hr: '120–130' },
  ];
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: tokens.bg, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px' }}>
        <div onClick={onBack} style={{ width: 36, height: 36, borderRadius: 99, background: tokens.surface, border: `1px solid ${tokens.line}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <Icon name="arrow-left" size={16} color={tokens.ink}/>
        </div>
        <SectionLabel tokens={tokens}>Today's plan</SectionLabel>
        <div style={{ width: 36, height: 36, borderRadius: 99, background: tokens.surface, border: `1px solid ${tokens.line}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="more" size={16} color={tokens.ink}/>
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 20px 20px' }}>
        <div style={{ fontFamily: tokens.serif, fontStyle: 'italic', fontSize: 13, color: tokens.accent }}>VO₂ max session</div>
        <h1 style={{ fontFamily: tokens.serif, fontSize: 30, fontWeight: 400, lineHeight: 1.1, color: tokens.ink, margin: '4px 0 6px', letterSpacing: -0.5 }}>
          6 × 800m at 5K pace
        </h1>
        <div style={{ display: 'flex', gap: 16, fontSize: 13, color: tokens.muted, fontVariantNumeric: 'tabular-nums' }}>
          <span><strong style={{ color: tokens.ink, fontWeight: 600 }}>45:00</strong> total</span>
          <span><strong style={{ color: tokens.ink, fontWeight: 600 }}>~7.2 km</strong></span>
          <span><strong style={{ color: tokens.ink, fontWeight: 600 }}>Hard</strong></span>
        </div>

        {/* Pace profile chart */}
        <div style={{ marginTop: 18, padding: 16, background: tokens.surface, borderRadius: tokens.radius, border: `1px solid ${tokens.lineSoft}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <SectionLabel tokens={tokens}>Effort profile</SectionLabel>
            <span style={{ fontSize: 11, color: tokens.muted }}>HR zones</span>
          </div>
          <div style={{ marginTop: 12, height: 80, position: 'relative' }}>
            <svg viewBox="0 0 300 80" width="100%" height="80" preserveAspectRatio="none">
              <path d="M0,60 L40,55 L60,40 L80,30 L90,15 L100,30 L110,15 L120,30 L130,15 L140,30 L150,15 L160,30 L170,15 L180,30 L190,15 L200,30 L210,15 L220,30 L240,55 L300,65"
                stroke={tokens.accent} strokeWidth={2} fill="none" strokeLinejoin="round"/>
              <path d="M0,60 L40,55 L60,40 L80,30 L90,15 L100,30 L110,15 L120,30 L130,15 L140,30 L150,15 L160,30 L170,15 L180,30 L190,15 L200,30 L210,15 L220,30 L240,55 L300,65 L300,80 L0,80 Z"
                fill={tokens.accent} opacity={0.12}/>
            </svg>
          </div>
        </div>

        {/* Segments */}
        <SectionLabel tokens={tokens} style={{ marginTop: 22, marginBottom: 10 }}>Plan</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {segments.map((s, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 14, padding: '12px 14px',
              background: s.accent ? tokens.ink : tokens.surface,
              color: s.accent ? tokens.surface : tokens.ink,
              borderRadius: tokens.radius, border: `1px solid ${s.accent ? tokens.ink : tokens.lineSoft}`,
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: 99,
                background: s.accent ? 'rgba(255,255,255,0.12)' : tokens.surfaceAlt,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: tokens.serif, fontSize: 13, fontWeight: 500,
              }}>{i+1}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600 }}>{s.name}</div>
                <div style={{ fontSize: 11.5, opacity: s.accent ? 0.7 : 1, color: s.accent ? 'rgba(255,255,255,0.7)' : tokens.muted, marginTop: 2 }}>{s.detail}</div>
              </div>
              <div style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{s.dur}</div>
                <div style={{ fontSize: 10.5, opacity: s.accent ? 0.7 : 1, color: s.accent ? 'rgba(255,255,255,0.7)' : tokens.muted }}>{s.hr} bpm</div>
              </div>
            </div>
          ))}
        </div>

        {/* Why this */}
        <div style={{ marginTop: 18, padding: 14, background: tokens.surfaceAlt, borderRadius: tokens.radius, border: `1px solid ${tokens.lineSoft}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Icon name="sparkles" size={14} color={tokens.accent}/>
            <SectionLabel tokens={tokens} style={{ color: tokens.accent }}>Why this, today</SectionLabel>
          </div>
          <div style={{ fontSize: 13, color: tokens.inkSoft, lineHeight: 1.55 }}>
            {persona.recReason}
          </div>
        </div>
      </div>
      <div style={{ padding: '12px 20px 14px', background: tokens.bg, borderTop: `1px solid ${tokens.lineSoft}` }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <Btn tokens={tokens} primary icon="arrow-right" size="lg" style={{ flex: 1 }}>Send to Strava</Btn>
          <Btn tokens={tokens} size="lg" icon="calendar">Schedule</Btn>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// HISTORY / TRENDS
// ============================================================
function HistoryScreen({ tokens, persona, onTab, active = 'history' }) {
  const ringColor = ({positive: tokens.positive, warm: tokens.warm, cool: tokens.cool}[persona.color]) || tokens.accent;
  const days = ['M','T','W','T','F','S','S'];
  const sleep = [7.2, 7.8, 6.9, 7.5, 5.2, 6.4, 7.1];
  const hrv  = [62, 68, 64, 71, 58, 60, persona.hrv];
  const rhr  = [54, 52, 53, 51, 55, 56, persona.rhr];
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: tokens.bg, overflow: 'hidden' }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 20px 20px' }}>
        <div style={{ fontSize: 12, color: tokens.muted, letterSpacing: 0.3 }}>Last 7 days</div>
        <h1 style={{ fontFamily: tokens.serif, fontSize: 26, fontWeight: 400, color: tokens.ink, margin: '4px 0 18px', letterSpacing: -0.4 }}>
          Your <em style={{ fontStyle: 'italic' }}>signal</em>
        </h1>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
          {['Recovery', 'Strain', 'Sleep', 'Body'].map((t, i) => (
            <div key={t} style={{
              padding: '7px 12px', borderRadius: 99,
              background: i === 0 ? tokens.ink : 'transparent',
              color: i === 0 ? tokens.surface : tokens.muted,
              border: `1px solid ${i === 0 ? tokens.ink : tokens.line}`,
              fontSize: 12, fontWeight: 600,
            }}>{t}</div>
          ))}
        </div>

        {/* Big chart */}
        <div style={{ padding: 16, background: tokens.surface, borderRadius: tokens.radius, border: `1px solid ${tokens.lineSoft}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <div>
              <SectionLabel tokens={tokens}>HRV · 7-day</SectionLabel>
              <div style={{ fontFamily: tokens.serif, fontSize: 36, fontWeight: 400, color: tokens.ink, marginTop: 2, letterSpacing: -0.5, fontVariantNumeric: 'tabular-nums' }}>
                {persona.hrv}<span style={{ fontSize: 16, color: tokens.muted, marginLeft: 4 }}>ms</span>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, color: tokens.muted }}>vs baseline</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: persona.hrvDelta.startsWith('+') ? tokens.positive : tokens.accent, marginTop: 2 }}>{persona.hrvDelta} ms</div>
            </div>
          </div>
          <div style={{ marginTop: 14, height: 110, position: 'relative' }}>
            <svg viewBox="0 0 300 110" width="100%" height="110" preserveAspectRatio="none">
              {/* baseline band */}
              <rect x="0" y="40" width="300" height="30" fill={ringColor} opacity="0.08"/>
              <line x1="0" y1="55" x2="300" y2="55" stroke={tokens.muted} strokeWidth="1" strokeDasharray="3 3" opacity="0.4"/>
              {(() => {
                const max = Math.max(...hrv), min = Math.min(...hrv);
                const range = max - min || 1;
                const pts = hrv.map((v, i) => [i / (hrv.length-1) * 290 + 5, 105 - ((v - min) / range) * 90 - 5]);
                const d = pts.map((p, i) => i === 0 ? `M${p[0]},${p[1]}` : `L${p[0]},${p[1]}`).join(' ');
                return <>
                  <path d={d + ` L295,110 L5,110 Z`} fill={ringColor} opacity={0.15}/>
                  <path d={d} stroke={ringColor} strokeWidth={2.2} fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                  {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r={i === pts.length-1 ? 4 : 2.5} fill={ringColor}/>)}
                </>;
              })()}
            </svg>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 11, color: tokens.muted, fontWeight: 500 }}>
            {days.map((d, i) => <span key={i} style={{ color: i === 6 ? tokens.ink : tokens.muted }}>{d}</span>)}
          </div>
        </div>

        {/* Sleep + RHR mini cards */}
        <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
          <div style={{ flex: 1, padding: 14, background: tokens.surface, borderRadius: tokens.radius, border: `1px solid ${tokens.lineSoft}` }}>
            <SectionLabel tokens={tokens}>Sleep</SectionLabel>
            <div style={{ fontFamily: tokens.serif, fontSize: 22, fontWeight: 400, marginTop: 4, color: tokens.ink, fontVariantNumeric: 'tabular-nums' }}>{persona.sleep}</div>
            <div style={{ marginTop: 8 }}><BarRow data={sleep} color={tokens.cool} accent={6} height={32}/></div>
          </div>
          <div style={{ flex: 1, padding: 14, background: tokens.surface, borderRadius: tokens.radius, border: `1px solid ${tokens.lineSoft}` }}>
            <SectionLabel tokens={tokens}>RHR</SectionLabel>
            <div style={{ fontFamily: tokens.serif, fontSize: 22, fontWeight: 400, marginTop: 4, color: tokens.ink, fontVariantNumeric: 'tabular-nums' }}>{persona.rhr} <span style={{ fontSize: 12, color: tokens.muted }}>bpm</span></div>
            <div style={{ marginTop: 8 }}><Spark data={rhr} color={tokens.muted} width={120} height={32} fill/></div>
          </div>
        </div>

        {/* Activity log */}
        <SectionLabel tokens={tokens} style={{ marginTop: 22, marginBottom: 10 }}>Imported from Strava</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            { d: 'Tue', t: '5 km easy run',  v: '28:14',  i: 'run',      sub: 'Strava · Z2 · 142 avg HR' },
            { d: 'Mon', t: 'Upper push',     v: '52 min', i: 'dumbbell', sub: 'Hevy · 5 sets · bench, ohp' },
            { d: 'Sat', t: 'Long run',       v: '1:24:08',i: 'run',      sub: 'Strava · 14 km · easy' },
            { d: 'Thu', t: 'Hill repeats',   v: '38:00',  i: 'run',      sub: 'Strava · 8 × 60s · hard' },
          ].map((a, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: tokens.surface, borderRadius: tokens.radius, border: `1px solid ${tokens.lineSoft}` }}>
              <div style={{ width: 36, height: 36, borderRadius: 99, background: tokens.surfaceAlt, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={a.i} size={16} color={tokens.inkSoft}/>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: tokens.ink }}>{a.t}</div>
                <div style={{ fontSize: 11.5, color: tokens.muted, marginTop: 2 }}>{a.d} · {a.sub}</div>
              </div>
              <div style={{ fontFamily: tokens.serif, fontSize: 14, color: tokens.ink, fontVariantNumeric: 'tabular-nums' }}>{a.v}</div>
            </div>
          ))}
        </div>
      </div>
      <TabBar tokens={tokens} active={active} onChange={onTab}/>
    </div>
  );
}

// Wrapped HistoryScreen end uses CoachTabBar (3-tab) when window.CoachTabBar exists.
window.HomeScreen = HomeScreen;
window.WorkoutScreen = WorkoutScreen;
window.HistoryScreen = HistoryScreen;
