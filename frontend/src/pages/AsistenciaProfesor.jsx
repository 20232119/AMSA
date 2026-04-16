import { useState, useEffect } from 'react'
import Swal from 'sweetalert2'
import AppShell from '../components/AppShell.jsx'
import { Card, PageSpinner, EmptyState, Badge } from '../components/ui.jsx'
import { navForRole } from '../lib/navItems.js'
import { api } from '../lib/api.js'

const STATUS_CFG = {
  present: { label: 'Presente', color: '#1E8449', bg: '#D5F5E3', points: 2 },
  excuse:  { label: 'Excusa',   color: '#1A5276', bg: '#D6EAF8', points: 2 },
  late:    { label: 'Tardanza', color: '#B7770D', bg: '#FEF9E7', points: 1 },
  absent:  { label: 'Ausente',  color: '#922B21', bg: '#FADBD8', points: 0 },
}

const Toast = Swal.mixin({
  toast: true,
  position: 'top-end',
  showConfirmButton: false,
  timer: 2500,
  timerProgressBar: true,
})

export default function AsistenciaProfesor() {
  const navItems = navForRole('profesor')
  const [sections,     setSections]     = useState([])
  const [activeId,     setActiveId]     = useState('')
  const [board,        setBoard]        = useState(null)
  const [loading,      setLoading]      = useState(true)
  const [loadingBoard, setLoadingBoard] = useState(false)
  const [saving,       setSaving]       = useState(null)
  const [savedKey,     setSavedKey]     = useState(null)

  useEffect(() => {
    api.get('/sections')
      .then(data => {
        setSections(data)
        if (data.length) setActiveId(data[0].id)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (activeId) loadBoard(activeId)
  }, [activeId])

  async function loadBoard(id) {
    setLoadingBoard(true)
    try {
      setBoard(await api.get(`/attendance/sections/${id}/board`))
    } catch (e) {
      setBoard(null)
      Swal.fire({
        icon: 'error',
        title: 'Error cargando asistencia',
        text: e.message,
        confirmButtonColor: '#1A5276',
      })
    } finally {
      setLoadingBoard(false)
    }
  }

  async function changeStatus(enrollmentId, sessionId, status) {
    const key = `${enrollmentId}-${sessionId}`
    setSaving(key)

    try {
      await api.patch('/attendance/record', { enrollmentId, sessionId, status })

      setBoard(prev => ({
        ...prev,
        students: prev.students.map(stu => {
          if (stu.enrollmentId !== enrollmentId) return stu
          const sessions = stu.sessions.map(s =>
            s.sessionId === sessionId ? { ...s, status, method: 'manual' } : s
          )
          const points = sessions.reduce((sum, s) => sum + (STATUS_CFG[s.status]?.points ?? 0), 0)
          return { ...stu, sessions, totalPoints: Math.min(8, points) }
        }),
      }))

      setSavedKey(key)
      setTimeout(() => setSavedKey(null), 2000)
    } catch (e) {
      Toast.fire({
        icon: 'error',
        title: e.message,
      })
    } finally {
      setSaving(null)
    }
  }

  return (
    <AppShell navItems={navItems}>
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', marginBottom: 6 }}>
        Asistencia
      </h2>

      <p style={{ color: 'var(--stone-400)', fontSize: 14, marginBottom: 28 }}>
        Gestiona la asistencia de las sesiones configuradas por Registro
      </p>

      {loading ? (
        <PageSpinner />
      ) : sections.length === 0 ? (
        <EmptyState icon="📚" title="Sin secciones" desc="No tienes secciones asignadas." />
      ) : (
        <>
          <Card style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              {sections.length > 1 && (
                <div style={{ minWidth: 280 }}>
                  <label style={labelStyle}>Sección</label>
                  <select
                    value={activeId}
                    onChange={e => setActiveId(e.target.value)}
                    style={selectStyle}
                  >
                    {sections.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.course.code}-0{s.sectionNo} — {s.course.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div style={{ marginLeft: 'auto' }}>
                <Badge color="blue">Configuración a cargo de Registro</Badge>
              </div>
            </div>
          </Card>

          {loadingBoard ? (
            <PageSpinner />
          ) : !board ? null : (board.sessions?.length ?? 0) === 0 ? (
            <Card>
              <EmptyState
                icon="📅"
                title="Sección sin sesiones configuradas"
                desc="Registro debe definir las fechas antes de que puedas gestionar la asistencia."
              />
            </Card>
          ) : (
            <Card>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', fontWeight: 700 }}>
                    {board.courseName}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--stone-400)', marginTop: 3 }}>
                    Prof. {board.professor} · {board.period} · {board.students.length} estudiantes
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {Object.entries(STATUS_CFG).map(([k, cfg]) => (
                    <span key={k} style={{ padding: '3px 10px', borderRadius: 99, fontSize: 11.5, fontWeight: 600, background: cfg.bg, color: cfg.color }}>
                      {cfg.label} +{cfg.points}pts
                    </span>
                  ))}
                </div>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
                  <thead>
                    <tr style={{ background: 'var(--stone-100)' }}>
                      <th style={thStyle(false)}>Matrícula</th>
                      <th style={thStyle(true)}>Nombre</th>
                      {board.sessions.map(sess => (
                        <th key={sess.id} style={thStyle(false)}>
                          <div>Sesión {sess.sessionNo}</div>
                          <div style={{ fontSize: 11, fontWeight: 400, color: 'var(--stone-400)', marginTop: 2 }}>
                            {new Date(sess.date).toLocaleDateString('es-DO', { day: '2-digit', month: 'short', year: '2-digit' })}
                          </div>
                        </th>
                      ))}
                      <th style={thStyle(false)}>Pts.</th>
                    </tr>
                  </thead>

                  <tbody>
                    {board.students.map((stu, i) => (
                      <tr key={stu.studentId} style={{ background: i % 2 === 0 ? '#fff' : 'var(--stone-50)' }}>
                        <td style={tdStyle(false)}>{stu.institutionalId}</td>
                        <td style={tdStyle(true)}>{stu.name}</td>

                        {stu.sessions.map(sess => {
                          const key = `${stu.enrollmentId}-${sess.sessionId}`
                          const cfg = STATUS_CFG[sess.status] ?? STATUS_CFG.absent

                          return (
                            <td key={sess.sessionId} style={{ ...tdStyle(false), minWidth: 130 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <select
                                  value={sess.status}
                                  disabled={saving === key}
                                  onChange={e => changeStatus(stu.enrollmentId, sess.sessionId, e.target.value)}
                                  style={{
                                    flex: 1, padding: '5px 6px', borderRadius: 6,
                                    border: `1.5px solid ${cfg.color}`,
                                    background: cfg.bg, color: cfg.color,
                                    fontSize: 12, fontWeight: 600, cursor: 'pointer', outline: 'none',
                                    opacity: saving === key ? 0.5 : 1, transition: 'all .2s',
                                  }}
                                >
                                  {Object.entries(STATUS_CFG).map(([val, c]) => (
                                    <option key={val} value={val}>{c.label} (+{c.points})</option>
                                  ))}
                                </select>

                                {saving === key && (
                                  <div style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid var(--stone-200)', borderTopColor: 'var(--green-700)', animation: 'spinRing .7s linear infinite', flexShrink: 0 }} />
                                )}
                                {savedKey === key && saving !== key && (
                                  <span style={{ color: 'var(--green-700)', fontSize: 16, flexShrink: 0 }}>✓</span>
                                )}
                                {sess.method === 'biometric' && saving !== key && savedKey !== key && (
                                  <span title="Biométrico" style={{ fontSize: 14 }}>🔒</span>
                                )}
                              </div>
                            </td>
                          )
                        })}

                        <td style={{ ...tdStyle(false), fontWeight: 700, fontSize: 15 }}>
                          <span style={{ color: stu.totalPoints >= 6 ? 'var(--green-700)' : stu.totalPoints >= 4 ? 'var(--gold-500)' : 'var(--error)' }}>
                            {stu.totalPoints}
                          </span>
                          <span style={{ fontSize: 11, color: 'var(--stone-400)' }}>/8</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ marginTop: 14, padding: '10px 14px', background: 'var(--stone-50)', borderRadius: 'var(--radius-md)', fontSize: 12.5, color: 'var(--stone-500)', border: '1px solid var(--stone-200)' }}>
                Los cambios se guardan automáticamente al seleccionar. El ✓ verde confirma que se guardó. El 🔒 indica registro biométrico del estudiante.
              </div>
            </Card>
          )}
        </>
      )}
    </AppShell>
  )
}

const labelStyle = {
  display: 'block', fontSize: 11.5, fontWeight: 600,
  color: 'var(--stone-500)', letterSpacing: '.05em',
  textTransform: 'uppercase', marginBottom: 5,
}

const selectStyle = {
  width: '100%', padding: '8px 12px',
  borderRadius: 'var(--radius-md)',
  border: '1.5px solid var(--stone-200)',
  fontSize: 13.5, outline: 'none',
  background: '#fff', color: 'var(--stone-900)',
}

const thStyle = left => ({
  padding: '10px 12px',
  textAlign: left ? 'left' : 'center',
  fontWeight: 600, color: 'var(--stone-500)',
  fontSize: 12, whiteSpace: 'nowrap',
  borderBottom: '1px solid var(--stone-200)',
})

const tdStyle = left => ({
  padding: '10px 12px',
  textAlign: left ? 'left' : 'center',
  borderBottom: '1px solid var(--stone-100)',
})
