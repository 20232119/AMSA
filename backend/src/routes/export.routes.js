// src/routes/export.routes.js
import { Router } from 'express'
import ExcelJS    from 'exceljs'
import prisma     from '../lib/prisma.js'
import { requireAuth, requireRole } from '../middlewares/auth.middleware.js'

const router = Router()
router.use(requireAuth)
router.use(requireRole('registro', 'profesor'))

// Palette
const C = {
  darkGreen:'1A5276', midGreen:'1E8449', lightGreen:'D5F5E3',
  headerGray:'2C3E50', rowAlt:'EBF5FB', white:'FFFFFF', border:'BDC3C7',
}
const thinBorder = {
  top:   { style:'thin', color:{ argb:`FF${C.border}` } },
  left:  { style:'thin', color:{ argb:`FF${C.border}` } },
  bottom:{ style:'thin', color:{ argb:`FF${C.border}` } },
  right: { style:'thin', color:{ argb:`FF${C.border}` } },
}
const solid  = hex  => ({ type:'pattern', pattern:'solid', fgColor:{ argb:`FF${hex}` } })
const hdrFnt = ()   => ({ name:'Arial', bold:true, size:11, color:{ argb:`FF${C.white}` } })
const bodyFnt= (b)  => ({ name:'Arial', bold:!!b, size:10 })
const ctr    = ()   => ({ horizontal:'center', vertical:'middle', wrapText:true })
const lft    = ()   => ({ horizontal:'left',   vertical:'middle' })

function addTitleBlock(ws, totalCols, line1, line2, meta) {
  const last = String.fromCharCode(64 + totalCols)
  ws.mergeCells(`A1:${last}1`)
  Object.assign(ws.getCell('A1'), { value:line1, font:{ name:'Arial',bold:true,size:14,color:{argb:`FF${C.white}`} }, fill:solid(C.darkGreen), alignment:ctr() })
  ws.getRow(1).height = 28
  ws.mergeCells(`A2:${last}2`)
  Object.assign(ws.getCell('A2'), { value:line2, font:{ name:'Arial',bold:true,size:12,color:{argb:`FF${C.white}`} }, fill:solid(C.midGreen), alignment:ctr() })
  ws.getRow(2).height = 22
  meta.forEach(([lbl,val],i) => {
    ws.getCell(3, i*2+1).value = lbl; ws.getCell(3, i*2+1).font = bodyFnt(true)
    ws.getCell(3, i*2+2).value = val; ws.getCell(3, i*2+2).font = bodyFnt()
  })
  ws.getRow(3).height = 18; ws.getRow(4).height = 6
}

function buildAttendanceSheet(wb, section, sessions, enrollments) {
  const ws    = wb.addWorksheet(`Asist. ${section.code}`)
  ws.views    = [{ showGridLines:false, state:'frozen', ySplit:5 }]
  const nSess = sessions.length
  const total = 3 + nSess + 2

  ws.getColumn(1).width = 14; ws.getColumn(2).width = 24; ws.getColumn(3).width = 28
  for (let i=0; i<nSess; i++) ws.getColumn(4+i).width = 11
  ws.getColumn(4+nSess).width = 11; ws.getColumn(5+nSess).width = 11

  addTitleBlock(ws, total,
    'UAFAM — REGISTRO DE ASISTENCIA BIOMÉTRICA',
    `${section.code} — ${section.name}`,
    [['Docente:',section.professorName],['Período:',section.periodName],
     ['Generado:',new Date().toLocaleString('es-DO')],['Sesiones:',String(nSess)]]
  )

  const hRow = ws.getRow(5)
  const hdrs = ['Matrícula','Nombre','Carrera',...sessions.map(s=>new Date(s.date).toLocaleDateString('es-DO')),'Presentes','% Asist.']
  hdrs.forEach((h,i) => {
    const c = hRow.getCell(i+1)
    c.value = h; c.font = hdrFnt(); c.fill = solid(C.headerGray); c.alignment = ctr(); c.border = thinBorder
  })
  hRow.height = 30

  const DS = 6
  enrollments.forEach((enr,ri) => {
    const r   = DS+ri
    const bg  = ri%2===0 ? C.white : C.rowAlt
    const row = ws.getRow(r)
    row.getCell(1).value = enr.institutionalId
    row.getCell(2).value = enr.name
    row.getCell(3).value = enr.career ?? '—'
    ;[1,2,3].forEach(c => {
      row.getCell(c).font=bodyFnt(); row.getCell(c).fill=solid(bg); row.getCell(c).border=thinBorder
      row.getCell(c).alignment = c===1 ? ctr() : lft()
    })
    sessions.forEach((sess,si) => {
      const col  = 4+si
      const rec  = sess.attendance?.find(a => a.enrollmentId === enr.enrollmentId)
      const pres = rec?.status === 'present'
      const cell = row.getCell(col)
      cell.value = pres ? 'P' : 'A'
      cell.font  = { name:'Arial', bold:true, size:10, color:{ argb: pres ? 'FF1E8449' : 'FFC0392B' } }
      cell.fill  = solid(pres ? 'D5F5E3' : 'FADBD8')
      cell.alignment = ctr(); cell.border = thinBorder
    })
    const fsl = String.fromCharCode(67); const lsl = String.fromCharCode(67+nSess-1)
    const tc  = row.getCell(4+nSess)
    tc.value  = { formula:`COUNTIF(D${r}:${lsl}${r},"P")` }
    tc.font=bodyFnt(true); tc.fill=solid(C.lightGreen); tc.alignment=ctr(); tc.border=thinBorder
    const pc  = row.getCell(5+nSess)
    pc.value  = { formula:`${String.fromCharCode(67+nSess)}${r}/${nSess}` }
    pc.numFmt = '0.0%'; pc.font=bodyFnt(true); pc.fill=solid(C.lightGreen); pc.alignment=ctr(); pc.border=thinBorder
    row.height = 20
  })

  const sr = DS+enrollments.length
  const sumRow = ws.getRow(sr)
  sumRow.getCell(1).value='TOTALES'; sumRow.getCell(1).font=hdrFnt(); sumRow.getCell(1).fill=solid(C.headerGray); sumRow.getCell(1).alignment=ctr(); sumRow.getCell(1).border=thinBorder
  ;[2,3].forEach(c=>{ sumRow.getCell(c).fill=solid(C.headerGray); sumRow.getCell(c).border=thinBorder })
  sessions.forEach((_,si) => {
    const col=4+si; const cl=String.fromCharCode(67+si)
    const cell=sumRow.getCell(col)
    cell.value={ formula:`COUNTIF(${cl}${DS}:${cl}${sr-1},"P")` }
    cell.font=hdrFnt(); cell.fill=solid(C.midGreen); cell.alignment=ctr(); cell.border=thinBorder
  })
  ;[4+nSess,5+nSess].forEach(c=>{ sumRow.getCell(c).fill=solid(C.midGreen); sumRow.getCell(c).border=thinBorder })
  sumRow.height=22
}

function buildGradesSheet(wb, section, gradeRows) {
  const ws = wb.addWorksheet(`Notas ${section.code}`)
  ws.views = [{ showGridLines:false, state:'frozen', ySplit:5 }]
  ;[14,24,28,12,12,12,12,10,12,14,14].forEach((w,i) => { ws.getColumn(i+1).width=w })

  addTitleBlock(ws, 11,
    'UAFAM — ACTA DE CALIFICACIONES',
    `${section.code} — ${section.name}`,
    [['Docente:',section.professorName],['Período:',section.periodName],
     ['Generado:',new Date().toLocaleString('es-DO')],['Sistema:','P1(máx 25) + P2(máx 25) + Tareas(máx 20) + Examen(máx 20) + Asistencia(máx 8) = 100']]
  )

  const hdrs  = ['Matrícula','Nombre','Carrera','Parcial 1\n(/25)','Parcial 2\n(/25)','Tareas\n(/20)','Examen\n(/20)','Asistencia\n(/8)','Nota Final','Condición','Estado']
  const hfils = ['2C3E50','2C3E50','2C3E50','1A5276','1A5276','1A5276','1A5276','1E8449','1A5276','2C3E50','2C3E50']
  const hRow  = ws.getRow(5)
  hdrs.forEach((h,i) => {
    const c=hRow.getCell(i+1); c.value=h; c.font=hdrFnt(); c.fill=solid(hfils[i]); c.alignment=ctr(); c.border=thinBorder
  })
  hRow.height = 35

  const DS = 6
  gradeRows.forEach((gr,ri) => {
    const r   = DS+ri
    const bg  = ri%2===0 ? C.white : C.rowAlt
    const row = ws.getRow(r)
    row.getCell(1).value=gr.institutionalId; row.getCell(1).alignment=ctr()
    row.getCell(2).value=gr.name;            row.getCell(2).alignment=lft()
    row.getCell(3).value=gr.career??'—';     row.getCell(3).alignment=lft()
    row.getCell(4).value=gr.parcial1??null;  row.getCell(4).alignment=ctr()
    row.getCell(5).value=gr.parcial2??null;  row.getCell(5).alignment=ctr()
    row.getCell(6).value=gr.tareas??null;    row.getCell(6).alignment=ctr()
    row.getCell(7).value=gr.examen??null;    row.getCell(7).alignment=ctr()
    row.getCell(8).value=gr.asistencia??null; row.getCell(8).alignment=ctr()
    for(let c=1;c<=8;c++){ row.getCell(c).font=bodyFnt(); row.getCell(c).fill=solid(bg); row.getCell(c).border=thinBorder }
    // Nota final = suma directa (no ponderacion)
    const fg=row.getCell(9)
    fg.value={ formula:`MIN(100,D${r}+E${r}+F${r}+G${r}+H${r})` }
    fg.numFmt='0.00'; fg.font=bodyFnt(true); fg.fill=solid(C.lightGreen); fg.alignment=ctr(); fg.border=thinBorder
    const cond=row.getCell(10)
    cond.value={ formula:`IF(I${r}>=70,"Aprobado","Reprobado")` }
    cond.font=bodyFnt(true); cond.fill=solid(bg); cond.alignment=ctr(); cond.border=thinBorder
    const statusMap = { publicado:'✓ Publicado', validado:'Validado', enviado:'Enviado', borrador:'Borrador', retirado:'Retirado' }
    const stat=row.getCell(11)
    stat.value=statusMap[gr.status]??gr.status; stat.font=bodyFnt(); stat.fill=solid(bg); stat.alignment=ctr(); stat.border=thinBorder
    row.height=20
  })

  const sr = DS+gradeRows.length
  const sumRow = ws.getRow(sr)
  sumRow.getCell(1).value='PROMEDIOS'; sumRow.getCell(1).font=hdrFnt(); sumRow.getCell(1).fill=solid(C.headerGray); sumRow.getCell(1).alignment=ctr(); sumRow.getCell(1).border=thinBorder
  ;[2,3].forEach(c=>{ sumRow.getCell(c).fill=solid(C.headerGray); sumRow.getCell(c).border=thinBorder })
  ;['D','E','F','G','H','I'].forEach((col,i) => {
    const c=sumRow.getCell(4+i)
    c.value={ formula:`AVERAGE(${col}${DS}:${col}${sr-1})` }
    c.numFmt='0.00'; c.font=hdrFnt(); c.fill=solid(C.midGreen); c.alignment=ctr(); c.border=thinBorder
  })
  const ap=sumRow.getCell(10)
  ap.value={ formula:`COUNTIF(J${DS}:J${sr-1},"Aprobado")&" / ${gradeRows.length}"` }
  ap.font=hdrFnt(); ap.fill=solid(C.midGreen); ap.alignment=ctr(); ap.border=thinBorder
  ;[11].forEach(c=>{ sumRow.getCell(c).fill=solid(C.midGreen); sumRow.getCell(c).border=thinBorder })
  sumRow.height=22
}

// GET /api/export/section/:sectionId?type=attendance|grades|all
router.get('/section/:sectionId', async (req, res, next) => {
  try {
    const { sectionId } = req.params
    const type = req.query.type ?? 'all'

    const section = await prisma.section.findUnique({
      where: { id: sectionId },
      include: { course:true, professor:true, period:true },
    })
    if (!section) return res.status(404).json({ error: 'Sección no encontrada' })
    if (req.user.role === 'profesor' && section.professorId !== req.user.sub)
      return res.status(403).json({ error: 'Sin permisos' })

    const sec = {
      id:           section.id,
      code:         `${section.course.code}-0${section.sectionNo}`,
      name:         section.course.name,
      professorName:`${section.professor.firstName} ${section.professor.lastName}`,
      periodName:   section.period.name,
    }

    const wb      = new ExcelJS.Workbook()
    wb.creator    = 'UAFAM — Sistema Biométrico'
    wb.created    = new Date()

    if (type === 'attendance' || type === 'all') {
      const sessions = await prisma.classSession.findMany({
        where: { sectionId }, orderBy: { sessionNo:'asc' },
        include: { attendance: true },
      })
      const enrollments = await prisma.enrollment.findMany({
        where: { sectionId, status:'activo' },
        include: { student: { include: { career:true } } },
        orderBy: { student: { lastName:'asc' } },
      })
        const enrData = enrollments.map(e => ({
        enrollmentId:    e.id,
        institutionalId: e.student.institutionalId,
        name:            `${e.student.firstName} ${e.student.lastName}`,
        career:          e.student.career?.name,
      }))
      buildAttendanceSheet(wb, sec, sessions, enrData)
    }

    if (type === 'grades' || type === 'all') {
      const grades = await prisma.grade.findMany({
        where: { sectionId, status:{ in:['validado','publicado'] } },
        include: { student: { include: { career:true } } },
        orderBy: { student: { lastName:'asc' } },
      })
      const gradeData = grades.map(g => ({
        institutionalId: g.student.institutionalId,
        name:    `${g.student.firstName} ${g.student.lastName}`,
        career:  g.student.career?.name,
        parcial1: g.parcial1, parcial2: g.parcial2, tareas: g.tareas, examen: g.examen, asistencia: g.asistencia,
        status:  g.status,
      }))
      buildGradesSheet(wb, sec, gradeData)
    }

    const safe     = sec.code.replace(/[^a-zA-Z0-9-]/g,'_')
    const today    = new Date().toISOString().slice(0,10)
    const filename = `UAFAM_${safe}_${type}_${today}.xlsx`

    res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition',`attachment; filename="${filename}"`)
    await wb.xlsx.write(res)
    res.end()
  } catch (e) { next(e) }
})

export default router