// src/pages/DashboardProfesor.jsx
import { useState, useEffect } from 'react'
import { useNavigate }         from 'react-router-dom'
import { useAuth }             from '../context/AuthContext.jsx'
import AppShell                from '../components/AppShell.jsx'
import { Card, StatCard, SectionTitle, Button, Badge, PageSpinner } from '../components/ui.jsx'
import { navForRole }          from '../lib/navItems.js'
import { api }                 from '../lib/api.js'

export default function DashboardProfesor() {
  const { user }  = useAuth()
  const navigate  = useNavigate()
  const navItems  = navForRole('profesor')
  const [sections, setSections] = useState([])
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    api.get('/sections').then(setSections).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const openSessions = sections.filter(s =>
    s.classSessions?.some(cs => cs.status === 'open')
  ).length

  return (
    <AppShell navItems={navItems}>
      <div style={{ marginBottom:28 }}>
        <h2 style={{ fontFamily:'var(--font-display)', fontSize:'1.8rem', color:'var(--stone-900)', margin:0 }}>
          Hola, {user?.firstName} 👋
        </h2>
        <p style={{ color:'var(--stone-400)', fontSize:14, marginTop:6 }}>Panel del docente</p>
      </div>

      {loading ? <PageSpinner /> : (
        <>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(160px,1fr))', gap:16, marginBottom:36 }}>
            <StatCard value={sections.length} label="Secciones asignadas" color="var(--green-700)" />
            <StatCard value={openSessions}    label="Sesiones abiertas"   color={openSessions > 0 ? 'var(--error)' : 'var(--stone-400)'} />
            <StatCard value={sections.reduce((s,sec) => s + (sec.enrollments?.length ?? 0), 0)} label="Estudiantes en total" color="var(--blue-700)" />
          </div>

          <SectionTitle>Mis secciones</SectionTitle>
          {sections.length === 0 ? (
            <Card><p style={{ color:'var(--stone-400)', fontSize:14 }}>No tienes secciones asignadas.</p></Card>
          ) : (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px,1fr))', gap:16 }}>
              {sections.map(sec => {
                const hasOpen = sec.classSessions?.some(cs => cs.status === 'open')
                return (
                  <Card key={sec.id}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:10 }}>
                      <span style={{ fontSize:11, fontFamily:'var(--font-mono)', background:'var(--stone-100)', padding:'2px 8px', borderRadius:6, fontWeight:700, color:'var(--stone-700)' }}>
                        {sec.course.code}-0{sec.sectionNo}
                      </span>
                      {hasOpen && <Badge color="red">Sesión abierta</Badge>}
                    </div>
                    <div style={{ fontWeight:700, fontSize:15, marginBottom:4 }}>{sec.course.name}</div>
                    <div style={{ fontSize:12.5, color:'var(--stone-400)', marginBottom:14 }}>
                      {sec.period.name} · {sec.enrollments?.length ?? 0} estudiantes
                    </div>
                    <div style={{ display:'flex', gap:8 }}>
                      <Button variant="secondary" size="sm" onClick={() => navigate('/profesor/asistencia')}>Asistencia</Button>
                      <Button variant="secondary" size="sm" onClick={() => navigate('/profesor/calificaciones')}>Notas</Button>
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </>
      )}
    </AppShell>
  )
}
