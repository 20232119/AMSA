// src/routes/grade.routes.js
import { Router } from 'express'
import prisma from '../lib/prisma.js'
import { requireAuth, requireRole } from '../middlewares/auth.middleware.js'

const router = Router()
router.use(requireAuth)

// ── helpers ───────────────────────────────────────────────────────────────────
function clamp(val, max) {
  if (val == null) return null
  return Math.min(max, Math.max(0, parseFloat(val) || 0))
}

function calcFinal(g) {
  if (g.parcial1 == null || g.parcial2 == null || g.tareas == null || g.examen == null) return null
  const p1    = clamp(g.parcial1, 25)
  const p2    = clamp(g.parcial2, 25)
  const ta    = clamp(g.tareas,   20)
  const ex    = clamp(g.examen,   20)
  const asist = Math.min(8, g.asistencia ?? 0)
  return +Math.min(100, p1 + p2 + ta + ex + asist).toFixed(2)
}

async function getAttendancePoints(sectionId, studentId) {
  const enrollment = await prisma.enrollment.findFirst({
    where: { studentId, sectionId, status: 'activo' },
    include: { attendance: true },
  })
  if (!enrollment) return 0
  const POINTS = { present: 2, excuse: 2, late: 1, absent: 0 }
  const total = enrollment.attendance.reduce((s, a) => s + (POINTS[a.status] ?? 0), 0)
  return Math.min(8, total)
}

// ── PROFESSOR ─────────────────────────────────────────────────────────────────

// GET /api/grades/section/:sectionId
router.get('/section/:sectionId', requireRole('profesor', 'registro'), async (req, res, next) => {
  try {
    const section = await prisma.section.findUnique({ where: { id: req.params.sectionId } })
    if (!section) return res.status(404).json({ error: 'Sección no encontrada' })
    if (req.user.role === 'profesor' && section.professorId !== req.user.sub)
      return res.status(403).json({ error: 'Sin permisos' })

    const enrollments = await prisma.enrollment.findMany({
      where:   { sectionId: req.params.sectionId },
      include: { student: { include: { career: true } } },
      orderBy: { student: { lastName: 'asc' } },
    })
    const grades   = await prisma.grade.findMany({ where: { sectionId: req.params.sectionId } })
    const gradeMap = Object.fromEntries(grades.map(g => [g.studentId, g]))

    const result = enrollments.map(enr => ({
      enrollmentId:   enr.id,
      enrollmentStatus: enr.status,
      student: {
        id:             enr.student.id,
        institutionalId: enr.student.institutionalId,
        firstName:      enr.student.firstName,
        lastName:       enr.student.lastName,
        career:         enr.student.career?.name,
      },
      grade: gradeMap[enr.studentId] ?? null,
    }))
    res.json(result)
  } catch (e) { next(e) }
})

// PUT /api/grades/section/:sectionId/student/:studentId
router.put('/section/:sectionId/student/:studentId', requireRole('profesor'), async (req, res, next) => {
  try {
    const { sectionId, studentId } = req.params
    const { parcial1, parcial2, tareas, examen } = req.body

    const section = await prisma.section.findUnique({ where: { id: sectionId } })
    if (!section || section.professorId !== req.user.sub)
      return res.status(403).json({ error: 'Sin permisos' })

    // Block saving for withdrawn students
    const enrollment = await prisma.enrollment.findFirst({ where: { studentId, sectionId } })
    if (enrollment?.status === 'retirado')
      return res.status(400).json({ error: 'No se pueden guardar notas para un estudiante retirado' })

    const safe = {
      parcial1: clamp(parcial1, 25),
      parcial2: clamp(parcial2, 25),
      tareas:   clamp(tareas,   20),
      examen:   clamp(examen,   20),
      gradedById: req.user.sub,
    }

    const asistencia = await getAttendancePoints(sectionId, studentId)
    const data       = { ...safe, asistencia }
    const finalGrade = calcFinal(data)
    if (finalGrade !== null) data.finalGrade = finalGrade

    const grade = await prisma.grade.upsert({
      where:  { sectionId_studentId: { sectionId, studentId } },
      update: { ...data, status: 'borrador', updatedAt: new Date() },
      create: { sectionId, studentId, ...data, status: 'borrador' },
    })
    res.json(grade)
  } catch (e) { next(e) }
})

// POST /api/grades/section/:sectionId/submit
router.post('/section/:sectionId/submit', requireRole('profesor'), async (req, res, next) => {
  try {
    const { sectionId } = req.params
    const section = await prisma.section.findUnique({ where: { id: sectionId } })
    if (!section || section.professorId !== req.user.sub)
      return res.status(403).json({ error: 'Sin permisos' })

    // Only active enrollments must have notes — block if any active student has empty grade
    const enrollments = await prisma.enrollment.findMany({
      where: { sectionId },
      include: { student: true },
    })
    const active = enrollments.filter(e => e.status === 'activo')
    const grades = await prisma.grade.findMany({ where: { sectionId } })
    const gradeMap = Object.fromEntries(grades.map(g => [g.studentId, g]))

    const missing = active.filter(enr => {
      const g = gradeMap[enr.studentId]
      return !g || g.parcial1 == null || g.parcial2 == null || g.tareas == null || g.examen == null
    })
    if (missing.length > 0) {
      return res.status(400).json({
        error: `Faltan notas para: ${missing.map(e => `${e.student.firstName} ${e.student.lastName}`).join(', ')}`,
        missing: missing.map(e => e.studentId),
      })
    }

    // Upsert for all enrollments (active → enviado, retirado → keep as retirado)
    for (const enr of enrollments) {
      if (enr.status === 'retirado') continue
      await prisma.grade.upsert({
        where:  { sectionId_studentId: { sectionId, studentId: enr.studentId } },
        update: { status: 'enviado' },
        create: { sectionId, studentId: enr.studentId, gradedById: req.user.sub, status: 'enviado' },
      })
    }
    res.json({ ok: true })
  } catch (e) { next(e) }
})

// POST /api/grades/section/:sectionId/reopen — professor reopens rejected grades
router.post('/section/:sectionId/reopen', requireRole('profesor'), async (req, res, next) => {
  try {
    const { sectionId } = req.params
    const section = await prisma.section.findUnique({ where: { id: sectionId } })
    if (!section || section.professorId !== req.user.sub)
      return res.status(403).json({ error: 'Sin permisos' })

    const updated = await prisma.grade.updateMany({
      where: { sectionId, status: 'rechazado' },
      data:  { status: 'borrador', rejectedAt: null, rejectedById: null },
    })
    if (updated.count === 0)
      return res.status(400).json({ error: 'No hay notas rechazadas para reabrir' })

    res.json({ ok: true, reopened: updated.count })
  } catch (e) { next(e) }
})

// ── REGISTRO ──────────────────────────────────────────────────────────────────

// GET /api/grades/registro/pendientes
router.get('/registro/pendientes', requireRole('registro'), async (req, res, next) => {
  try {
    const sections = await prisma.section.findMany({
      where: { isActive: true },
      include: {
        course: true, period: true,
        professor: { select: { id: true, firstName: true, lastName: true } },
        enrollments: { include: { student: true } },
        grades: true,
      },
      orderBy: { createdAt: 'desc' },
    })
    res.json(sections)
  } catch (e) { next(e) }
})

// PATCH /api/grades/:gradeId/validate
router.patch('/:gradeId/validate', requireRole('registro'), async (req, res, next) => {
  try {
    const grade = await prisma.grade.update({
      where: { id: req.params.gradeId },
      data:  { status: 'validado', validatedById: req.user.sub, validatedAt: new Date() },
    })
    res.json(grade)
  } catch (e) { next(e) }
})

// PATCH /api/grades/:gradeId/reject — registro rejects a grade back to professor
router.patch('/:gradeId/reject', requireRole('registro'), async (req, res, next) => {
  try {
    const { reason } = req.body
    const grade = await prisma.grade.update({
      where: { id: req.params.gradeId },
      data:  {
        status:       'rechazado',
        rejectedById: req.user.sub,
        rejectedAt:   new Date(),
        // store reason in a note if needed — for now just status
      },
    })
    res.json(grade)
  } catch (e) { next(e) }
})

// POST /api/grades/section/:sectionId/reject-all — reject entire section
router.post('/section/:sectionId/reject-all', requireRole('registro'), async (req, res, next) => {
  try {
    const updated = await prisma.grade.updateMany({
      where: { sectionId: req.params.sectionId, status: { in: ['enviado', 'validado'] } },
      data:  { status: 'rechazado', rejectedById: req.user.sub, rejectedAt: new Date() },
    })
    res.json({ ok: true, rejected: updated.count })
  } catch (e) { next(e) }
})

// POST /api/grades/section/:sectionId/publish
router.post('/section/:sectionId/publish', requireRole('registro'), async (req, res, next) => {
  try {
    await prisma.grade.updateMany({
      where: { sectionId: req.params.sectionId, status: 'validado' },
      data:  { status: 'publicado', publishedAt: new Date() },
    })
    res.json({ ok: true })
  } catch (e) { next(e) }
})

// PATCH /api/grades/enrollment/:enrollmentId/status — toggle activo/retirado
router.patch('/enrollment/:enrollmentId/status', requireRole('registro'), async (req, res, next) => {
  try {
    const { status } = req.body
    if (!['activo', 'retirado'].includes(status))
      return res.status(400).json({ error: 'Estado inválido. Usa: activo o retirado' })

    const enrollment = await prisma.enrollment.update({
      where: { id: req.params.enrollmentId },
      data:  { status },
      include: { student: true },
    })

    // If withdrawn, mark their grade as retirado too
    if (status === 'retirado') {
      await prisma.grade.updateMany({
        where: { sectionId: enrollment.sectionId, studentId: enrollment.studentId, status: { in: ['borrador', 'enviado'] } },
        data:  { status: 'retirado' },
      })
    }
    // If reactivated, reset grade to borrador
    if (status === 'activo') {
      await prisma.grade.updateMany({
        where: { sectionId: enrollment.sectionId, studentId: enrollment.studentId, status: 'retirado' },
        data:  { status: 'borrador' },
      })
    }
    res.json(enrollment)
  } catch (e) { next(e) }
})

// PATCH /api/grades/section/:sectionId/allow-manual — registro toggles manual present permission
router.patch('/section/:sectionId/allow-manual', requireRole('registro'), async (req, res, next) => {
  try {
    const { allow } = req.body
    const section = await prisma.section.update({
      where: { id: req.params.sectionId },
      data:  { allowManualPresent: !!allow },
    })
    res.json({ ok: true, allowManualPresent: section.allowManualPresent })
  } catch (e) { next(e) }
})

// ── STUDENT ───────────────────────────────────────────────────────────────────

// GET /api/grades/student/mine
router.get('/student/mine', requireRole('estudiante'), async (req, res, next) => {
  try {
    const grades = await prisma.grade.findMany({
      where:   { studentId: req.user.sub, status: 'publicado' },
      include: { section: { include: { course: true, professor: true, period: true } } },
    })
    res.json(grades)
  } catch (e) { next(e) }
})

export default router