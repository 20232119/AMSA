// src/pages/DashboardEstudiante.jsx
import { useState, useEffect } from 'react'
import { useNavigate }         from 'react-router-dom'
import { useAuth }             from '../context/AuthContext.jsx'
import AppShell                from '../components/AppShell.jsx'
import { Card, StatCard, SectionTitle, Button, PageSpinner } from '../components/ui.jsx'
import { navForRole }          from '../lib/navItems.js'
import { api }                 from '../lib/api.js'

export default function DashboardEstudiante() {
  const { user }  = useAuth()
  const navigate  = useNavigate()
  const navItems  = navForRole('estudiante')
  const [openSessions, setOpen]    = useState([])
  const [grades,       setGrades]  = useState([])
  const [attendance,   setAtt]     = useState([])
  const [loading,      setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.get('/attendance/open').then(setOpen).catch(() => {}),
      api.get('/grades/student/mine').then(setGrades).catch(() => {}),
      api.get('/attendance/history').then(setAtt).catch(() => {}),
    ]).finally(() => setLoading(false))
  }, [])

  const avgAttendance = attendance.length
    ? Math.round(attendance.reduce((s, a) => s + a.percentage, 0) / attendance.length)
    : 0

  return (
    <AppShell navItems={navItems}>
      <div style={{ marginBottom:28 }}>
        <h2 style={{ fontFamily:'var(--font-display)', fontSize:'1.8rem', color:'var(--stone-900)', margin:0 }}>
          Hola, {user?.firstName} 👋
        </h2>
        <p style={{ color:'var(--stone-400)', fontSize:14, marginTop:6 }}>{user?.career ?? 'Universidad Agroforestal Fernando Arturo de Meriño'}</p>
      </div>

      {loading ? <PageSpinner /> : (
        <>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(160px,1fr))', gap:16, marginBottom:36 }}>
            <StatCard value={openSessions.length} label="Sesiones abiertas" color={openSessions.length > 0 ? 'var(--error)' : 'var(--stone-400)'} note="Registra tu asistencia" />
            <StatCard value={`${avgAttendance}%`} label="Asistencia promedio" color={avgAttendance >= 75 ? 'var(--green-700)' : 'var(--error)'} />
            <StatCard value={grades.length}        label="Notas publicadas"   color="var(--gold-500)" />
            <StatCard value={attendance.length}    label="Materias cursando"  color="var(--blue-700)" />
          </div>

          {/* Open sessions alert */}
          {openSessions.length > 0 && (
            <div style={{ marginBottom:24, padding:'14px 18px', background:'var(--error-bg)', border:'1.5px solid #F1948A', borderRadius:'var(--radius-lg)', display:'flex', alignItems:'center', justifyContent:'space-between', gap:16 }}>
              <div>
                <div style={{ fontWeight:700, color:'var(--error)', marginBottom:3 }}>🔴 {openSessions.length} sesión{openSessions.length > 1 ? 'es' : ''} abierta{openSessions.length > 1 ? 's' : ''}</div>
                <div style={{ fontSize:13, color:'var(--error)' }}>Tienes clase en curso — registra tu asistencia ahora</div>
              </div>
              <Button variant="danger" size="sm" onClick={() => navigate('/estudiante/asistencia')}>Registrar →</Button>
            </div>
          )}

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
            {/* Attendance summary */}
            <Card>
              <SectionTitle>Mi asistencia</SectionTitle>
              {attendance.length === 0 ? (
                <p style={{ color:'var(--stone-400)', fontSize:13.5 }}>Sin registros aún.</p>
              ) : attendance.slice(0,4).map(a => (
                <div key={a.sectionId} style={{ display:'flex', alignItems:'center', gap:12, padding:'8px 0', borderBottom:'1px solid var(--stone-100)' }}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13.5, fontWeight:600 }}>{a.courseName}</div>
                    <div style={{ fontSize:12, color:'var(--stone-400)' }}>{a.present}/{a.totalSessions} sesiones</div>
                  </div>
                  <div style={{
                    fontWeight:700, fontSize:14,
                    color: a.percentage >= 75 ? 'var(--green-700)' : 'var(--error)',
                  }}>{a.percentage}%</div>
                </div>
              ))}
              <Button variant="ghost" size="sm" onClick={() => navigate('/estudiante/asistencia')} style={{ marginTop:12 }}>Ver todo →</Button>
            </Card>

            {/* Grades summary */}
            <Card>
              <SectionTitle>Mis calificaciones</SectionTitle>
              {grades.length === 0 ? (
                <p style={{ color:'var(--stone-400)', fontSize:13.5 }}>No hay notas publicadas aún.</p>
              ) : grades.slice(0,4).map(g => (
                <div key={g.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'8px 0', borderBottom:'1px solid var(--stone-100)' }}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13.5, fontWeight:600 }}>{g.section.course.name}</div>
                    <div style={{ fontSize:12, color:'var(--stone-400)' }}>{g.section.period.name}</div>
                  </div>
                  <div style={{
                    fontWeight:700, fontSize:16,
                    color: (g.finalGrade ?? 0) >= 70 ? 'var(--green-700)' : 'var(--error)',
                  }}>{g.finalGrade?.toFixed(1) ?? '—'}</div>
                </div>
              ))}
              <Button variant="ghost" size="sm" onClick={() => navigate('/estudiante/calificaciones')} style={{ marginTop:12 }}>Ver todo →</Button>
            </Card>
          </div>
        </>
      )}
    </AppShell>
  )
}
