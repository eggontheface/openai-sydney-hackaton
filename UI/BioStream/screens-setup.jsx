// BioStream — screens (each takes tokens; persona drives data)

// ============================================================
// 1. ONBOARDING — goal questionnaire
// ============================================================
function OnboardingScreen({ tokens, persona, goal = 'run', step = 2 }) {
  const goals = [
    { id: 'maintain', label: 'Maintain fitness',     sub: 'Stay sharp, mix it up',         icon: 'heart' },
    { id: 'muscle',   label: 'Build muscle',          sub: 'Strength & hypertrophy',        icon: 'dumbbell' },
    { id: 'run',      label: 'Improve running',       sub: 'Faster, longer, smoother',      icon: 'run' },
    { id: 'cycle',    label: 'Improve cycling',       sub: 'FTP, endurance, climbing',      icon: 'bike' },
    { id: 'fat',      label: 'Lose fat',              sub: 'Sustainable deficit',           icon: 'flame' },
    { id: 'event',    label: 'Train for an event',    sub: 'Race, hike, expedition',        icon: 'flag' },
    { id: 'sleep',    label: 'Sleep & recovery',      sub: 'Restore the basics',            icon: 'moon' },
  ];
  const totalSteps = 5;
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: tokens.bg, padding: '20px 22px 24px' }}>
      {/* progress dots */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 24 }}>
        {Array.from({ length: totalSteps }).map((_, i) => (
          <div key={i} style={{
            flex: 1, height: 3, borderRadius: 2,
            background: i < step ? tokens.ink : tokens.line,
          }}/>
        ))}
      </div>
      <SectionLabel tokens={tokens} style={{ marginBottom: 14 }}>Step {step} of {totalSteps}</SectionLabel>
      <h1 style={{
        fontFamily: tokens.serif, fontSize: 32, fontWeight: 400, lineHeight: 1.1,
        color: tokens.ink, margin: '0 0 10px',
        letterSpacing: -0.5,
      }}>What's your<br/><em style={{ fontStyle: 'italic', color: tokens.accent }}>main focus</em>?</h1>
      <p style={{ fontSize: 14, color: tokens.muted, lineHeight: 1.5, margin: '0 0 22px' }}>
        Pick one. You can shift gears later — your coach will adapt.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto', flex: 1, marginRight: -8, paddingRight: 8 }}>
        {goals.map(g => {
          const on = g.id === goal;
          return (
            <div key={g.id} style={{
              display: 'flex', alignItems: 'center', gap: 14,
              padding: '14px 16px', borderRadius: tokens.radius,
              background: on ? tokens.ink : tokens.surface,
              color: on ? tokens.surface : tokens.ink,
              border: `1px solid ${on ? tokens.ink : tokens.line}`,
              cursor: 'pointer', transition: 'all 200ms',
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: 99,
                background: on ? 'rgba(255,255,255,0.12)' : tokens.bg,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon name={g.icon} size={18} color={on ? tokens.surface : tokens.ink} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 600 }}>{g.label}</div>
                <div style={{ fontSize: 12, color: on ? 'rgba(255,255,255,0.65)' : tokens.muted, marginTop: 2 }}>{g.sub}</div>
              </div>
              {on && <Icon name="check" size={18} color={tokens.surface} />}
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
        <Btn tokens={tokens}>Back</Btn>
        <Btn tokens={tokens} primary full icon="arrow-right" style={{ flex: 1 }}>Continue</Btn>
      </div>
    </div>
  );
}

// ============================================================
// 2. HEALTH PERMISSIONS
// ============================================================
function PermissionsScreen({ tokens }) {
  const sources = [
    { name: 'Heart rate & HRV',  desc: 'Resting & overnight HRV', on: true,  icon: 'pulse' },
    { name: 'Sleep',             desc: 'Stages, duration, score', on: true,  icon: 'moon' },
    { name: 'Workouts',          desc: 'Strava, Garmin, Hevy',    on: true,  icon: 'run' },
    { name: 'Steps & energy',    desc: 'Daily activity baseline', on: true,  icon: 'walk' },
    { name: 'Nutrition',         desc: 'Calories, macros',        on: false, icon: 'apple' },
    { name: 'Body composition',  desc: 'Weight, body fat',        on: false, icon: 'chart' },
  ];
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: tokens.bg, padding: '24px 22px 24px', overflow: 'hidden' }}>
      <div style={{
        width: 56, height: 56, borderRadius: tokens.radius,
        background: tokens.accentSoft, display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 18,
      }}>
        <Icon name="shield" size={26} color={tokens.accent} />
      </div>
      <h1 style={{ fontFamily: tokens.serif, fontSize: 26, fontWeight: 400, lineHeight: 1.15, color: tokens.ink, margin: '0 0 8px', letterSpacing: -0.3 }}>
        Connect <em style={{ color: tokens.accent }}>Health Connect</em>
      </h1>
      <p style={{ fontSize: 13.5, color: tokens.muted, lineHeight: 1.55, margin: '0 0 18px' }}>
        BioStream reads your data on-device. Nothing is uploaded without your say-so.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: tokens.line, borderRadius: tokens.radius, overflow: 'hidden', border: `1px solid ${tokens.line}` }}>
        {sources.map((s, i) => (
          <div key={s.name} style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '14px 16px', background: tokens.surface,
          }}>
            <Icon name={s.icon} size={18} color={tokens.inkSoft} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: tokens.ink }}>{s.name}</div>
              <div style={{ fontSize: 12, color: tokens.muted }}>{s.desc}</div>
            </div>
            <Toggle on={s.on} tokens={tokens}/>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 16, padding: 14, background: tokens.surfaceAlt, borderRadius: tokens.radius, border: `1px solid ${tokens.lineSoft}` }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <Icon name="lock" size={16} color={tokens.muted} />
          <div style={{ fontSize: 12, color: tokens.muted, lineHeight: 1.5 }}>
            Your health data stays on this device. The coach receives only summaries you explicitly approve.
          </div>
        </div>
      </div>
      <div style={{ flex: 1 }}/>
      <Btn tokens={tokens} primary full icon="arrow-right" style={{ marginTop: 16 }}>Allow & continue</Btn>
    </div>
  );
}

function Toggle({ on, tokens }) {
  return (
    <div style={{
      width: 36, height: 22, borderRadius: 99,
      background: on ? tokens.ink : tokens.line,
      position: 'relative', flexShrink: 0,
      transition: 'background 200ms',
    }}>
      <div style={{
        position: 'absolute', top: 2, left: on ? 16 : 2,
        width: 18, height: 18, borderRadius: 99, background: tokens.surface,
        boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
        transition: 'left 200ms',
      }}/>
    </div>
  );
}

// ============================================================
// 3. BYO API KEY
// ============================================================
function ApiKeyScreen({ tokens }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: tokens.bg, padding: '24px 22px 24px', overflow: 'hidden' }}>
      <div style={{
        width: 56, height: 56, borderRadius: tokens.radius,
        background: tokens.accentSoft, display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 18,
      }}>
        <Icon name="key" size={26} color={tokens.accent} />
      </div>
      <h1 style={{ fontFamily: tokens.serif, fontSize: 26, fontWeight: 400, lineHeight: 1.15, color: tokens.ink, margin: '0 0 8px', letterSpacing: -0.3 }}>
        Bring your <em style={{ color: tokens.accent }}>OpenAI key</em>
      </h1>
      <p style={{ fontSize: 13.5, color: tokens.muted, lineHeight: 1.55, margin: '0 0 22px' }}>
        Your coach runs on your account, your terms. Stored encrypted on this device only.
      </p>
      <SectionLabel tokens={tokens} style={{ marginBottom: 8 }}>API Key</SectionLabel>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '12px 14px', background: tokens.surface,
        borderRadius: tokens.radius, border: `1px solid ${tokens.line}`,
        fontFamily: tokens.mono, fontSize: 13, color: tokens.inkSoft,
      }}>
        <span style={{ flex: 1, letterSpacing: -0.2 }}>sk-proj-•••••••••••••••••••••mE7Q</span>
        <Icon name="eye" size={16} color={tokens.muted}/>
      </div>
      <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <SectionLabel tokens={tokens}>Model</SectionLabel>
        <div style={{ display: 'flex', gap: 8 }}>
          {['gpt-5','gpt-5-mini','o3'].map((m, i) => (
            <div key={m} style={{
              padding: '10px 14px', borderRadius: tokens.radius,
              background: i === 0 ? tokens.ink : tokens.surface,
              color: i === 0 ? tokens.surface : tokens.ink,
              border: `1px solid ${i === 0 ? tokens.ink : tokens.line}`,
              fontSize: 13, fontFamily: tokens.mono, fontWeight: 500,
            }}>{m}</div>
          ))}
        </div>
      </div>
      <div style={{ marginTop: 18, padding: 14, background: tokens.surfaceAlt, borderRadius: tokens.radius, border: `1px solid ${tokens.lineSoft}` }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <Icon name="shield" size={16} color={tokens.muted} />
          <div style={{ fontSize: 12, color: tokens.muted, lineHeight: 1.5 }}>
            We never see your key. It's stored in Android Keystore and used only when you message your coach.
          </div>
        </div>
      </div>
      <div style={{ marginTop: 12, fontSize: 12, color: tokens.accent, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}>
        Need a key? Get one from platform.openai.com <Icon name="arrow-right" size={12} color={tokens.accent}/>
      </div>
      <div style={{ flex: 1 }}/>
      <Btn tokens={tokens} primary full icon="check">Save & continue</Btn>
    </div>
  );
}

window.OnboardingScreen = OnboardingScreen;
window.PermissionsScreen = PermissionsScreen;
window.ApiKeyScreen = ApiKeyScreen;
window.Toggle = Toggle;
