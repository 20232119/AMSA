// src/pages/CalificacionesProfesor.jsx
import { useState, useEffect } from 'react'
import AppShell from '../components/AppShell.jsx'
import { Card, Button, Badge, PageSpinner, EmptyState, SectionTitle } from '../components/ui.jsx'
import { navForRole } from '../lib/navItems.js'
import { api } from '../lib/api.js'

const STATUS_COLORS = { borrador:'stone', enviado:'amber', validado:'blue', publicado:'green', rechazado:'red', retirado:'stone' }
const STATUS_LABELS = { borrador:'Borrador', enviado:'Enviado', validado:'Validado', publicado:'Publicado', rechazado:'Devuelto', retirado:'Retirado' }

const FIELD_LIMITS = { parcial1: 25, parcial2: 25, tareas: 20, examen: 20 }
const EMPTY_EDIT   = { parcial1: '', parcial2: '', tareas: '', examen: '' }

function toNum(v) {
  if (v === '' || v == null) return null
  const n = parseFloat(v)
  return isNaN(n) ? null : n
}

function calcFinal(ed, asistencia = 0) {
  const p1 = parseFloat(ed.parcial1)
  const p2 = parseFloat(ed.parcial2)
  const ta = parseFloat(ed.tareas)
  const ex = parseFloat(ed.examen)
  if ([p1, p2, ta, ex].some(isNaN)) return null
  // Suma directa — cada campo ya viene limitado a su máximo
  return Math.min(100, p1 + p2 + ta + ex + Math.min(8, asistencia)).toFixed(2)
}

export default function CalificacionesProfesor() {
  const navItems = navForRole('profesor')
  const [sections,   setSections]   = useState([])
  const [activeId,   setActiveId]   = useState('')
  const [rows,       setRows]       = useState([])
  const [loading,    setLoading]    = useState(true)
  const [saving,     setSaving]     = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [msg,        setMsg]        = useState(null)
  const [edits,      setEdits]      = useState({})

  useEffect(() => {
    api.get('/sections').then(data => {
      setSections(data)
      if (data.length) setActiveId(data[0].id)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  useEffect(() => { if (activeId) loadGrades() }, [activeId])

  async function loadGrades() {
    setLoading(true)
    try {
      const data = await api.get(`/grades/section/${activeId}`)
      setRows(data)
      const init = {}
      data.forEach(r => {
        init[r.student.id] = {
          parcial1: r.grade?.parcial1 ?? '',
          parcial2: r.grade?.parcial2 ?? '',
          tareas:   r.grade?.tareas   ?? '',
          examen:   r.grade?.examen   ?? '',
        }
      })
      setEdits(init)
    } catch (e) {
      setMsg({ type:'error', text: e.message })
    } finally { setLoading(false) }
  }

  function setField(studentId, field, rawValue) {
    const max = FIELD_LIMITS[field]
    let value = rawValue
    const n = parseFloat(rawValue)
    if (!isNaN(n) && n > max) value = String(max)
    if (!isNaN(n) && n < 0)   value = '0'
    setEdits(prev => ({
      ...prev,
      [studentId]: { ...EMPTY_EDIT, ...(prev[studentId] ?? {}), [field]: value },
    }))
  }

  async function saveGrade(studentId) {
    const ed = edits[studentId]
    if (!ed) return
    setSaving(studentId)
    setMsg(null)
    try {
      await api.put(`/grades/section/${activeId}/student/${studentId}`, {
        parcial1: toNum(ed.parcial1),
        parcial2: toNum(ed.parcial2),
        tareas:   toNum(ed.tareas),
        examen:   toNum(ed.examen),
      })
      await loadGrades()
      setMsg({ type:'success', text:'Calificación guardada.' })
    } catch (e) {
      setMsg({ type:'error', text: e.message })
    } finally { setSaving(null) }
  }

  async function reopenGrades() {
    setSubmitting(true)
    setMsg(null)
    try {
      await api.post(`/grades/section/${activeId}/reopen`, {})
      setMsg({ type:'success', text:'Notas reabiertas. Puedes corregir y volver a enviar.' })
      await loadGrades()
    } catch (e) { setMsg({ type:'error', text: e.message }) }
    finally { setSubmitting(false) }
  }

  async function submitAll() {
    setSubmitting(true)
    setMsg(null)
    try {
      await api.post(`/grades/section/${activeId}/submit`, {})
      setMsg({ type:'success', text:'Notas enviadas a Registro para validación.' })
      await loadGrades()
    } catch (e) {
      setMsg({ type:'error', text: e.message })
    } finally { setSubmitting(false) }
  }

  const activeSection = sections.find(s => s.id === activeId)
  const allEntered = rows.length > 0 && rows
   .filter(r => r.enrollmentStatus !== 'retirado')  // ← solo activos
   .every(r => {
     const ed = edits[r.student.id]
     return ed && ed.parcial1 !== '' && ed.parcial2 !== '' && ed.tareas !== '' && ed.examen !== ''
  })
  const alreadySent  = rows.some(r => ['enviado','validado','publicado'].includes(r.grade?.status))
  const hasRejected  = rows.some(r => r.grade?.status === 'rechazado')

  return (
    <AppShell navItems={navItems}>
      <h2 style={{ fontFamily:'var(--font-display)', fontSize:'1.8rem', marginBottom:6 }}>Calificaciones</h2>
      <p style={{ color:'var(--stone-400)', fontSize:14, marginBottom:28 }}>Ingresa y envía las notas de tus secciones</p>

      {msg && (
        <div style={{ padding:'10px 14px', borderRadius:'var(--radius-md)', fontSize:13.5, marginBottom:20,
          background: msg.type==='success' ? 'var(--success-bg)' : 'var(--error-bg)',
          color:      msg.type==='success' ? 'var(--success)' : 'var(--error)',
          border:`1px solid ${msg.type==='success' ? '#A9DFBF' : '#F1948A'}`,
        }}>
          {msg.text}
          <button onClick={() => setMsg(null)} style={{ float:'right', background:'none', border:'none', cursor:'pointer', fontWeight:700, color:'inherit' }}>×</button>
        </div>
      )}

      {sections.length > 1 && (
        <Card style={{ marginBottom:20 }}>
          <label style={labelStyle}>Sección</label>
          <select value={activeId} onChange={e => setActiveId(e.target.value)} style={selectStyle}>
            {sections.map(s => (
              <option key={s.id} value={s.id}>{s.course.code}-0{s.sectionNo} — {s.course.name}</option>
            ))}
          </select>
        </Card>
      )}

      {loading ? <PageSpinner /> : rows.length === 0 ? (
        <EmptyState icon="📚" title="Sin estudiantes" desc="Esta sección no tiene estudiantes inscritos." />
      ) : (
        <Card>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:12, marginBottom:20, flexWrap:'wrap' }}>
            <div>
              <SectionTitle style={{ marginBottom:2 }}>{activeSection?.course?.name ?? 'Sección'}</SectionTitle>
              <div style={{ fontSize:13, color:'var(--stone-400)' }}>
                P1 (máx 25) · P2 (máx 25) · Tareas (máx 20) · Examen (máx 20) · Asistencia (máx 8)
              </div>
            </div>
            {hasRejected ? (
              <Button variant="primary" onClick={reopenGrades} disabled={submitting}>
                ↩ Reabrir y corregir
              </Button>
            ) : !alreadySent ? (
              <Button variant="primary" onClick={submitAll} disabled={!allEntered || submitting}>
                {submitting ? 'Enviando…' : 'Enviar a Registro →'}
              </Button>
            ) : (
              <Badge color="amber">Enviado a Registro</Badge>
            )}
          </div>

          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13.5 }}>
              <thead>
                <tr style={{ background:'var(--stone-100)' }}>
                  {['Matrícula','Nombre','P1 /25','P2 /25','Tareas /20','Examen /20','Asist.','Total /100','Estado',''].map(h => (
                    <th key={h} style={{ padding:'10px 12px', textAlign: h==='Nombre' ? 'left' : 'center', fontWeight:600, color:'var(--stone-500)', fontSize:12, whiteSpace:'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => {
                  const ed         = edits[row.student.id] ?? EMPTY_EDIT
                  const asistencia = row.grade?.asistencia ?? 0
                  const final      = calcFinal(ed, asistencia)
                  const locked     = ['enviado','validado','publicado'].includes(row.grade?.status)
                  const bg         = i % 2 === 0 ? '#fff' : 'var(--stone-50)'
                  const finalNum   = final !== null ? parseFloat(final) : null

                  return (
                    <tr key={row.student.id} style={{ background: row.enrollmentStatus === 'retirado' ? '#FFF8F0' : bg, opacity: row.enrollmentStatus === 'retirado' ? .7 : 1 }}>
                      <td style={td}>{row.student.institutionalId}</td>
                      <td style={{ ...td, textAlign:'left' }}>
                        {row.student.firstName} {row.student.lastName}
                        {row.enrollmentStatus === 'retirado' && (
                          <span style={{ marginLeft:6, fontSize:11, background:'#FADBD8', color:'var(--error)', padding:'1px 6px', borderRadius:99, fontWeight:600 }}>Retirado</span>
                        )}
                      </td>

                      {['parcial1','parcial2','tareas','examen'].map(field => (
                        <td key={field} style={td}>
                          <input
                            type="number" min={0} max={FIELD_LIMITS[field]} step={0.1}
                            value={ed[field] ?? ''} disabled={locked}
                            onChange={e => setField(row.student.id, field, e.target.value)}
                            style={{
                              width:64, padding:'5px 8px', borderRadius:'var(--radius-sm)',
                              border:'1.5px solid var(--stone-200)', fontSize:13,
                              textAlign:'center', outline:'none',
                              background: locked ? 'var(--stone-100)' : '#fff',
                            }}
                          />
                        </td>
                      ))}

                      {/* Asistencia — readonly, calculada automáticamente */}
                      <td style={td}>
                        <span style={{ fontWeight:600, color:'var(--green-700)' }}>{asistencia}</span>
                        <span style={{ fontSize:11, color:'var(--stone-400)' }}>/8</span>
                      </td>

                      {/* Nota final */}
                      <td style={td}>
                        <span style={{ fontWeight:700, fontSize:15,
                          color: finalNum === null ? 'var(--stone-300)'
                               : finalNum >= 70 ? 'var(--green-700)'
                               : 'var(--error)',
                        }}>
                          {final ?? '—'}
                        </span>
                      </td>

                      <td style={td}>
                        <Badge color={STATUS_COLORS[row.grade?.status ?? 'borrador']}>
                          {STATUS_LABELS[row.grade?.status ?? 'borrador']}
                        </Badge>
                      </td>

                      <td style={td}>
                        {!locked && (
                          <Button variant="secondary" size="sm" onClick={() => saveGrade(row.student.id)} disabled={saving === row.student.id}>
                            {saving === row.student.id ? '…' : 'Guardar'}
                          </Button>
                        )}
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

const td          = { padding:'9px 12px', textAlign:'center', borderBottom:'1px solid var(--stone-100)' }
const labelStyle  = { display:'block', fontSize:11.5, fontWeight:600, color:'var(--stone-500)', letterSpacing:'.05em', textTransform:'uppercase', marginBottom:5 }
const selectStyle = { padding:'8px 12px', borderRadius:'var(--radius-md)', border:'1.5px solid var(--stone-200)', fontSize:13.5, outline:'none', background:'#fff', color:'var(--stone-900)' }
