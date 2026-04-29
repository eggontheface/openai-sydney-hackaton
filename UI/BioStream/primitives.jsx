// BioStream — primitives + icons (shared across all directions)

// ───────── Icons (stroked, single style, 24×24) ─────────
function Icon({ name, size = 20, color = 'currentColor', stroke = 1.6 }) {
  const s = { width: size, height: size, fill: 'none', stroke: color, strokeWidth: stroke, strokeLinecap: 'round', strokeLinejoin: 'round' };
  switch (name) {
    case 'home': return <svg viewBox="0 0 24 24" {...s}><path d="M3 11l9-8 9 8v9a2 2 0 0 1-2 2h-4v-7h-6v7H5a2 2 0 0 1-2-2v-9z"/></svg>;
    case 'chat': return <svg viewBox="0 0 24 24" {...s}><path d="M21 12a8 8 0 1 1-3-6.2L21 5l-1.2 3A8 8 0 0 1 21 12z"/><path d="M8 12h.01M12 12h.01M16 12h.01"/></svg>;
    case 'history': return <svg viewBox="0 0 24 24" {...s}><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l3 2"/></svg>;
    case 'profile': return <svg viewBox="0 0 24 24" {...s}><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>;
    case 'arrow-right': return <svg viewBox="0 0 24 24" {...s}><path d="M5 12h14M13 6l6 6-6 6"/></svg>;
    case 'arrow-left': return <svg viewBox="0 0 24 24" {...s}><path d="M19 12H5M11 6l-6 6 6 6"/></svg>;
    case 'arrow-up': return <svg viewBox="0 0 24 24" {...s}><path d="M12 19V5M6 11l6-6 6 6"/></svg>;
    case 'arrow-down': return <svg viewBox="0 0 24 24" {...s}><path d="M12 5v14M6 13l6 6 6-6"/></svg>;
    case 'check': return <svg viewBox="0 0 24 24" {...s}><path d="M5 12l5 5L20 7"/></svg>;
    case 'plus': return <svg viewBox="0 0 24 24" {...s}><path d="M12 5v14M5 12h14"/></svg>;
    case 'send': return <svg viewBox="0 0 24 24" {...s}><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>;
    case 'mic': return <svg viewBox="0 0 24 24" {...s}><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>;
    case 'sparkles': return <svg viewBox="0 0 24 24" {...s}><path d="M12 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2 2-5z"/><path d="M19 14l1 2 2 1-2 1-1 2-1-2-2-1 2-1 1-2zM5 5l.7 1.5L7 7l-1.3.5L5 9l-.7-1.5L3 7l1.3-.5L5 5z"/></svg>;
    case 'heart': return <svg viewBox="0 0 24 24" {...s}><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z"/></svg>;
    case 'pulse': return <svg viewBox="0 0 24 24" {...s}><path d="M3 12h4l2-7 4 14 2-7h6"/></svg>;
    case 'moon': return <svg viewBox="0 0 24 24" {...s}><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>;
    case 'run': return <svg viewBox="0 0 24 24" {...s}><circle cx="17" cy="4" r="2"/><path d="M9 21l2-5-3-3 1-5 4 2 2 4 4 1M5 14l3-1"/></svg>;
    case 'walk': return <svg viewBox="0 0 24 24" {...s}><circle cx="13" cy="4" r="2"/><path d="M7 21l3-7-2-3 2-4 3 2 3 5 3 1M5 13l3-1"/></svg>;
    case 'dumbbell': return <svg viewBox="0 0 24 24" {...s}><path d="M6 7v10M3 9v6M18 7v10M21 9v6M6 12h12"/></svg>;
    case 'bike': return <svg viewBox="0 0 24 24" {...s}><circle cx="5.5" cy="17" r="3.5"/><circle cx="18.5" cy="17" r="3.5"/><path d="M5.5 17l4-9h4l4 9M14 8h3M9 17l3-7"/></svg>;
    case 'flame': return <svg viewBox="0 0 24 24" {...s}><path d="M12 22a7 7 0 0 0 7-7c0-3-2-5-4-8-1-1.5-2-3.5-2-5-2 2-7 5-7 11a6 6 0 0 0 6 6z"/></svg>;
    case 'flag': return <svg viewBox="0 0 24 24" {...s}><path d="M5 21V4M5 15h14l-3-5 3-5H5"/></svg>;
    case 'apple': return <svg viewBox="0 0 24 24" {...s}><path d="M12 7c-3-3-9-2-9 4 0 5 4 11 7 11 1 0 1-1 2-1s1 1 2 1c3 0 7-6 7-11 0-6-6-7-9-4z"/><path d="M12 7s0-3 3-4"/></svg>;
    case 'settings': return <svg viewBox="0 0 24 24" {...s}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>;
    case 'key': return <svg viewBox="0 0 24 24" {...s}><circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M16 7l3 3"/></svg>;
    case 'shield': return <svg viewBox="0 0 24 24" {...s}><path d="M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6l8-3z"/></svg>;
    case 'lock': return <svg viewBox="0 0 24 24" {...s}><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>;
    case 'eye': return <svg viewBox="0 0 24 24" {...s}><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>;
    case 'eye-off': return <svg viewBox="0 0 24 24" {...s}><path d="M9.9 5a10 10 0 0 1 12.1 7 17 17 0 0 1-3 4M6.6 6.6A17 17 0 0 0 2 12s4 7 10 7c2 0 4-.6 5.5-1.5M3 3l18 18M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>;
    case 'close': return <svg viewBox="0 0 24 24" {...s}><path d="M6 6l12 12M18 6L6 18"/></svg>;
    case 'menu': return <svg viewBox="0 0 24 24" {...s}><path d="M3 6h18M3 12h18M3 18h18"/></svg>;
    case 'more': return <svg viewBox="0 0 24 24" {...s}><circle cx="12" cy="6" r="1.2" fill={color}/><circle cx="12" cy="12" r="1.2" fill={color}/><circle cx="12" cy="18" r="1.2" fill={color}/></svg>;
    case 'calendar': return <svg viewBox="0 0 24 24" {...s}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/></svg>;
    case 'clock': return <svg viewBox="0 0 24 24" {...s}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>;
    case 'zap': return <svg viewBox="0 0 24 24" {...s}><path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z"/></svg>;
    case 'chart': return <svg viewBox="0 0 24 24" {...s}><path d="M3 21V5M3 21h18M7 16v-5M11 16V8M15 16v-3M19 16V6"/></svg>;
    case 'route': return <svg viewBox="0 0 24 24" {...s}><circle cx="6" cy="6" r="2"/><circle cx="18" cy="18" r="2"/><path d="M8 6h6a4 4 0 0 1 0 8h-4a4 4 0 0 0 0 8h6"/></svg>;
    default: return <svg viewBox="0 0 24 24" {...s}><circle cx="12" cy="12" r="9"/></svg>;
  }
}

// ───────── Status bar (Android, themed to direction bg) ─────────
function StatusBar({ tokens }) {
  return (
    <div style={{ height: 36, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 18px', background: tokens.bg, color: tokens.ink, position: 'relative', flexShrink: 0 }}>
      <span style={{ fontSize: 13, fontWeight: 500, fontFamily: tokens.sans, fontVariantNumeric: 'tabular-nums' }}>9:41</span>
      <div style={{ position: 'absolute', left: '50%', top: 6, transform: 'translateX(-50%)', width: 22, height: 22, borderRadius: 99, background: '#1a1a1a' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <svg width="14" height="10" viewBox="0 0 14 10" fill="none"><path d="M7 9.5L0.5 3a9 9 0 0 1 13 0L7 9.5z" fill={tokens.ink}/></svg>
        <svg width="14" height="10" viewBox="0 0 14 10" fill="none"><path d="M13 9V1L1 9h12z" fill={tokens.ink}/></svg>
        <svg width="20" height="11" viewBox="0 0 20 11" fill="none"><rect x="1" y="1" width="16" height="9" rx="2" stroke={tokens.ink} strokeWidth="1.2"/><rect x="3" y="3" width="11" height="5" rx="1" fill={tokens.ink}/><rect x="18" y="4" width="1.5" height="3" rx="0.5" fill={tokens.ink}/></svg>
      </div>
    </div>
  );
}

// ───────── Nav pill bar (bottom) ─────────
function NavPill({ tokens }) {
  return (
    <div style={{ height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: 'transparent' }}>
      <div style={{ width: 110, height: 4, borderRadius: 2, background: tokens.ink, opacity: 0.55 }} />
    </div>
  );
}

// ───────── Phone shell (frameless wrapper used inside artboards) ─────────
function PhoneShell({ tokens, children, dark = false, bg, statusbar = true, navpill = true, style }) {
  const fillBg = bg || tokens.bg;
  return (
    <div style={{
      width: 380, height: 760, borderRadius: 36, overflow: 'hidden',
      background: fillBg, color: tokens.ink, fontFamily: tokens.sans,
      display: 'flex', flexDirection: 'column',
      border: '8px solid #2a2a2a',
      boxShadow: '0 30px 60px -20px rgba(40,30,20,0.25), 0 8px 24px -8px rgba(40,30,20,0.15)',
      position: 'relative',
      ...style,
    }}>
      {statusbar && <StatusBar tokens={{ ...tokens, bg: fillBg }} />}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative', display: 'flex', flexDirection: 'column' }}>
        {children}
      </div>
      {navpill && <NavPill tokens={{ ...tokens, ink: dark ? '#fff' : tokens.ink }} />}
    </div>
  );
}

// ───────── Bottom tab bar ─────────
function TabBar({ tokens, active = 'home', onChange }) {
  const tabs = [
    { id: 'home', label: 'Today', icon: 'home' },
    { id: 'chat', label: 'Coach', icon: 'sparkles' },
    { id: 'history', label: 'History', icon: 'chart' },
    { id: 'profile', label: 'You', icon: 'profile' },
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
              color: on ? tokens.accent : tokens.muted,
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

// ───────── Mini sparkline (no chart lib) ─────────
function Spark({ data, color, height = 28, width = 90, fill = false, dot = true }) {
  const max = Math.max(...data), min = Math.min(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => [i / (data.length - 1) * width, height - ((v - min) / range) * (height - 4) - 2]);
  const path = pts.map((p, i) => (i === 0 ? `M${p[0]},${p[1]}` : `L${p[0]},${p[1]}`)).join(' ');
  const area = path + ` L${width},${height} L0,${height} Z`;
  const last = pts[pts.length - 1];
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {fill && <path d={area} fill={color} opacity={0.12} />}
      <path d={path} stroke={color} strokeWidth={1.6} fill="none" strokeLinecap="round" strokeLinejoin="round"/>
      {dot && <circle cx={last[0]} cy={last[1]} r={2.6} fill={color} />}
    </svg>
  );
}

// ───────── Bar chart row ─────────
function BarRow({ data, color, height = 60, max, accent = -1 }) {
  const m = max || Math.max(...data);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height }}>
      {data.map((v, i) => (
        <div key={i} style={{
          flex: 1, height: `${(v / m) * 100}%`,
          background: i === accent ? color : color,
          opacity: i === accent ? 1 : 0.35,
          borderRadius: 2, minHeight: 2,
        }} />
      ))}
    </div>
  );
}

// ───────── Ring (readiness) ─────────
function Ring({ value, size = 140, stroke = 12, color, track, label, sub, tokens, big = false }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (value / 100) * circ;
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} stroke={track} strokeWidth={stroke} fill="none"/>
        <circle cx={size/2} cy={size/2} r={r} stroke={color} strokeWidth={stroke} fill="none"
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 800ms cubic-bezier(.2,.8,.2,1)' }}/>
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontFamily: tokens.serif, fontWeight: 400, fontSize: big ? 56 : 42, lineHeight: 1, color: tokens.ink, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
        {label && <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1.2, textTransform: 'uppercase', color: tokens.muted, marginTop: 6 }}>{label}</div>}
        {sub && <div style={{ fontSize: 11, color: tokens.muted, marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  );
}

// ───────── Thin button ─────────
function Btn({ children, primary, tokens, onClick, size = 'md', style, full, icon }) {
  const padY = size === 'sm' ? 8 : size === 'lg' ? 16 : 12;
  const padX = size === 'sm' ? 14 : size === 'lg' ? 28 : 20;
  return (
    <button onClick={onClick} style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      padding: `${padY}px ${padX}px`, borderRadius: tokens.radius * 2,
      background: primary ? tokens.ink : 'transparent',
      color: primary ? tokens.surface : tokens.ink,
      border: primary ? 'none' : `1px solid ${tokens.line}`,
      fontFamily: tokens.sans, fontSize: size === 'sm' ? 13 : 14, fontWeight: 600, letterSpacing: 0.1,
      cursor: 'pointer', width: full ? '100%' : 'auto',
      ...style,
    }}>
      {icon && <Icon name={icon} size={16} />}
      {children}
    </button>
  );
}

// ───────── Section header (small all-caps label) ─────────
function SectionLabel({ children, tokens, style }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 600, letterSpacing: 1.6, textTransform: 'uppercase',
      color: tokens.muted, fontFamily: tokens.sans, ...style,
    }}>{children}</div>
  );
}

Object.assign(window, { Icon, StatusBar, NavPill, PhoneShell, TabBar, Spark, BarRow, Ring, Btn, SectionLabel });
