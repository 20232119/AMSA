// src/pages/CalificacionesRegistro.jsx
import { useState, useEffect } from 'react'
import Swal from 'sweetalert2'
import AppShell   from '../components/AppShell.jsx'
import { Card, Button, Badge, PageSpinner, EmptyState, SectionTitle } from '../components/ui.jsx'
import { navForRole } from '../lib/navItems.js'
import { api }        from '../lib/api.js'

const STATUS_COLORS = { borrador:'stone', enviado:'amber', validado:'blue', publicado:'green', rechazado:'red', retirado:'stone' }
const STATUS_LABELS = { borrador:'Borrador', enviado:'Enviado', validado:'Validado', publicado:'Publicado', rechazado:'Rechazado', retirado:'Retirado' }

const Toast = Swal.mixin({
  toast: true,
  position: 'top-end',
  showConfirmButton: false,
  timer: 2800,
  timerProgressBar: true,
})

export default function CalificacionesRegistro() {
  const navItems  = navForRole('registro')
  const [sections,    setSections]    = useState([])
  const [activeId,    setActiveId]    = useState('')
  const [rows,        setRows]        = useState([])
  const [section,     setSection]     = useState(null)
  const [loading,     setLoading]     = useState(true)
  const [allowManual, setAllowManual] = useState(false)

  useEffect(() => {
    api.get('/grades/registro/pendientes').then(data => {
      setSections(data)
      if (data.length) setActiveId(data[0].id)
    }).finally(() => setLoading(false))
  }, [])

  useEffect(() => { if (activeId) loadGrades() }, [activeId])

  async function loadGrades() {
    setLoading(true)
    try {
      const [gradeData, sectionData] = await Promise.all([
        api.get(`/grades/section/${activeId}`),
        api.get(`/sections/${activeId}`),
      ])
      setRows(gradeData)
      setSection(sectionData)
      setAllowManual(sectionData.allowManualPresent ?? false)
    } catch (e) {
      Swal.fire({
        icon: 'error',
        title: 'Error cargando datos',
        text: e.message,
        confirmButtonColor: '#1A5276',
      })
    } finally {
      setLoading(false)
    }
  }

  async function validate(gradeId) {
    await api.patch(`/grades/${gradeId}/validate`, {})
    Toast.fire({ icon: 'success', title: 'Nota validada.' })
    await loadGrades()
  }

  async function reject(gradeId) {
    await api.patch(`/grades/${gradeId}/reject`, {})
    Toast.fire({ icon: 'success', title: 'Nota devuelta al profesor.' })
    await loadGrades()
  }

  async function rejectAll() {
    const result = await Swal.fire({
      icon: 'warning',
      title: '¿Devolver todas las notas?',
      text: 'Se devolverán todas las notas enviadas al profesor para corrección.',
      showCancelButton: true,
      confirmButtonText: 'Sí, devolver todo',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#1A5276',
      cancelButtonColor: '#7f8c8d',
      reverseButtons: true,
    })
    if (!result.isConfirmed) return
    await api.post(`/grades/section/${activeId}/reject-all`, {})
    Toast.fire({ icon: 'success', title: 'Todas las notas devueltas al profesor.' })
    await loadGrades()
  }

  async function publishAll() {
    const result = await Swal.fire({
      icon: 'question',
      title: '¿Publicar notas validadas?',
      text: 'Las notas validadas serán publicadas y visibles para los estudiantes.',
      showCancelButton: true,
      confirmButtonText: 'Sí, publicar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#1A5276',
      cancelButtonColor: '#7f8c8d',
      reverseButtons: true,
    })
    if (!result.isConfirmed) return
    await api.post(`/grades/section/${activeId}/publish`, {})
    await Swal.fire({
      icon: 'success',
      title: '¡Notas publicadas!',
      text: 'Los estudiantes ya pueden ver sus calificaciones.',
      confirmButtonColor: '#1A5276',
    })
    await loadGrades()
  }

  async function toggleEnrollment(enrollmentId, currentStatus) {
    const newStatus = currentStatus === 'activo' ? 'retirado' : 'activo'

    if (newStatus === 'retirado') {
      const result = await Swal.fire({
        icon: 'warning',
        title: '¿Marcar como retirado?',
        text: 'El estudiante quedará marcado como retirado de esta sección.',
        showCancelButton: true,
        confirmButtonText: 'Sí, retirar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#1A5276',
        cancelButtonColor: '#7f8c8d',
        reverseButtons: true,
      })
      if (!result.isConfirmed) return
    }

    await api.patch(`/grades/enrollment/${enrollmentId}/status`, { status: newStatus })
    Toast.fire({
      icon: 'success',
      title: newStatus === 'retirado' ? 'Estudiante marcado como retirado.' : 'Estudiante reactivado.',
    })
    await loadGrades()
  }

  async function toggleManualPresent() {
    const res = await api.patch(`/grades/section/${activeId}/allow-manual`, { allow: !allowManual })
    setAllowManual(res.allowManualPresent)
    Toast.fire({
      icon: 'success',
      title: res.allowManualPresent
        ? 'Permiso de Presente manual activado.'
        : 'Permiso de Presente manual desactivado.',
    })
  }

  const activeSec = sections.find(s => s.id === activeId)
  const sent      = rows.filter(r => r.grade?.status === 'enviado')
  const canPublish = rows.some(r => r.grade?.status === 'validado')
  const hasSent    = rows.some(r => ['enviado','validado'].includes(r.grade?.status))

  return (
    <AppShell navItems={navItems}>
      <h2 style={{ fontFamily:'var(--font-display)', fontSize:'1.8rem', marginBottom:6 }}>Calificaciones</h2>
      <p style={{ color:'var(--stone-400)', fontSize:14, marginBottom:28 }}>Valida, rechaza y publica las notas de cada sección</p>

      {/* Section pills */}
      {!loading && sections.length > 0 && (
        <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:20 }}>
          {sections.map(s => {
            const pending = s.grades?.filter(g => g.status === 'enviado').length ?? 0
            return (
              <button key={s.id} onClick={() => setActiveId(s.id)} style={{
                padding:'6px 14px', borderRadius:99, fontSize:13, fontWeight:600, cursor:'pointer',
                border: activeId===s.id ? '1.5px solid var(--green-700)' : '1.5px solid var(--stone-200)',
                background: activeId===s.id ? 'var(--green-700)' : '#fff',
                color: activeId===s.id ? '#fff' : 'var(--stone-700)',
              }}>
                {s.course?.name} — 0{s.sectionNo}
                {pending > 0 && <span style={{ marginLeft:8, background:'var(--error)', color:'#fff', padding:'1px 7px', borderRadius:99, fontSize:11 }}>{pending}</span>}
              </button>
            )
          })}
        </div>
      )}

      {loading ? <PageSpinner /> : rows.length === 0 ? (
        <EmptyState icon="📭" title="Sin datos" desc="Esta sección no tiene notas aún." />
      ) : (
        <Card>
          {/* Header */}
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20, flexWrap:'wrap', gap:12 }}>
            <div>
              <SectionTitle style={{ marginBottom:2 }}>
                {activeSec?.course?.name} — Sección 0{activeSec?.sectionNo}
              </SectionTitle>
              <div style={{ fontSize:13, color:'var(--stone-400)' }}>
                {sent.length} nota{sent.length!==1?'s':''} pendiente{sent.length!==1?'s':''} de validar
              </div>
            </div>

            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
              <button onClick={toggleManualPresent} style={{
                display:'flex', alignItems:'center', gap:8, padding:'7px 14px',
                borderRadius:'var(--radius-md)', border:'1.5px solid var(--stone-200)',
                background: allowManual ? '#FEF9E7' : '#fff',
                fontSize:13, fontWeight:600,
                color: allowManual ? 'var(--warning)' : 'var(--stone-500)', cursor:'pointer',
              }}>
                <div style={{ width:16, height:16, borderRadius:'50%', background: allowManual ? 'var(--warning)' : 'var(--stone-300)' }} />
                {allowManual ? '⚡ Presente manual: ON' : 'Presente manual: OFF'}
              </button>

              {hasSent && (
                <Button variant="secondary" size="sm" onClick={rejectAll}>
                  ↩ Devolver todo
                </Button>
              )}
              {canPublish && (
                <Button variant="primary" size="sm" onClick={publishAll}>
                  Publicar validadas →
                </Button>
              )}
            </div>
          </div>

          {allowManual && (
            <div style={{ padding:'10px 14px', background:'#FEF9E7', borderRadius:'var(--radius-md)', border:'1px solid #F9CA74', fontSize:13, color:'#7D6608', marginBottom:16 }}>
              ⚡ El profesor tiene permiso para marcar Presente manualmente en esta sección. Desactívalo cuando el sistema biométrico esté funcionando.
            </div>
          )}

          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13.5 }}>
              <thead>
                <tr style={{ background:'var(--stone-100)' }}>
                  {['Matrícula','Nombre','Estado matrícula','P1','P2','Tar','Exam','Asist.','Final','Estado nota','Acciones'].map(h => (
                    <th key={h} style={{ padding:'10px 12px', textAlign: h==='Nombre'||h==='Acciones' ? 'left' : 'center', fontWeight:600, color:'var(--stone-500)', fontSize:12, whiteSpace:'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => {
                  const g      = row.grade
                  const bg     = i % 2 === 0 ? '#fff' : 'var(--stone-50)'
                  const pass   = (g?.finalGrade ?? 0) >= 70
                  const withdrawn = row.enrollmentStatus === 'retirado'
                  return (
                    <tr key={row.student.id} style={{ background: withdrawn ? '#FFF8F0' : bg, opacity: withdrawn ? .85 : 1 }}>
                      <td style={td}>{row.student.institutionalId}</td>
                      <td style={{ ...td, textAlign:'left' }}>
                        {row.student.firstName} {row.student.lastName}
                        {withdrawn && <span style={{ marginLeft:6, fontSize:11, background:'#FADBD8', color:'var(--error)', padding:'1px 6px', borderRadius:99 }}>Retirado</span>}
                      </td>

                      <td style={td}>
                        <button onClick={() => toggleEnrollment(row.enrollmentId, row.enrollmentStatus)} style={{
                          padding:'3px 10px', borderRadius:99, fontSize:12, fontWeight:600, cursor:'pointer',
                          border: withdrawn ? '1px solid var(--error)' : '1px solid var(--green-700)',
                          background: withdrawn ? 'var(--error-bg)' : 'var(--success-bg)',
                          color: withdrawn ? 'var(--error)' : 'var(--green-700)',
                        }}>
                          {withdrawn ? '✗ Retirado' : '✓ Activo'}
                        </button>
                      </td>

                      {['parcial1','parcial2','tareas','examen'].map(f => (
                        <td key={f} style={td}>{g?.[f]?.toFixed(1) ?? '—'}</td>
                      ))}
                      <td style={td}>{g?.asistencia?.toFixed(0) ?? '—'}<span style={{ fontSize:10, color:'var(--stone-400)' }}>/8</span></td>
                      <td style={td}>
                        <span style={{ fontWeight:700, color: g?.finalGrade!=null ? (pass ? 'var(--green-700)' : 'var(--error)') : 'var(--stone-300)' }}>
                          {g?.finalGrade?.toFixed(2) ?? '—'}
                        </span>
                      </td>
                      <td style={td}>
                        <Badge color={STATUS_COLORS[g?.status ?? 'borrador']}>
                          {STATUS_LABELS[g?.status ?? 'borrador']}
                        </Badge>
                      </td>
                      <td style={{ ...td, textAlign:'left' }}>
                        <div style={{ display:'flex', gap:6 }}>
                          {g?.status === 'enviado' && (
                            <>
                              <Button variant="secondary" size="sm" onClick={() => validate(g.id)}>✓ Validar</Button>
                              <Button variant="secondary" size="sm" onClick={() => reject(g.id)}>↩ Devolver</Button>
                            </>
                          )}
                          {g?.status === 'rechazado' && (
                            <span style={{ fontSize:12, color:'var(--error)', fontWeight:500 }}>Devuelta al prof.</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </AppShell>
  )
}

const td = { padding:'9px 12px', textAlign:'center', borderBottom:'1px solid var(--stone-100)' }
