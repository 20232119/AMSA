// src/components/ui.jsx
// Shared primitives: Card, Button, Badge, Spinner, StatCard, EmptyState, icons

export function Card({ children, style = {}, onClick }) {
  return (
    <div onClick={onClick} style={{
      background:'#fff', borderRadius:'var(--radius-lg)',
      border:'1px solid var(--stone-200)', padding:'20px',
      ...(onClick ? { cursor:'pointer', transition:'box-shadow .15s', } : {}),
      ...style,
    }}>
      {children}
    </div>
  )
}

export function Button({ children, variant='secondary', size='md', disabled, onClick, type='button', style={} }) {
  const base = {
    display:'inline-flex', alignItems:'center', justifyContent:'center', gap:7,
    border:'none', borderRadius:'var(--radius-md)', fontFamily:'inherit',
    fontWeight:600, cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? .55 : 1, transition:'all .15s', ...style,
  }
  const sizes = {
    sm: { padding:'7px 16px', fontSize:13 },
    md: { padding:'10px 22px', fontSize:14 },
    lg: { padding:'13px 28px', fontSize:15 },
  }
  const variants = {
    primary:   { background:'linear-gradient(135deg, var(--green-900), var(--green-700))', color:'#fff', boxShadow:'0 2px 8px rgba(26,82,118,.2)' },
    secondary: { background:'transparent', color:'var(--stone-700)', border:'1.5px solid var(--stone-200)' },
    danger:    { background:'var(--error)', color:'#fff' },
    ghost:     { background:'transparent', color:'var(--green-700)', border:'none' },
  }
  return (
    <button type={type} disabled={disabled} onClick={onClick}
      style={{ ...base, ...sizes[size], ...variants[variant] }}>
      {children}
    </button>
  )
}

export function Badge({ children, color='green' }) {
  const map = {
    green:  { bg:'var(--green-50)',   text:'var(--green-800)' },
    amber:  { bg:'var(--warning-bg)', text:'var(--warning)'   },
    red:    { bg:'var(--error-bg)',   text:'var(--error)'     },
    stone:  { bg:'var(--stone-100)',  text:'var(--stone-500)' },
    blue:   { bg:'#EBF5FB',          text:'var(--blue-700)'  },
  }
  const c = map[color] ?? map.stone
  return (
    <span style={{
      display:'inline-block', padding:'3px 10px', borderRadius:99,
      fontSize:11, fontWeight:700, letterSpacing:'.04em', textTransform:'uppercase',
      background:c.bg, color:c.text,
    }}>
      {children}
    </span>
  )
}

export function Spinner({ size=32 }) {
  return (
    <div style={{ width:size, height:size, borderRadius:'50%', border:`3px solid var(--stone-200)`, borderTopColor:'var(--green-700)', animation:'spinRing .8s linear infinite' }} />
  )
}

export function PageSpinner() {
  return (
    <div style={{ display:'flex', justifyContent:'center', padding:'60px 0' }}>
      <Spinner />
    </div>
  )
}

export function StatCard({ label, value, color, note, icon }) {
  return (
    <Card>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
        <div style={{ fontSize:'2rem', fontFamily:'var(--font-display)', color: color ?? 'var(--stone-900)', fontWeight:700 }}>{value}</div>
        {icon && <div style={{ color:'var(--stone-300)' }}>{icon}</div>}
      </div>
      <div style={{ fontSize:13.5, color:'var(--stone-500)', fontWeight:500 }}>{label}</div>
      {note && <div style={{ fontSize:12, color:'var(--stone-400)', marginTop:3 }}>{note}</div>}
    </Card>
  )
}

export function EmptyState({ icon, title, desc }) {
  return (
    <div style={{ textAlign:'center', padding:'60px 20px', color:'var(--stone-400)' }}>
      {icon && <div style={{ fontSize:40, marginBottom:16 }}>{icon}</div>}
      <div style={{ fontSize:16, fontWeight:600, color:'var(--stone-500)', marginBottom:6 }}>{title}</div>
      {desc && <div style={{ fontSize:13.5 }}>{desc}</div>}
    </div>
  )
}

export function SectionTitle({ children, style={} }) {
  return <h3 style={{ fontFamily:'var(--font-display)', fontSize:'1.25rem', color:'var(--stone-900)', marginBottom:16, ...style }}>{children}</h3>
}

// ── Icons ──────────────────────────────────────────────────────────────────────
export function HomeIcon({ size=18 })        { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg> }
export function BookIcon({ size=18 })        { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg> }
export function UsersIcon({ size=18 })       { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> }
export function ChartIcon({ size=18 })       { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> }
export function CheckIcon({ size=18 })       { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg> }
export function UploadIcon({ size=18 })      { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg> }
export function ShieldIcon({ size=18 })      { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> }
export function FingerprintIcon({ size=18 }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M2 12C2 6.5 6.5 2 12 2a10 10 0 0 1 8 4"/><path d="M5 19.5C5.5 18 6 15 6 12c0-1.9.7-3.7 2-5"/><path d="M17.8 21.8c.2-.7.2-1.5.2-2.3a8 8 0 0 0-2-5.3"/><path d="M10.9 7A6 6 0 0 1 18 12c0 .8 0 1.6-.1 2.4"/><path d="M12 12c0 3-1 5.5-3 7.5"/><path d="M12 12c0 1.7-.3 3.4-1 5"/></svg> }
export function CalendarIcon({ size=18 })    { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> }
export function DownloadIcon({ size=18 })    { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> }
