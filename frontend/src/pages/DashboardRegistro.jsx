import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import AppShell from '../components/AppShell.jsx'
import { Card, Badge, Button, StatCard, SectionTitle } from '../components/ui.jsx'
import { BookIcon, ShieldIcon, ChartIcon as Chart } from '../components/ui.jsx'
import { navForRole } from '../lib/navItems.js'

export default function DashboardRegistro() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const navItems = navForRole('registro')

  return (
    <AppShell navItems={navItems}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 28,
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h2
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '1.8rem',
              color: 'var(--stone-900)',
              margin: 0,
            }}
          >
            Panel de Registro
          </h2>

          <p style={{ color: 'var(--stone-400)', fontSize: 14, marginTop: 6 }}>
            {user?.firstName} · Dpto. Registro y Admisiones
          </p>
        </div>

        <Badge color="stone">Administrador</Badge>
      </div>

      {/* Stats */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(180px,1fr))',
          gap: 16,
          marginBottom: 36,
        }}
      >
        <StatCard value="1,204" label="Estudiantes activos" color="var(--green-700)" />
        <StatCard value="48" label="Secciones abiertas" color="var(--gold-500)" />
        <StatCard value="12" label="Notas pendientes validar" color="var(--error)" />
        <StatCard value="0" label="Reportes exportados" color="var(--stone-400)" note="Este período" />
      </div>

      <SectionTitle>Acciones rápidas</SectionTitle>

      {/* Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(240px,1fr))',
          gap: 16,
        }}
      >
        {/* 🔥 PRINCIPAL */}
        <ActionCard
          icon={<CalendarIcon size={28} />}
          title="Gestión académica"
          desc="Configura secciones, fechas y sesiones. Una vez inicializadas, la asistencia queda bloqueada y solo puede modificarse con justificación."
          badge={<Badge color="blue">Responsabilidad de Registro</Badge>}
          btnLabel="Entrar →"
          variant="primary"
          onClick={() => navigate('/registro/configuracion')}
          highlight
        />

        {/* CALIFICACIONES */}
        <ActionCard
          icon={<BookIcon size={28} />}
          title="Validar calificaciones"
          desc="Revisa y aprueba las notas enviadas por los profesores antes de publicarlas."
          badge={<Badge color="red">12 Pendientes</Badge>}
          btnLabel="Ir →"
          variant="secondary"
          onClick={() => navigate('/registro/calificaciones')}
        />

        {/* REPORTES */}
        <ActionCard
          icon={<Chart size={28} />}
          title="Reportes académicos"
          desc="Consulta métricas de asistencia y rendimiento. Exporta a Excel o PDF."
          badge={<Badge color="green">Activo</Badge>}
          btnLabel="Ver →"
          variant="secondary"
          onClick={() => navigate('/registro/reportes')}
        />

        {/* USUARIOS */}
        <ActionCard
          icon={<ShieldIcon size={28} />}
          title="Gestión de usuarios"
          desc="Administra estudiantes, profesores y personal del sistema."
          badge={<Badge color="stone">Próximamente</Badge>}
          btnLabel="Próximamente"
          disabled
        />
      </div>

      {/* Info */}
      <div
        style={{
          marginTop: 32,
          padding: '12px 16px',
          borderRadius: 'var(--radius-md)',
          background: 'var(--green-50)',
          color: 'var(--green-800)',
          fontSize: 13,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          border: '1px solid var(--green-200)',
        }}
      >
        <InfoIcon />
        Registro inicializa y bloquea la asistencia. Cualquier modificación posterior requiere justificación auditada.
      </div>
    </AppShell>
  )
}

/* ---------- COMPONENTES ---------- */

function ActionCard({
  icon,
  title,
  desc,
  badge,
  btnLabel,
  disabled,
  onClick,
  variant = 'secondary',
  highlight,
}) {
  return (
    <Card
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        ...(highlight
          ? {
              border: '2px solid var(--green-700)',
              boxShadow: '0 0 0 4px rgba(30,132,73,.07)',
            }
          : {}),
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ color: 'var(--green-700)' }}>{icon}</div>
        {badge}
      </div>

      <div>
        <div style={{ fontWeight: 600, color: 'var(--stone-900)', marginBottom: 6 }}>
          {title}
        </div>
        <div style={{ fontSize: 13.5, color: 'var(--stone-400)', lineHeight: 1.6 }}>
          {desc}
        </div>
      </div>

      <Button variant={variant} size="sm" disabled={disabled} onClick={onClick}>
        {btnLabel}
      </Button>
    </Card>
  )
}

function InfoIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  )
}

function CalendarIcon({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  )
}