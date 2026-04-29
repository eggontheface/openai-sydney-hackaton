// BioStream — conversation-first coach experience
// Locked to direction B (Quiet Data). Warm + encouraging voice.

// ============================================================
// Helpers
// ============================================================
const dirB = window.DIRECTIONS.B;

// Coach voice helpers — warm, encouraging
const COACH_VOICE = {
  greet: "Morning, Dane. How are you landing today?",
  goodSleep: "Solid. 7 hours, score of 76 — you got the rest.",
  hrvUp: "Your HRV nudged up overnight. Body's saying yes.",
  hrvDown: "HRV dipped a bit. We'll honour that today.",
  affirm: ["Got it.", "Lovely.", "Okay, that helps.", "Good to know."],
  encourage: ["You've earned this.", "Trust the work.", "One day at a time.", "This is the long game."],
};

// ============================================================
// Chat primitives — refined for warm conversation
// ============================================================
function CoachAvatar({ tokens, online = true, size = 32 }) {
  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <div style={{
        width: size, height: size, borderRadius: 99,
        background: tokens.ink, color: tokens.surface,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: tokens.serif, fontSize: size * 0.45, fontStyle: 'italic',
      }}>c</div>
      {online && <div style={{
        position: 'absolute', bottom: 0, right: 0, width: 8, height: 8,
        borderRadius: 99, background: tokens.positive, border: `2px solid ${tokens.bg}`,
      }}/>}
    </div>
  );
}

// Coach text — serif, warm, italics on emphasis
function CoachLine({ tokens, children, first = false }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', maxWidth: '92%' }}>
      {first && <CoachAvatar tokens={tokens}/>}
      {!first && <div style={{ width: 32, flexShrink: 0 }}/>}
      <div style={{
        fontFamily: tokens.serif, fontSize: 17, lineHeight: 1.45,
        color: tokens.ink, padding: '4px 2px', fontWeight: 400, letterSpacing: -0.1,
      }}>{children}</div>
    </div>
  );
}

function UserBubble({ tokens, children, soft = false }) {
  return (
    <div style={{
      alignSelf: 'flex-end', maxWidth: '78%',
      background: soft ? tokens.surface : tokens.ink,
      color: soft ? tokens.ink : tokens.surface,
      padding: '10px 14px', borderRadius: tokens.radius,
      fontSize: 14, lineHeight: 1.45,
      border: soft ? `1px solid ${tokens.line}` : 'none',
    }}>{children}</div>
  );
}

// In-chat answer chips (tappable replies for hybrid onboarding)
function ChipRow({ tokens, options, onPick, accent }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'flex-end', marginLeft: 'auto', maxWidth: '92%' }}>
      {options.map(o => (
        <button key={o.value || o.label || o} onClick={() => onPick && onPick(o.value || o.label || o)}
          style={{
            padding: '8px 14px', borderRadius: 99,
            background: tokens.surface,
            color: tokens.ink,
            border: `1px solid ${accent ? tokens.accent : tokens.line}`,
            fontFamily: tokens.sans, fontSize: 13, fontWeight: 500, cursor: 'pointer',
            transition: 'all 150ms',
          }}
          onMouseDown={e => e.currentTarget.style.background = tokens.surfaceAlt}
          onMouseUp={e => e.currentTarget.style.background = tokens.surface}>
          {o.icon && <Icon name={o.icon} size={13} color={tokens.ink} style={{ marginRight: 6, verticalAlign: -2 }}/>}
          {o.label || o}
        </button>
      ))}
    </div>
  );
}

// Inline data cards (mixed in with conversation)
function DataCard({ tokens, kind, children, accent }) {
  const c = accent || tokens.muted;
  return (
    <div style={{
      maxWidth: '88%', alignSelf: 'flex-start', marginLeft: 42,
      background: tokens.surface, borderRadius: tokens.radius,
      border: `1px solid ${tokens.lineSoft}`,
      padding: '14px 16px',
      borderLeft: `2px solid ${c}`,
    }}>
      {kind && <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1.6, textTransform: 'uppercase', color: c, marginBottom: 10 }}>{kind}</div>}
      {children}
    </div>
  );
}

// Tappable inline metric
function InlineMetric({ tokens, label, value, delta, color }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'baseline', gap: 4,
      padding: '2px 8px', borderRadius: 99, background: tokens.surfaceAlt,
      border: `1px solid ${tokens.lineSoft}`,
      fontFamily: tokens.sans, fontSize: 13, color: tokens.ink, fontVariantNumeric: 'tabular-nums',
      cursor: 'pointer',
    }}>
      <span style={{ color: tokens.muted, fontSize: 11, fontWeight: 600 }}>{label}</span>
      <strong style={{ fontWeight: 600 }}>{value}</strong>
      {delta && <span style={{ color: color || tokens.muted, fontSize: 11, fontWeight: 600 }}>{delta}</span>}
    </span>
  );
}

window.CoachAvatar = CoachAvatar;
window.CoachLine = CoachLine;
window.UserBubbleV2 = UserBubble;
window.ChipRow = ChipRow;
window.DataCard = DataCard;
window.InlineMetric = InlineMetric;
