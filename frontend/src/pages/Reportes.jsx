// src/pages/Reportes.jsx
// Sprint 5 — Reportes académicos consolidados (solo Registro)
import { useState, useEffect } from 'react'
import AppShell   from '../components/AppShell.jsx'
import { Card, Badge, PageSpinner, EmptyState, SectionTitle, Button } from '../components/ui.jsx'
import { navForRole } from '../lib/navItems.js'
import { api }        from '../lib/api.js'

// ── helpers ───────────────────────────────────────────────────────────────────
function pct(n) { return `${n ?? 0}%` }
function num(n) { return n?.toFixed(2) ?? '—' }
function gradeColor(g) {
  if (g == null)  return 'var(--stone-300)'
  if (g >= 85)    return 'var(--green-700)'
  if (g >= 70)    return 'var(--gold-500)'
  return 'var(--error)'
}
function attColor(p) {
  if (p >= 90)  return 'var(--green-700)'
  if (p >= 75)  return 'var(--gold-500)'
  return 'var(--error)'
}

// Mini progress bar
function Bar({ value, max = 100, color }) {
  return (
    <div style={{ height: 5, background: 'var(--stone-100)', borderRadius: 99, minWidth: 60 }}>
      <div style={{ height: 5, width: `${Math.min(100, (value / max) * 100)}%`, background: color, borderRadius: 99, transition: 'width .4s' }} />
    </div>
  )
}

// Stat pill
function Stat({ label, value, color }) {
  return (
    <div style={{ background: 'var(--stone-50)', borderRadius: 'var(--radius-md)', padding: '10px 16px', textAlign: 'center', border: '1px solid var(--stone-200)', minWidth: 90 }}>
      <div style={{ fontSize: 20, fontWeight: 700, color: color ?? 'var(--stone-900)' }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--stone-400)', marginTop: 3 }}>{label}</div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function Reportes() {
  const navItems = navForRole('registro')

  const [tab,       setTab]       = useState('attendance') // attendance | grades
  const [periods,   setPeriods]   = useState([])
  const [periodId,  setPeriodId]  = useState('')
  const [attData,   setAttData]   = useState([])
  const [gradeData, setGradeData] = useState([])
  const [loading,   setLoading]   = useState(false)
  const [expanded,  setExpanded]  = useState(null)   // sectionId of expanded row

  // Load periods once
  useEffect(() => {
    api.get('/reports/periods').then(data => {
      setPeriods(data)
      if (data.length) setPeriodId(String(data[0].id))
    }).catch(() => {})
  }, [])

  // Load report data when period or tab changes
  useEffect(() => {
    if (!periodId) return
    setLoading(true)
    setExpanded(null)
    const endpoint = tab === 'attendance'
      ? `/reports/attendance?periodId=${periodId}`
      : `/reports/grades?periodId=${periodId}`
    api.get(endpoint)
      .then(data => tab === 'attendance' ? setAttData(data) : setGradeData(data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [tab, periodId])

  const data = tab === 'attendance' ? attData : gradeData

  // ── Summary cards across all sections ──────────────────────────────────────
  const summary = tab === 'attendance'
    ? {
        totalSections: attData.length,
        totalStudents: attData.reduce((s, d) => s + d.totalStudents, 0),
        atRisk:        attData.reduce((s, d) => s + d.atRisk, 0),
        avgAtt:        attData.length
          ? Math.round(attData.reduce((s, d) => s + d.avgAttendance, 0) / attData.length)
          : 0,
      }
    : {
        totalSections:  gradeData.length,
        totalEnrolled:  gradeData.reduce((s, d) => s + d.totalEnrolled, 0),
        totalApproved:  gradeData.reduce((s, d) => s + d.approved, 0),
        totalFailed:    gradeData.reduce((s, d) => s + d.failed, 0),
        avgPassRate:    gradeData.length
          ? Math.round(gradeData.reduce((s, d) => s + d.passRate, 0) / gradeData.length)
          : 0,
      }

  return (
    <AppShell navItems={navItems}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', color: 'var(--stone-900)', margin: 0 }}>Reportes académicos</h2>
          <p style={{ color: 'var(--stone-400)', fontSize: 14, marginTop: 6 }}>Resumen consolidado por período y sección</p>
        </div>

        {/* Period selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <label style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--stone-500)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Período</label>
          <select value={periodId} onChange={e => setPeriodId(e.target.value)} style={selectStyle}>
            {periods.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: 'var(--stone-100)', padding: 4, borderRadius: 'var(--radius-md)', width: 'fit-content' }}>
        {[['attendance', '📋 Asistencia'], ['grades', '📊 Calificaciones']].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} style={{
            padding: '8px 22px', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer',
            border: 'none',
            background: tab === key ? '#fff' : 'transparent',
            color:      tab === key ? 'var(--stone-900)' : 'var(--stone-400)',
            boxShadow:  tab === key ? '0 1px 4px rgba(0,0,0,.08)' : 'none',
            transition: 'all .15s',
          }}>{label}</button>
        ))}
      </div>

      {/* Summary strip */}
      {!loading && data.length > 0 && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
          {tab === 'attendance' ? (
            <>
              <Stat label="Secciones"       value={summary.totalSections} />
              <Stat label="Estudiantes"     value={summary.totalStudents} />
              <Stat label="Asistencia prom" value={pct(summary.avgAtt)}    color={attColor(summary.avgAtt)} />
              <Stat label="En riesgo"        value={summary.atRisk}         color={summary.atRisk > 0 ? 'var(--error)' : 'var(--green-700)'} />
            </>
          ) : (
            <>
              <Stat label="Secciones"    value={summary.totalSections} />
              <Stat label="Matriculados" value={summary.totalEnrolled} />
              <Stat label="Aprobados"    value={summary.totalApproved}  color="var(--green-700)" />
              <Stat label="Reprobados"   value={summary.totalFailed}    color={summary.totalFailed > 0 ? 'var(--error)' : 'var(--stone-400)'} />
              <Stat label="Tasa aprob."  value={pct(summary.avgPassRate)} color={attColor(summary.avgPassRate)} />
            </>
          )}
        </div>
      )}

      {/* Content */}
      {loading ? <PageSpinner /> : data.length === 0 ? (
        <EmptyState icon="📭" title="Sin datos" desc="No hay información para el período seleccionado." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {data.map(sec => (
            <Card key={sec.sectionId} style={{ padding: 0, overflow: 'hidden' }}>

              {/* Section header row */}
              <div
                onClick={() => setExpanded(expanded === sec.sectionId ? null : sec.sectionId)}
                style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 20px', cursor: 'pointer', userSelect: 'none', background: expanded === sec.sectionId ? 'var(--green-50)' : '#fff', transition: 'background .15s', flexWrap: 'wrap' }}
              >
                {/* Chevron */}
                <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="var(--stone-400)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"
                  style={{ transform: expanded === sec.sectionId ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform .2s', flexShrink: 0 }}>
                  <polyline points="9 18 15 12 9 6"/>
                </svg>

                {/* Code badge */}
                <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', background: 'var(--stone-100)', color: 'var(--stone-700)', padding: '2px 8px', borderRadius: 5, fontWeight: 700, flexShrink: 0 }}>
                  {sec.code}
                </span>

                {/* Name + prof */}
                <div style={{ flex: 1, minWidth: 160 }}>
                  <div style={{ fontWeight: 700, fontSize: 14.5, color: 'var(--stone-900)' }}>{sec.courseName}</div>
                  <div style={{ fontSize: 12, color: 'var(--stone-400)', marginTop: 2 }}>Prof. {sec.professor} · {sec.period}</div>
                </div>

                {/* Stats on right */}
                {tab === 'attendance' ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexShrink: 0, flexWrap: 'wrap' }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 18, fontWeight: 700, color: attColor(sec.avgAttendance) }}>{pct(sec.avgAttendance)}</div>
                      <div style={{ fontSize: 11, color: 'var(--stone-400)' }}>Asist. prom.</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--stone-700)' }}>{sec.totalSessions}</div>
                      <div style={{ fontSize: 11, color: 'var(--stone-400)' }}>Sesiones</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 18, fontWeight: 700, color: sec.atRisk > 0 ? 'var(--error)' : 'var(--green-700)' }}>{sec.atRisk}</div>
                      <div style={{ fontSize: 11, color: 'var(--stone-400)' }}>En riesgo</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 18, fontWeight: 700 }}>{sec.totalStudents}</div>
                      <div style={{ fontSize: 11, color: 'var(--stone-400)' }}>Estudiantes</div>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexShrink: 0, flexWrap: 'wrap' }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 18, fontWeight: 700, color: gradeColor(sec.avgFinal) }}>{num(sec.avgFinal)}</div>
                      <div style={{ fontSize: 11, color: 'var(--stone-400)' }}>Prom. final</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 18, fontWeight: 700, color: attColor(sec.passRate) }}>{pct(sec.passRate)}</div>
                      <div style={{ fontSize: 11, color: 'var(--stone-400)' }}>Aprobados</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--green-700)' }}>{sec.approved}</div>
                      <div style={{ fontSize: 11, color: 'var(--stone-400)' }}>Aprobados</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 18, fontWeight: 700, color: sec.failed > 0 ? 'var(--error)' : 'var(--stone-300)' }}>{sec.failed}</div>
                      <div style={{ fontSize: 11, color: 'var(--stone-400)' }}>Reprobados</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Expanded student table */}
              {expanded === sec.sectionId && (
                <div style={{ borderTop: '1px solid var(--stone-100)', overflowX: 'auto' }}>
                  {tab === 'attendance' ? (
                    <AttendanceTable students={sec.students} totalSessions={sec.totalSessions} />
                  ) : (
                    <GradesTable grades={sec.grades} />
                  )}
                </div>
              )}

            </Card>
          ))}
        </div>
      )}
    </AppShell>
  )
}

// ── Attendance student table ───────────────────────────────────────────────────
function AttendanceTable({ students, totalSessions }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
      <thead>
        <tr style={{ background: 'var(--stone-50)' }}>
          {['Matrícula','Nombre','Presente','Excusa','Tardanza','Ausente','Sesiones','% Asist.','Pts.','Estado'].map(h => (
            <th key={h} style={th(h === 'Nombre')}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {students.map((s, i) => (
          <tr key={s.id} style={{ background: i % 2 === 0 ? '#fff' : 'var(--stone-50)' }}>
            <td style={td(true)}>{s.institutionalId}</td>
            <td style={td(false)}>{s.name}</td>
            <td style={td(true)}><span style={{ fontWeight:600, color:'var(--green-700)' }}>{s.present ?? 0}</span></td>
            <td style={td(true)}><span style={{ fontWeight:600, color:'var(--blue-700)' }}>{s.excuse ?? 0}</span></td>
            <td style={td(true)}><span style={{ fontWeight:600, color:'var(--gold-500)' }}>{s.late ?? 0}</span></td>
            <td style={td(true)}><span style={{ fontWeight:600, color:(s.absent??0)>0?'var(--error)':'var(--stone-300)' }}>{s.absent ?? 0}</span></td>
            <td style={td(true)}>{totalSessions}</td>
            <td style={td(true)}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <Bar value={s.percentage} color={attColor(s.percentage)} />
                <span style={{ fontWeight:700, color:attColor(s.percentage), minWidth:36 }}>{pct(s.percentage)}</span>
              </div>
            </td>
            <td style={td(true)}>
              <span style={{ fontWeight:700, color:attColor((s.attendancePoints??0)/8*100) }}>{s.attendancePoints ?? 0}</span>
              <span style={{ fontSize:10, color:'var(--stone-400)' }}>/8</span>
            </td>
            <td style={td(true)}>
              {s.risk
                ? <Badge color="red">⚠ En riesgo</Badge>
                : <Badge color="green">✓ Regular</Badge>
              }
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// ── Grades student table ───────────────────────────────────────────────────────
function GradesTable({ grades }) {
  if (grades.length === 0) {
    return <div style={{ padding: '24px', textAlign: 'center', color: 'var(--stone-400)', fontSize: 13.5 }}>Sin calificaciones publicadas aún.</div>
  }
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
      <thead>
        <tr style={{ background: 'var(--stone-50)' }}>
          {['Matrícula','Nombre','P1 (/25)','P2 (/25)','Tar (/20)','Exam (/20)','Asist. (/8)','Final /100','Resultado'].map(h => (
            <th key={h} style={th(h === 'Nombre')}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {grades.map((g, i) => (
          <tr key={g.institutionalId} style={{ background: i % 2 === 0 ? '#fff' : 'var(--stone-50)' }}>
            <td style={td(true)}>{g.institutionalId}</td>
            <td style={td(false)}>{g.name}</td>
            <td style={td(true)}>{g.parcial1?.toFixed(1) ?? '—'}</td>
            <td style={td(true)}>{g.parcial2?.toFixed(1) ?? '—'}</td>
            <td style={td(true)}>{g.tareas?.toFixed(1)   ?? '—'}</td>
            <td style={td(true)}>{g.examen?.toFixed(1)   ?? '—'}</td>
            <td style={td(true)}>{g.asistencia?.toFixed(0) ?? '—'}</td>
            <td style={td(true)}>
              <span style={{ fontWeight: 700, fontSize: 15, color: gradeColor(g.finalGrade) }}>
                {num(g.finalGrade)}
              </span>
            </td>
            <td style={td(true)}>
              {g.passed
                ? <Badge color="green">Aprobado</Badge>
                : <Badge color="red">Reprobado</Badge>
              }
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const selectStyle = {
  padding: '8px 12px', borderRadius: 'var(--radius-md)',
  border: '1.5px solid var(--stone-200)', fontSize: 13.5,
  outline: 'none', background: '#fff', color: 'var(--stone-900)',
}

const th = (left = false) => ({
  padding: '10px 14px', textAlign: left ? 'left' : 'center',
  fontWeight: 600, color: 'var(--stone-500)', fontSize: 12,
  whiteSpace: 'nowrap', borderBottom: '1px solid var(--stone-200)',
})
const td = (center = true) => ({
  padding: '10px 14px', textAlign: center ? 'center' : 'left',
  borderBottom: '1px solid var(--stone-100)',
})
