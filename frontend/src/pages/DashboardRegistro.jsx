// src/pages/DashboardRegistro.jsx
import { useNavigate } from 'react-router-dom'
import { useAuth }     from '../context/AuthContext.jsx'
import AppShell        from '../components/AppShell.jsx'
import { Card, Badge, Button, StatCard, SectionTitle } from '../components/ui.jsx'
import { BookIcon, UploadIcon, ChartIcon, ShieldIcon, HomeIcon, ChartIcon as Chart } from '../components/ui.jsx'
import { navForRole }  from '../lib/navItems.js'

export default function DashboardRegistro() {
  const { user }  = useAuth()
  const navigate  = useNavigate()
  const navItems  = navForRole('registro')

  return (
    <AppShell navItems={navItems}>
      {/* Greeting */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:28 }}>
        <div>
          <h2 style={{ fontFamily:'var(--font-display)', fontSize:'1.8rem', color:'var(--stone-900)', margin:0 }}>Panel de Registro</h2>
          <p style={{ color:'var(--stone-400)', fontSize:14, marginTop:6 }}>
            {user?.firstName} · Dpto. Registro y Admisiones
          </p>
        </div>
        <Badge color="stone">Administrador</Badge>
      </div>

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(180px,1fr))', gap:16, marginBottom:36 }}>
        <StatCard value="1,204" label="Estudiantes activos" color="var(--green-700)" />
        <StatCard value="48"    label="Secciones abiertas"  color="var(--gold-500)"  />
        <StatCard value="12"    label="Notas pendientes validar" color="var(--error)" />
        <StatCard value="0"     label="Exportaciones a SIA" color="var(--stone-400)" note="Este período" />
      </div>

      {/* Quick actions */}
      <SectionTitle>Acciones rápidas</SectionTitle>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(240px,1fr))', gap:16 }}>

        <ActionCard
          icon={<BookIcon size={28} />}
          title="Validar calificaciones"
          desc="Revisa y aprueba las notas enviadas por los profesores antes de publicarlas."
          badge={<Badge color="red">12 Pendientes</Badge>}
          btnLabel="Ir a calificaciones →"
          variant="secondary"
          onClick={() => navigate('/registro/calificaciones')}
        />

        <ActionCard
          icon={<UploadIcon size={28} />}
          title="Exportar a SIA"
          desc="Selecciona las secciones y descarga el reporte Excel listo para cargar al SIA."
          badge={<Badge color="green">Activo</Badge>}
          btnLabel="Exportar reportes →"
          variant="primary"
          onClick={() => navigate('/exportar-sia')}
          highlight
        />

        <ActionCard
          icon={<Chart size={28} />}
          title="Reportes académicos"
          desc="Genera reportes consolidados de asistencia y rendimiento académico por período."
          badge={<Badge color="green">Activo</Badge>}
          btnLabel="Ver reportes →"
          variant="secondary"
          onClick={() => navigate('/registro/reportes')}
        />

        <ActionCard
          icon={<ShieldIcon size={28} />}
          title="Gestión de usuarios"
          desc="Administra los usuarios del sistema: estudiantes, profesores y personal."
          badge={<Badge color="stone">Próximamente</Badge>}
          btnLabel="Próximamente"
          disabled
        />
      </div>

      {/* Sprint hint */}
      <div style={{ marginTop:32, padding:'12px 16px', borderRadius:'var(--radius-md)', background:'var(--green-50)', color:'var(--green-800)', fontSize:13, display:'flex', alignItems:'center', gap:10, border:'1px solid var(--green-200)' }}>
        <InfoIcon />
        Sprint 3–5 completados · Autenticación, biometría, asistencia, calificaciones, reportes y exportación XLSX funcionales
      </div>
    </AppShell>
  )
}

function ActionCard({ icon, title, desc, badge, btnLabel, disabled, onClick, variant='secondary', highlight }) {
  return (
    <Card style={{
      display:'flex', flexDirection:'column', gap:14,
      ...(highlight ? { border:'2px solid var(--green-700)', boxShadow:'0 0 0 4px rgba(30,132,73,.07)' } : {}),
    }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
        <div style={{ color:'var(--green-700)' }}>{icon}</div>
        {badge}
      </div>
      <div>
        <div style={{ fontWeight:600, color:'var(--stone-900)', marginBottom:6 }}>{title}</div>
        <div style={{ fontSize:13.5, color:'var(--stone-400)', lineHeight:1.6 }}>{desc}</div>
      </div>
      <Button variant={variant} size="sm" disabled={disabled} onClick={onClick}>{btnLabel}</Button>
    </Card>
  )
}

function InfoIcon() { return <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg> }
