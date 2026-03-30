// src/pages/CalificacionesEstudiante.jsx
import { useState, useEffect } from 'react'
import AppShell   from '../components/AppShell.jsx'
import { Card, Badge, PageSpinner, EmptyState, SectionTitle } from '../components/ui.jsx'
import { navForRole } from '../lib/navItems.js'
import { api }        from '../lib/api.js'

export default function CalificacionesEstudiante() {
  const navItems = navForRole('estudiante')
  const [grades,  setGrades]  = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/grades/student/mine').then(setGrades).catch(() => {}).finally(() => setLoading(false))
  }, [])

  return (
    <AppShell navItems={navItems}>
      <h2 style={{ fontFamily:'var(--font-display)', fontSize:'1.8rem', marginBottom:6 }}>Calificaciones</h2>
      <p style={{ color:'var(--stone-400)', fontSize:14, marginBottom:28 }}>Tus notas publicadas por el departamento de Registro</p>

      {loading ? <PageSpinner /> : grades.length === 0 ? (
        <EmptyState icon="📊" title="Sin calificaciones" desc="No hay notas publicadas aún. Consulta más adelante." />
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          {grades.map(g => {
            const final  = g.finalGrade
            const pass   = (final ?? 0) >= 70
            return (
              <Card key={g.id}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20 }}>
                  <div>
                    <SectionTitle style={{ marginBottom:2 }}>{g.section.course.name}</SectionTitle>
                    <div style={{ fontSize:13, color:'var(--stone-400)' }}>
                      {g.section.course.code} · Prof. {g.section.professor?.firstName} {g.section.professor?.lastName} · {g.section.period.name}
                    </div>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ fontSize:32, fontWeight:700, fontFamily:'var(--font-display)', color: pass ? 'var(--green-700)' : 'var(--error)' }}>
                      {final?.toFixed(2) ?? '—'}
                    </div>
                    <Badge color={pass ? 'green' : 'red'}>{pass ? 'Aprobado' : 'Reprobado'}</Badge>
                  </div>
                </div>

                {/* Breakdown */}
                <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
                  {[
                    { label:'Parcial 1', value: g.parcial1, weight:'25%' },
                    { label:'Parcial 2', value: g.parcial2, weight:'25%' },
                    { label:'Tareas',   value: g.tareas,   weight:'20%' },
                    { label:'Examen',   value: g.examen,   weight:'30%' },
                  ].map(({ label, value, weight }) => (
                    <div key={label} style={{ background:'var(--stone-50)', borderRadius:'var(--radius-md)', padding:'12px', textAlign:'center', border:'1px solid var(--stone-200)' }}>
                      <div style={{ fontSize:11, color:'var(--stone-400)', marginBottom:4 }}>{label} <span style={{ color:'var(--stone-300)' }}>({weight})</span></div>
                      <div style={{ fontSize:20, fontWeight:700, color:'var(--stone-900)' }}>{value?.toFixed(1) ?? '—'}</div>
                    </div>
                  ))}
                </div>

                {/* Formula */}
                <div style={{ marginTop:14, padding:'10px 14px', background:'var(--stone-50)', borderRadius:'var(--radius-md)', fontSize:12.5, color:'var(--stone-500)', fontFamily:'var(--font-mono)' }}>
                  Nota final = {g.parcial1?.toFixed(1) ?? '?'} × 0.25 + {g.parcial2?.toFixed(1) ?? '?'} × 0.25 + {g.tareas?.toFixed(1) ?? '?'} × 0.20 + {g.examen?.toFixed(1) ?? '?'} × 0.30 = <strong style={{ color: pass ? 'var(--green-700)' : 'var(--error)' }}>{final?.toFixed(2) ?? '—'}</strong>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </AppShell>
  )
}
