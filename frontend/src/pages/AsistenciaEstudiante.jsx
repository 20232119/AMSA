// src/pages/AsistenciaEstudiante.jsx
import { useState, useEffect } from 'react'
import AppShell   from '../components/AppShell.jsx'
import { Card, Button, Badge, PageSpinner, EmptyState } from '../components/ui.jsx'
import { navForRole } from '../lib/navItems.js'
import { api }        from '../lib/api.js'

export default function AsistenciaEstudiante() {
  const navItems = navForRole('estudiante')
  const [open,    setOpen]    = useState([])
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [marking, setMarking] = useState(null)
  const [msg,     setMsg]     = useState(null)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    await Promise.all([
      api.get('/attendance/open').then(setOpen).catch(() => {}),
      api.get('/attendance/history').then(setHistory).catch(() => {}),
    ])
    setLoading(false)
  }

  async function markAttendance(sessionId) {
    setMarking(sessionId); setMsg(null)
    try {
      await api.post('/attendance/mark', { sessionId })
      setMsg({ type:'success', text:'¡Asistencia registrada exitosamente!' })
      await loadAll()
    } catch (e) {
      setMsg({ type:'error', text: e.message })
    } finally { setMarking(null) }
  }

  return (
    <AppShell navItems={navItems}>
      <h2 style={{ fontFamily:'var(--font-display)', fontSize:'1.8rem', marginBottom:6 }}>Mi asistencia</h2>
      <p style={{ color:'var(--stone-400)', fontSize:14, marginBottom:28 }}>Registra tu presencia y consulta tu historial</p>

      {msg && (
        <div style={{ padding:'10px 14px', borderRadius:'var(--radius-md)', fontSize:13.5, marginBottom:20,
          background: msg.type === 'success' ? 'var(--success-bg)' : 'var(--error-bg)',
          color:      msg.type === 'success' ? 'var(--success)'    : 'var(--error)',
          border:`1px solid ${msg.type === 'success' ? '#A9DFBF' : '#F1948A'}`,
        }}>
          {msg.text}
        </div>
      )}

      {loading ? <PageSpinner /> : (
        <>
          {/* Open sessions */}
          <h3 style={{ fontSize:15, fontWeight:700, color:'var(--stone-700)', marginBottom:12 }}>Sesiones abiertas ahora</h3>
          {open.length === 0 ? (
            <Card style={{ marginBottom:28 }}>
              <EmptyState icon="✅" title="Sin sesiones activas" desc="No hay clases en curso en este momento." />
            </Card>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:28 }}>
              {open.map(sess => (
                <Card key={sess.id} style={{ display:'flex', alignItems:'center', gap:16, flexWrap:'wrap' }}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:700, fontSize:15 }}>{sess.section.course.name}</div>
                    <div style={{ fontSize:13, color:'var(--stone-400)', marginTop:3 }}>
                      Prof. {sess.section.professor?.firstName} {sess.section.professor?.lastName}
                      {sess.topic && <> · {sess.topic}</>}
                    </div>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <div style={{ width:8, height:8, borderRadius:'50%', background:'var(--error)', animation:'pulse 1.5s infinite' }} />
                    <span style={{ fontSize:13, fontWeight:600, color:'var(--error)' }}>En curso</span>
                  </div>
                  <Button variant="primary" onClick={() => markAttendance(sess.id)} disabled={marking === sess.id}>
                    {marking === sess.id ? 'Registrando…' : '👆 Registrar asistencia'}
                  </Button>
                </Card>
              ))}
            </div>
          )}

          {/* History */}
          <h3 style={{ fontSize:15, fontWeight:700, color:'var(--stone-700)', marginBottom:12 }}>Historial por materia</h3>
          {history.length === 0 ? (
            <EmptyState icon="📋" title="Sin historial" desc="Aún no tienes registros de asistencia." />
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              {history.map(h => (
                <Card key={h.sectionId}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:14 }}>
                    <div>
                      <div style={{ fontWeight:700, fontSize:15 }}>{h.courseName}</div>
                      <div style={{ fontSize:12.5, color:'var(--stone-400)', marginTop:2 }}>{h.courseCode}</div>
                    </div>
                    <div style={{ textAlign:'right' }}>
                      <div style={{ fontSize:22, fontWeight:700, color: h.percentage >= 75 ? 'var(--green-700)' : 'var(--error)' }}>{h.percentage}%</div>
                      <div style={{ fontSize:12, color:'var(--stone-400)' }}>{h.present}/{h.totalSessions} sesiones</div>
                    </div>
                  </div>
                  {/* Progress bar */}
                  <div style={{ height:6, background:'var(--stone-100)', borderRadius:99 }}>
                    <div style={{ height:6, width:`${h.percentage}%`, borderRadius:99, background: h.percentage >= 75 ? 'var(--green-700)' : 'var(--error)', transition:'width .4s' }} />
                  </div>
                  {h.percentage < 75 && (
                    <div style={{ marginTop:8, fontSize:12, color:'var(--error)', fontWeight:500 }}>
                      ⚠ Por debajo del mínimo requerido (75%)
                    </div>
                  )}
                  {/* Session records */}
                  <div style={{ marginTop:14, display:'flex', flexWrap:'wrap', gap:6 }}>
                    {h.records.slice(-10).map(r => (
                      <div key={r.id} style={{
                        padding:'3px 10px', borderRadius:99, fontSize:11.5, fontWeight:600,
                        background: r.status === 'present' ? 'var(--success-bg)' : 'var(--error-bg)',
                        color: r.status === 'present' ? 'var(--success)' : 'var(--error)',
                      }}>
                        {new Date(r.date).toLocaleDateString('es-DO', { month:'short', day:'numeric' })}
                      </div>
                    ))}
                    {h.records.length > 10 && <span style={{ fontSize:12, color:'var(--stone-400)', alignSelf:'center' }}>+{h.records.length - 10} más</span>}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </AppShell>
  )
}
