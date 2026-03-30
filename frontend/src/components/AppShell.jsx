// src/components/AppShell.jsx
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

export default function AppShell({ children, navItems = [] }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const role = user?.role?.name ?? user?.role ?? ''
  const roleLabel = { estudiante:'Estudiante', profesor:'Profesor', registro:'Registro' }[role] ?? role.toUpperCase()

  const initials = `${user?.firstName?.[0] ?? ''}${user?.lastName?.[0] ?? ''}`.toUpperCase()

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  return (
    <div style={{ display:'flex', minHeight:'100dvh' }}>
      {/* ── Sidebar ── */}
      <aside style={{
        width: 'var(--sidebar-w)', background:'#1C2B25', display:'flex',
        flexDirection:'column', flexShrink:0, position:'sticky', top:0, height:'100dvh',
      }}>
        {/* Logo */}
        <div style={{ padding:'20px 18px 16px', borderBottom:'1px solid rgba(255,255,255,.08)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:9 }}>
            <div style={{ width:28, height:28, borderRadius:8, background:'var(--green-700)', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a10 10 0 1 0 10 10"/><path d="M12 6v6l4 2"/>
              </svg>
            </div>
            <span style={{ fontFamily:'var(--font-display)', fontSize:16, color:'#fff', fontWeight:700 }}>UAFAM</span>
          </div>
          <div style={{ marginTop:10, display:'inline-block', padding:'3px 10px', borderRadius:99, border:'1px solid rgba(255,255,255,.2)', fontSize:11, color:'rgba(255,255,255,.6)', letterSpacing:'.08em', textTransform:'uppercase' }}>
            {roleLabel}
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex:1, padding:'12px 0', overflowY:'auto' }}>
          {navItems.map(item => (
            <NavLink key={item.path} to={item.path} end={item.end ?? true} style={({ isActive }) => ({
              display:'flex', alignItems:'center', gap:10, padding:'9px 18px',
              fontSize:14, fontWeight:500, color: isActive ? '#fff' : 'rgba(255,255,255,.55)',
              background: isActive ? 'rgba(255,255,255,.08)' : 'transparent',
              borderLeft: isActive ? '3px solid var(--green-700)' : '3px solid transparent',
              transition:'all .15s',
            })}>
              <span style={{ flexShrink:0 }}>{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Bottom */}
        <div style={{ borderTop:'1px solid rgba(255,255,255,.08)', padding:'12px 0' }}>
          <NavLink to="/configurar-biometria" style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 18px', fontSize:13, color:'rgba(255,255,255,.5)', transition:'color .15s' }}>
            <FingerprintIcon /> Configurar biometría
          </NavLink>
          <button onClick={handleLogout} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 18px', width:'100%', background:'none', border:'none', fontSize:13, color:'rgba(255,255,255,.5)', cursor:'pointer', transition:'color .15s' }}>
            <LogoutIcon /> Cerrar sesión
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', minWidth:0 }}>
        {/* Topbar */}
        <header style={{
          height:'var(--topbar-h)', background:'#fff', borderBottom:'1px solid var(--stone-200)',
          display:'flex', alignItems:'center', justifyContent:'flex-end',
          padding:'0 28px', gap:12, flexShrink:0, position:'sticky', top:0, zIndex:10,
        }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:36, height:36, borderRadius:'50%', background:'var(--green-900)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:700, color:'#fff' }}>
              {initials}
            </div>
            <div>
              <div style={{ fontSize:14, fontWeight:600, color:'var(--stone-900)' }}>
                {user?.firstName} {user?.lastName}
              </div>
              <div style={{ fontSize:11.5, color:'var(--stone-400)' }}>{user?.email}</div>
            </div>
          </div>
        </header>

        {/* Content */}
        <main style={{ flex:1, padding:'32px 36px', overflowY:'auto', animation:'fadeIn .25s ease' }}>
          {children}
        </main>
      </div>
    </div>
  )
}

// Icons
function FingerprintIcon() {
  return <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M2 12C2 6.5 6.5 2 12 2a10 10 0 0 1 8 4"/><path d="M5 19.5C5.5 18 6 15 6 12c0-1.9.7-3.7 2-5"/><path d="M17.8 21.8c.2-.7.2-1.5.2-2.3a8 8 0 0 0-2-5.3"/><path d="M10.9 7A6 6 0 0 1 18 12c0 .8 0 1.6-.1 2.4"/><path d="M12 12c0 3-1 5.5-3 7.5"/><path d="M12 12c0 1.7-.3 3.4-1 5"/></svg>
}
function LogoutIcon() {
  return <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
}
