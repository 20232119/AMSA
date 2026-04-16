// src/pages/Reportes.jsx
import { useState, useEffect, useMemo } from 'react'
import Swal from 'sweetalert2'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import AppShell from '../components/AppShell.jsx'
import { Card, Badge, PageSpinner, EmptyState, Button } from '../components/ui.jsx'
import { navForRole } from '../lib/navItems.js'
import { api } from '../lib/api.js'
import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'

function pct(n) { return `${n ?? 0}%` }
function num(n) { return n?.toFixed(2) ?? '—' }

function gradeColor(g) {
  if (g == null) return 'var(--stone-300)'
  if (g >= 85) return 'var(--green-700)'
  if (g >= 70) return 'var(--gold-500)'
  return 'var(--error)'
}

function attColor(p) {
  if (p >= 90) return 'var(--green-700)'
  if (p >= 75) return 'var(--gold-500)'
  return 'var(--error)'
}

function Bar({ value, max = 100, color }) {
  return (
    <div style={{ height: 5, background: 'var(--stone-100)', borderRadius: 99, minWidth: 60 }}>
      <div
        style={{
          height: 5,
          width: `${Math.min(100, (value / max) * 100)}%`,
          background: color,
          borderRadius: 99,
          transition: 'width .4s'
        }}
      />
    </div>
  )
}

function Stat({ label, value, color }) {
  return (
    <div
      style={{
        background: 'var(--stone-50)',
        borderRadius: 'var(--radius-md)',
        padding: '10px 16px',
        textAlign: 'center',
        border: '1px solid var(--stone-200)',
        minWidth: 90
      }}
    >
      <div style={{ fontSize: 20, fontWeight: 700, color: color ?? 'var(--stone-900)' }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--stone-400)', marginTop: 3 }}>{label}</div>
    </div>
  )
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function Reportes() {
  const navItems = navForRole('registro')

  const [tab, setTab] = useState('attendance')
  const [periods, setPeriods] = useState([])
  const [periodId, setPeriodId] = useState('')
  const [sectionId, setSectionId] = useState('all')

  const [attData, setAttData] = useState([])
  const [gradeData, setGradeData] = useState([])

  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState(null)

  // Load periods
  useEffect(() => {
    api.get('/reports/periods')
      .then(data => {
        setPeriods(data)
        if (data.length) setPeriodId(String(data[0].id))
      })
      .catch(async (e) => {
        await Swal.fire({
          icon: 'error',
          title: 'Error',
          text: e.message || 'No se pudieron cargar los períodos.',
        })
      })
  }, [])

  // Load data
  useEffect(() => {
    if (!periodId) return

    setLoading(true)
    setExpanded(null)
    setSectionId('all')

    const endpoint = tab === 'attendance'
      ? `/reports/attendance?periodId=${periodId}`
      : `/reports/grades?periodId=${periodId}`

    api.get(endpoint)
      .then(data => {
        if (tab === 'attendance') setAttData(data)
        else setGradeData(data)
      })
      .catch(async (e) => {
        await Swal.fire({
          icon: 'error',
          title: 'Error',
          text: e.message || 'No se pudo cargar el reporte.',
        })
      })
      .finally(() => setLoading(false))
  }, [tab, periodId])

  const rawData = tab === 'attendance' ? attData : gradeData
  const currentPeriod = periods.find(p => String(p.id) === String(periodId))

  const sectionOptions = useMemo(() => {
    return rawData.map(sec => ({
      id: sec.sectionId,
      label: `${sec.code} — ${sec.courseName}`,
    }))
  }, [rawData])

  const data = useMemo(() => {
    if (sectionId === 'all') return rawData
    return rawData.filter(sec => sec.sectionId === sectionId)
  }, [rawData, sectionId])

  const summary = tab === 'attendance'
    ? {
        totalSections: data.length,
        totalStudents: data.reduce((s, d) => s + d.totalStudents, 0),
        atRisk: data.reduce((s, d) => s + d.atRisk, 0),
        avgAtt: data.length
          ? Math.round(data.reduce((s, d) => s + d.avgAttendance, 0) / data.length)
          : 0,
      }
    : {
        totalSections: data.length,
        totalEnrolled: data.reduce((s, d) => s + d.totalEnrolled, 0),
        totalApproved: data.reduce((s, d) => s + d.approved, 0),
        totalFailed: data.reduce((s, d) => s + d.failed, 0),
        avgPassRate: data.length
          ? Math.round(data.reduce((s, d) => s + d.passRate, 0) / data.length)
          : 0,
      }

  function buildAttendanceRows() {
    const rows = []
    data.forEach(sec => {
      sec.students.forEach(st => {
        rows.push({
          Sección: sec.code,
          Materia: sec.courseName,
          Profesor: sec.professor,
          Período: sec.period,
          Matrícula: st.institutionalId,
          Estudiante: st.name,
          Presente: st.present,
          Excusa: st.excuse,
          Tardanza: st.late,
          Ausente: st.absent,
          '%': st.percentage,
        })
      })
    })
    return rows
  }   function buildGradesRows() {
    const rows = []
    data.forEach(sec => {
      sec.grades.forEach(g => {
        rows.push({
          Sección: sec.code,
          Materia: sec.courseName,
          Profesor: sec.professor,
          Período: sec.period,
          Matrícula: g.institutionalId,
          Estudiante: g.name,
          Carrera: g.career ?? '—',
          'Parcial 1': g.parcial1 ?? '',
          'Parcial 2': g.parcial2 ?? '',
          Tareas: g.tareas ?? '',
          Examen: g.examen ?? '',
          Asistencia: g.asistencia ?? '',
          Final: g.finalGrade ?? '',
          Estado: g.passed ? 'Aprobado' : 'Reprobado',
        })
      })
    })
    return rows
  }

  async function exportExcel() {
  try {
    if (tab === 'attendance') {
      await Swal.fire({
        icon: 'info',
        title: 'No aplica',
        text: 'El Excel estilizado es solo para calificaciones.',
      })
      return
    }

    if (data.length !== 1) {
      await Swal.fire({
        icon: 'warning',
        title: 'Selecciona una materia',
        text: 'Debes elegir una sola materia para generar el acta.',
      })
      return
    }

    const sec = data[0]
    const rows = sec.grades ?? []

    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('Acta')

    // ───── TÍTULO ─────
    sheet.mergeCells('A1:K1')
    sheet.getCell('A1').value = 'UAFAM — ACTA DE CALIFICACIONES'
    sheet.getCell('A1').font = { size: 18, bold: true, color: { argb: 'FFFFFFFF' } }
    sheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' }
    sheet.getCell('A1').fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1F5D87' },
    }

    // ───── SUBTÍTULO ─────
    sheet.mergeCells('A2:K2')
    sheet.getCell('A2').value = `${sec.code} — ${sec.courseName}`
    sheet.getCell('A2').font = { size: 16, bold: true, color: { argb: 'FFFFFFFF' } }
    sheet.getCell('A2').alignment = { horizontal: 'center' }
    sheet.getCell('A2').fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1F8A4C' },
    }

    // ───── INFO ─────
    sheet.getCell('A3').value = 'Docente:'
    sheet.getCell('B3').value = sec.professor
    sheet.getCell('D3').value = 'Período:'
    sheet.getCell('E3').value = sec.period
    sheet.getCell('H3').value = 'Generado:'
    sheet.getCell('I3').value = new Date().toLocaleString()

    // ───── HEADER ─────
    const headers = [
      'Matrícula',
      'Nombre',
      'Carrera',
      'Parcial 1',
      'Parcial 2',
      'Tareas',
      'Examen',
      'Asistencia',
      'Final',
      'Condición',
      'Estado',
    ]

    const headerRow = sheet.addRow(headers)

    headerRow.eachCell(cell => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
      cell.alignment = { horizontal: 'center' }
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF2F455B' },
      }
      cell.border = {
        top: { style: 'thin' },
        bottom: { style: 'thin' },
      }
    })

    // ───── DATA ─────
    rows.forEach(r => {
      const row = sheet.addRow([
        r.institutionalId,
        r.name,
        r.career ?? '—',
        r.parcial1 ?? '',
        r.parcial2 ?? '',
        r.tareas ?? '',
        r.examen ?? '',
        r.asistencia ?? '',
        r.finalGrade ?? '',
        r.finalGrade >= 70 ? 'Aprobado' : 'Reprobado',
        r.status ?? '',
      ])

      row.eachCell((cell, col) => {
        cell.alignment = {
          horizontal: col >= 4 ? 'center' : 'left',
        }

        // Final destacado
        if (col === 9) {
          cell.font = { bold: true }
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFD9EBDD' },
          }
        }
      })
    })

    // ───── PROMEDIOS ─────
    const avg = (key) =>
      rows.length
        ? (rows.reduce((s, r) => s + (r[key] ?? 0), 0) / rows.length).toFixed(2)
        : ''

    const avgRow = sheet.addRow([
      'PROMEDIOS',
      '',
      '',
      avg('parcial1'),
      avg('parcial2'),
      avg('tareas'),
      avg('examen'),
      avg('asistencia'),
      avg('finalGrade'),
      `${rows.filter(r => r.finalGrade >= 70).length}/${rows.length}`,
      '',
    ])

    avgRow.eachCell(cell => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1F8A4C' },
      }
      cell.alignment = { horizontal: 'center' }
    })

    // ───── ANCHOS ─────
    sheet.columns = [
      { width: 16 },
      { width: 28 },
      { width: 30 },
      { width: 14 },
      { width: 14 },
      { width: 14 },
      { width: 14 },
      { width: 14 },
      { width: 14 },
      { width: 16 },
      { width: 16 },
    ]

    // ───── EXPORTAR ─────
    const buffer = await workbook.xlsx.writeBuffer()
    saveAs(new Blob([buffer]), `Acta_${sec.code}.xlsx`)

    await Swal.fire({
      icon: 'success',
      title: 'Excel listo',
      text: 'Acta generada correctamente.',
    })

  } catch (e) {
    await Swal.fire({
      icon: 'error',
      title: 'Error',
      text: e.message,
    })
  }
}

  async function exportPDF() {
    try {
      if (!data.length) {
        await Swal.fire({
          icon: 'warning',
          title: 'Sin datos',
          text: 'No hay datos para exportar.',
          confirmButtonText: 'Entendido',
        })
        return
      }

      if (tab === 'attendance') {
        const doc = new jsPDF('l', 'pt', 'a4')
        doc.setFontSize(16)
        doc.text('Reporte consolidado de asistencia', 40, 40)
        doc.setFontSize(10)
        doc.text(`Período: ${currentPeriod?.name ?? '—'}`, 40, 58)

        autoTable(doc, {
          startY: 80,
          head: [['Sección', 'Materia', 'Matrícula', 'Estudiante', 'Pres.', 'Exc.', 'Tard.', 'Aus.', '%', 'Pts.', 'Estado']],
          body: data.flatMap(sec =>
            sec.students.map(st => [
              sec.code,
              sec.courseName,
              st.institutionalId,
              st.name,
              st.present,
              st.excuse,
              st.late,
              st.absent,
              `${st.percentage}%`,
              `${st.attendancePoints}/8`,
              st.risk ? 'En riesgo' : 'Regular',
            ])
          ),
          styles: { fontSize: 8 },
          headStyles: { fillColor: [52, 73, 94] },
        })

        doc.save(`Reporte_Asistencia_${currentPeriod?.name ?? 'Periodo'}.pdf`)

        await Swal.fire({
          icon: 'success',
          title: 'PDF descargado',
          text: 'El reporte de asistencia se descargó correctamente.',
          confirmButtonText: 'Aceptar',
        })
        return
      }

      if (data.length !== 1) {
        await Swal.fire({
          icon: 'warning',
          title: 'Selecciona una materia',
          text: 'Para exportar el acta de calificaciones debes elegir una sola materia.',
          confirmButtonText: 'Entendido',
        })
        return
      }

      const sec = data[0]
      const rows = sec.grades ?? []

      const doc = new jsPDF('l', 'pt', 'a4')

      doc.setFillColor(31, 93, 135)
      doc.rect(20, 20, 800, 32, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(18)
      doc.text('UAFAM — ACTA DE CALIFICACIONES', 420, 42, { align: 'center' })

      doc.setFillColor(31, 138, 76)
      doc.rect(20, 56, 800, 28, 'F')
      doc.setFontSize(16)
      doc.text(`${sec.code} — ${sec.courseName}`, 420, 75, { align: 'center' })

      doc.setTextColor(0, 0, 0)
      doc.setFontSize(11)
      doc.text(`Docente: ${sec.professor}`, 24, 105)
      doc.text(`Período: ${sec.period}`, 240, 105)
      doc.text(`Generado: ${new Date().toLocaleString('es-DO')}`, 470, 105)

      autoTable(doc, {
        startY: 120,
        head: [[
          'Matrícula',
          'Nombre',
          'Carrera',
          'Parcial 1 (/25)',
          'Parcial 2 (/25)',
          'Tareas (/20)',
          'Examen (/20)',
          'Asistencia (/8)',
          'Nota Final',
          'Condición',
          'Estado',
        ]],
        body: rows.map(r => [
          r.institutionalId,
          r.name,
          r.career ?? '—',
          r.parcial1 ?? '',
          r.parcial2 ?? '',
          r.tareas ?? '',
          r.examen ?? '',
          r.asistencia ?? '',
          r.finalGrade ?? '',
          r.finalGrade != null ? (r.finalGrade >= 70 ? 'Aprobado' : 'Reprobado') : '',
          r.status === 'publicado' ? 'Publicado' : r.status === 'validado' ? 'Validado' : (r.status ?? ''),
        ]),
        foot: [[
          'PROMEDIOS',
          '',
          '',
          rows.length ? +(rows.reduce((s, r) => s + (r.parcial1 ?? 0), 0) / rows.length).toFixed(2) : '',
          rows.length ? +(rows.reduce((s, r) => s + (r.parcial2 ?? 0), 0) / rows.length).toFixed(2) : '',
          rows.length ? +(rows.reduce((s, r) => s + (r.tareas ?? 0), 0) / rows.length).toFixed(2) : '',
          rows.length ? +(rows.reduce((s, r) => s + (r.examen ?? 0), 0) / rows.length).toFixed(2) : '',
          rows.length ? +(rows.reduce((s, r) => s + (r.asistencia ?? 0), 0) / rows.length).toFixed(2) : '',
          rows.length ? +(rows.reduce((s, r) => s + (r.finalGrade ?? 0), 0) / rows.length).toFixed(2) : '',
          `${rows.filter(r => (r.finalGrade ?? 0) >= 70).length} / ${rows.length}`,
          '',
        ]],
        styles: { fontSize: 8, cellPadding: 4 },
        headStyles: { fillColor: [47, 69, 91], textColor: 255, halign: 'center' },
        footStyles: { fillColor: [31, 138, 76], textColor: 255, halign: 'center' },
        columnStyles: {
          7: { fillColor: [217, 235, 221] },
          8: { fillColor: [217, 235, 221], fontStyle: 'bold' },
        },
      })

      doc.save(`Acta_${sec.code}_${sec.courseName.replace(/[\\/:*?"<>|]/g, '_')}.pdf`)

      await Swal.fire({
        icon: 'success',
        title: 'PDF descargado',
        text: 'El acta de calificaciones se descargó correctamente.',
        confirmButtonText: 'Aceptar',
      })
    } catch (e) {
      await Swal.fire({
        icon: 'error',
        title: 'No se pudo exportar',
        text: e.message || 'Error al generar el PDF.',
        confirmButtonText: 'Cerrar',
      })
    }
  }

  return (
    <AppShell navItems={navItems}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', color: 'var(--stone-900)', margin: 0 }}>
            Reportes académicos
          </h2>
          <p style={{ color: 'var(--stone-400)', fontSize: 14, marginTop: 6 }}>
            Resumen consolidado por período y sección
          </p>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
          <div>
            <label style={labelStyle}>Período</label>
            <select value={periodId} onChange={e => setPeriodId(e.target.value)} style={selectStyle}>
              {periods.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          <div>
            <label style={labelStyle}>Materia</label>
            <select value={sectionId} onChange={e => setSectionId(e.target.value)} style={selectStyle}>
              <option value="all">Todas</option>
              {sectionOptions.map(s => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </div>

          <div style={{ alignSelf:'flex-end', display:'flex', gap:8 }}>
            <Button variant="secondary" size="sm" onClick={exportExcel}>
              Descargar Excel
            </Button>

            <Button variant="primary" size="sm" onClick={exportPDF}>
              Descargar PDF
            </Button>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: 'var(--stone-100)', padding: 4, borderRadius: 'var(--radius-md)', width: 'fit-content' }}>
        {[['attendance', 'Asistencia'], ['grades', 'Calificaciones']].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{
              padding: '8px 22px',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              border: 'none',
              background: tab === key ? '#fff' : 'transparent',
              color: tab === key ? 'var(--stone-900)' : 'var(--stone-400)',
              boxShadow: tab === key ? '0 1px 4px rgba(0,0,0,.08)' : 'none',
              transition: 'all .15s',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {!loading && data.length > 0 && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
          {tab === 'attendance' ? (
            <>
              <Stat label="Secciones" value={summary.totalSections} />
              <Stat label="Estudiantes" value={summary.totalStudents} />
              <Stat label="Asistencia prom" value={pct(summary.avgAtt)} color={attColor(summary.avgAtt)} />
              <Stat label="En riesgo" value={summary.atRisk} color={summary.atRisk > 0 ? 'var(--error)' : 'var(--green-700)'} />
            </>
          ) : (
            <>
              <Stat label="Secciones" value={summary.totalSections} />
              <Stat label="Matriculados" value={summary.totalEnrolled} />
              <Stat label="Aprobados" value={summary.totalApproved} color="var(--green-700)" />
              <Stat label="Reprobados" value={summary.totalFailed} color={summary.totalFailed > 0 ? 'var(--error)' : 'var(--stone-400)'} />
              <Stat label="Tasa aprob." value={pct(summary.avgPassRate)} color={attColor(summary.avgPassRate)} />
            </>
          )}
        </div>
      )}

      {loading ? <PageSpinner /> : data.length === 0 ? (
        <EmptyState icon="📭" title="Sin datos" desc="No hay información para el filtro seleccionado." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {data.map(sec => (
            <Card key={sec.sectionId} style={{ padding: 0, overflow: 'hidden' }}>
              <div
                onClick={() => setExpanded(expanded === sec.sectionId ? null : sec.sectionId)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  padding: '14px 20px',
                  cursor: 'pointer',
                  userSelect: 'none',
                  background: expanded === sec.sectionId ? 'var(--green-50)' : '#fff',
                  transition: 'background .15s',
                  flexWrap: 'wrap'
                }}
              >
                <svg
                  width={16}
                  height={16}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--stone-400)"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ transform: expanded === sec.sectionId ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform .2s', flexShrink: 0 }}
                >
                  <polyline points="9 18 15 12 9 6"/>
                </svg>

                <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', background: 'var(--stone-100)', color: 'var(--stone-700)', padding: '2px 8px', borderRadius: 5, fontWeight: 700, flexShrink: 0 }}>
                  {sec.code}
                </span>

                <div style={{ flex: 1, minWidth: 160 }}>
                  <div style={{ fontWeight: 700, fontSize: 14.5, color: 'var(--stone-900)' }}>{sec.courseName}</div>
                  <div style={{ fontSize: 12, color: 'var(--stone-400)', marginTop: 2 }}>
                    Prof. {sec.professor} · {sec.period}
                  </div>
                </div>

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

              {expanded === sec.sectionId && (
                <div style={{ borderTop: '1px solid var(--stone-100)', overflowX: 'auto' }}>
                  {tab === 'attendance'
                    ? <AttendanceTable students={sec.students} totalSessions={sec.totalSessions} />
                    : <GradesTable grades={sec.grades} />
                  }
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </AppShell>
  )
}
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
            <td style={td(true)}>
              <span style={{ fontWeight:600, color:'var(--green-700)' }}>{s.present ?? 0}</span>
            </td>
            <td style={td(true)}>
              <span style={{ fontWeight:600, color:'var(--blue-700)' }}>{s.excuse ?? 0}</span>
            </td>
            <td style={td(true)}>
              <span style={{ fontWeight:600, color:'var(--gold-500)' }}>{s.late ?? 0}</span>
            </td>
            <td style={td(true)}>
              <span style={{ fontWeight:600, color:(s.absent ?? 0) > 0 ? 'var(--error)' : 'var(--stone-300)' }}>
                {s.absent ?? 0}
              </span>
            </td>
            <td style={td(true)}>{totalSessions}</td>
            <td style={td(true)}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <Bar value={s.percentage} color={attColor(s.percentage)} />
                <span style={{ fontWeight:700, color:attColor(s.percentage), minWidth:36 }}>
                  {pct(s.percentage)}
                </span>
              </div>
            </td>
            <td style={td(true)}>
              <span style={{ fontWeight:700, color:attColor(((s.attendancePoints ?? 0) / 8) * 100) }}>
                {s.attendancePoints ?? 0}
              </span>
              <span style={{ fontSize:10, color:'var(--stone-400)' }}>/8</span>
            </td>
            <td style={td(true)}>
              {s.risk ? <Badge color="red">En riesgo</Badge> : <Badge color="green">Regular</Badge>}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function GradesTable({ grades }) {
  if (grades.length === 0) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', color: 'var(--stone-400)', fontSize: 13.5 }}>
        Sin calificaciones publicadas aún.
      </div>
    )
  }

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
      <thead>
        <tr style={{ background: 'var(--stone-50)' }}>
          {['Matrícula','Nombre','Carrera','P1 (/25)','P2 (/25)','Tareas (/20)','Examen (/20)','Asistencia (/8)','Final /100','Resultado'].map(h => (
            <th key={h} style={th(h === 'Nombre' || h === 'Carrera')}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {grades.map((g, i) => (
          <tr key={g.institutionalId} style={{ background: i % 2 === 0 ? '#fff' : 'var(--stone-50)' }}>
            <td style={td(true)}>{g.institutionalId}</td>
            <td style={td(false)}>{g.name}</td>
            <td style={td(false)}>{g.career ?? '—'}</td>
            <td style={td(true)}>{g.parcial1?.toFixed(1) ?? '—'}</td>
            <td style={td(true)}>{g.parcial2?.toFixed(1) ?? '—'}</td>
            <td style={td(true)}>{g.tareas?.toFixed(1) ?? '—'}</td>
            <td style={td(true)}>{g.examen?.toFixed(1) ?? '—'}</td>
            <td style={td(true)}>{g.asistencia?.toFixed(0) ?? '—'}</td>
            <td style={td(true)}>
              <span style={{ fontWeight: 700, fontSize: 15, color: gradeColor(g.finalGrade) }}>
                {num(g.finalGrade)}
              </span>
            </td>
            <td style={td(true)}>
              {g.passed ? <Badge color="green">Aprobado</Badge> : <Badge color="red">Reprobado</Badge>}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

const labelStyle = {
  display:'block',
  fontSize:11.5,
  fontWeight:600,
  color:'var(--stone-500)',
  letterSpacing:'.05em',
  textTransform:'uppercase',
  marginBottom:5
}

const selectStyle = {
  padding: '8px 12px',
  borderRadius: 'var(--radius-md)',
  border: '1.5px solid var(--stone-200)',
  fontSize: 13.5,
  outline: 'none',
  background: '#fff',
  color: 'var(--stone-900)',
  minWidth: 220,
}

const th = (left = false) => ({
  padding: '10px 14px',
  textAlign: left ? 'left' : 'center',
  fontWeight: 600,
  color: 'var(--stone-500)',
  fontSize: 12,
  whiteSpace: 'nowrap',
  borderBottom: '1px solid var(--stone-200)',
})

const td = (center = true) => ({
  padding: '10px 14px',
  textAlign: center ? 'center' : 'left',
  borderBottom: '1px solid var(--stone-100)',
})