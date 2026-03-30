// src/routes/attendance.routes.js
import { Router } from 'express'
import prisma from '../lib/prisma.js'
import { requireAuth, requireRole } from '../middlewares/auth.middleware.js'

const router = Router()
router.use(requireAuth)

const ATTENDANCE_POINTS = { present: 2, excuse: 2, late: 1, absent: 0 }
const VALID_STATUSES    = ['present', 'absent', 'excuse', 'late']

function generateSessionDates(startDate) {
  const base = new Date(startDate)
  return [0, 7, 14, 21].map(offset => {
    const d = new Date(base)
    d.setDate(d.getDate() + offset)
    return d
  })
}

async function calcAttendancePoints(sectionId, studentId) {
  const enrollment = await prisma.enrollment.findFirst({
    where: { studentId, sectionId, status: 'activo' },
    include: { attendance: true },
  })
  if (!enrollment) return 0
  const total = enrollment.attendance.reduce((sum, a) => sum + (ATTENDANCE_POINTS[a.status] ?? 0), 0)
  return Math.min(8, total)
}

async function ensureSessions(sectionId) {
  const section = await prisma.section.findUnique({
    where: { id: sectionId },
    include: { classSessions: { orderBy: { sessionNo: 'asc' } } },
  })
  if (!section) return []
  if (section.classSessions.length >= 4) return section.classSessions

  const startDate = section.startDate ?? section.createdAt
  const dates     = generateSessionDates(startDate)
  const existingNos = section.classSessions.map(s => s.sessionNo)

  for (let i = 1; i <= 4; i++) {
    if (!existingNos.includes(i)) {
      await prisma.classSession.create({
        data: { sectionId, sessionNo: i, date: dates[i - 1], topic: `Sesión ${i}`, status: 'open' },
      })
    }
  }

  return prisma.classSession.findMany({ where: { sectionId }, orderBy: { sessionNo: 'asc' } })
}

// GET /api/attendance/sections/:sectionId/board
router.get('/sections/:sectionId/board', requireRole('profesor', 'registro'), async (req, res, next) => {
  try {
    const { sectionId } = req.params
    const section = await prisma.section.findUnique({
      where: { id: sectionId },
      include: { course: true, period: true, professor: { select: { firstName: true, lastName: true } } },
    })
    if (!section) return res.status(404).json({ error: 'Sección no encontrada' })
    if (req.user.role === 'profesor' && section.professorId !== req.user.sub)
      return res.status(403).json({ error: 'Sin permisos' })

    const sessions = await ensureSessions(sectionId)
    const enrollments = await prisma.enrollment.findMany({
      where: { sectionId, status: 'activo' },
      include: {
        student: { select: { id: true, institutionalId: true, firstName: true, lastName: true } },
        attendance: { include: { session: true } },
      },
      orderBy: { student: { lastName: 'asc' } },
    })

    const students = enrollments.map(enr => {
      const attMap = Object.fromEntries(enr.attendance.map(a => [a.sessionId, a]))
      const sessionData = sessions.map(sess => ({
        sessionId:    sess.id,
        sessionNo:    sess.sessionNo,
        attendanceId: attMap[sess.id]?.id ?? null,
        status:       attMap[sess.id]?.status ?? 'absent',
        method:       attMap[sess.id]?.method ?? null,
        markedAt:     attMap[sess.id]?.markedAt ?? null,
      }))
      const points = sessionData.reduce((s, sd) => s + (ATTENDANCE_POINTS[sd.status] ?? 0), 0)
      return {
        enrollmentId:    enr.id,
        studentId:       enr.student.id,
        institutionalId: enr.student.institutionalId,
        name:            `${enr.student.firstName} ${enr.student.lastName}`,
        sessions:        sessionData,
        totalPoints:     Math.min(8, points),
      }
    })

    res.json({
      sectionId,
      courseName: section.course.name,
      courseCode: section.course.code,
      sectionNo:  section.sectionNo,
      professor:  `${section.professor.firstName} ${section.professor.lastName}`,
      period:     section.period.name,
      sessions:   sessions.map(s => ({ id: s.id, sessionNo: s.sessionNo, date: s.date, topic: s.topic, status: s.status })),
      students,
    })
  } catch (e) { next(e) }
})

// PATCH /api/attendance/record — professor updates a student's status
router.patch('/record', requireRole('profesor'), async (req, res, next) => {
  try {
    const { enrollmentId, sessionId, status } = req.body
    if (!VALID_STATUSES.includes(status))
      return res.status(400).json({ error: `Estado inválido. Usa: ${VALID_STATUSES.join(', ')}` })

    const session = await prisma.classSession.findUnique({ where: { id: sessionId }, include: { section: true } })
    if (!session) return res.status(404).json({ error: 'Sesión no encontrada' })
    if (session.section.professorId !== req.user.sub)
      return res.status(403).json({ error: 'Sin permisos' })

    // Block manual 'present' unless registro has granted permission
    if (status === 'present' && !session.section.allowManualPresent)
      return res.status(403).json({
        error: 'No tienes permiso para marcar Presente manualmente. Contacta a Registro si el sistema biométrico no funciona.',
        code: 'MANUAL_PRESENT_DENIED',
      })

    const record = await prisma.attendance.upsert({
      where:  { enrollmentId_sessionId: { enrollmentId, sessionId } },
      update: { status, method: 'manual', markedAt: new Date() },
      create: { enrollmentId, sessionId, status, method: 'manual', markedAt: new Date() },
    })

    const enrollment = await prisma.enrollment.findUnique({ where: { id: enrollmentId } })
    const points = await calcAttendancePoints(session.sectionId, enrollment.studentId)
    await prisma.grade.upsert({
      where:  { sectionId_studentId: { sectionId: session.sectionId, studentId: enrollment.studentId } },
      update: { asistencia: points },
      create: { sectionId: session.sectionId, studentId: enrollment.studentId, asistencia: points },
    })

    res.json({ record, attendancePoints: points })
  } catch (e) { next(e) }
})

// POST /api/attendance/sections/:sectionId/set-date
router.post('/sections/:sectionId/set-date', requireRole('profesor'), async (req, res, next) => {
  try {
    const { sectionId } = req.params
    const { startDate } = req.body
    if (!startDate) return res.status(400).json({ error: 'startDate requerido' })

    const section = await prisma.section.findUnique({ where: { id: sectionId } })
    if (!section || section.professorId !== req.user.sub)
      return res.status(403).json({ error: 'Sin permisos' })

    await prisma.section.update({ where: { id: sectionId }, data: { startDate: new Date(startDate) } })

    const existing = await prisma.classSession.findMany({ where: { sectionId } })
    for (const sess of existing) await prisma.attendance.deleteMany({ where: { sessionId: sess.id } })
    await prisma.classSession.deleteMany({ where: { sectionId } })

    const dates = generateSessionDates(new Date(startDate))
    for (let i = 1; i <= 4; i++) {
      await prisma.classSession.create({
        data: { sectionId, sessionNo: i, date: dates[i - 1], topic: `Sesión ${i}`, status: 'open' },
      })
    }
    res.json({ ok: true })
  } catch (e) { next(e) }
})

// GET /api/attendance/open — student: open sessions
router.get('/open', requireRole('estudiante'), async (req, res, next) => {
  try {
    const enrollments = await prisma.enrollment.findMany({
      where: { studentId: req.user.sub, status: 'activo' }, select: { sectionId: true },
    })
    const sectionIds = enrollments.map(e => e.sectionId)
    const sessions   = await prisma.classSession.findMany({
      where: { sectionId: { in: sectionIds }, status: 'open' },
      include: { section: { include: { course: true, professor: true } } },
    })
    res.json(sessions)
  } catch (e) { next(e) }
})

// POST /api/attendance/mark — student biometric mark
router.post('/mark', requireRole('estudiante'), async (req, res, next) => {
  try {
    const { sessionId } = req.body
    const session = await prisma.classSession.findUnique({ where: { id: sessionId } })
    if (!session || session.status !== 'open')
      return res.status(400).json({ error: 'Sesión no disponible' })

    const enrollment = await prisma.enrollment.findFirst({
      where: { studentId: req.user.sub, sectionId: session.sectionId, status: 'activo' },
    })
    if (!enrollment) return res.status(403).json({ error: 'No estás inscrito en esta sección' })

    const existing = await prisma.attendance.findUnique({
      where: { enrollmentId_sessionId: { enrollmentId: enrollment.id, sessionId } },
    })
    if (existing && ['excuse', 'late'].includes(existing.status))
      return res.json({ record: existing, message: 'Ya tienes un estado asignado por el profesor' })

    const record = await prisma.attendance.upsert({
      where:  { enrollmentId_sessionId: { enrollmentId: enrollment.id, sessionId } },
      update: { status: 'present', method: 'biometric', markedAt: new Date() },
      create: { enrollmentId: enrollment.id, sessionId, status: 'present', method: 'biometric', markedAt: new Date() },
    })

    const points = await calcAttendancePoints(session.sectionId, req.user.sub)
    await prisma.grade.upsert({
      where:  { sectionId_studentId: { sectionId: session.sectionId, studentId: req.user.sub } },
      update: { asistencia: points },
      create: { sectionId: session.sectionId, studentId: req.user.sub, asistencia: points },
    })
    res.json({ record, attendancePoints: points })
  } catch (e) { next(e) }
})

// GET /api/attendance/history — student history
router.get('/history', requireRole('estudiante'), async (req, res, next) => {
  try {
    const enrollments = await prisma.enrollment.findMany({
      where: { studentId: req.user.sub, status: 'activo' },
      include: {
        section: { include: { course: true, classSessions: { orderBy: { sessionNo: 'asc' } } } },
        attendance: { include: { session: true } },
      },
    })
    const result = enrollments.map(enr => {
      const attMap = Object.fromEntries(enr.attendance.map(a => [a.sessionId, a]))
      const points = enr.attendance.reduce((s, a) => s + (ATTENDANCE_POINTS[a.status] ?? 0), 0)
      return {
        sectionId:     enr.section.id,
        courseName:    enr.section.course.name,
        courseCode:    enr.section.course.code,
        totalSessions: enr.section.classSessions.length,
        totalPoints:   Math.min(8, points),
        sessions: enr.section.classSessions.map(sess => ({
          sessionId: sess.id, sessionNo: sess.sessionNo, date: sess.date, topic: sess.topic,
          status:    attMap[sess.id]?.status ?? 'absent',
          method:    attMap[sess.id]?.method ?? null,
          points:    ATTENDANCE_POINTS[attMap[sess.id]?.status ?? 'absent'] ?? 0,
        })),
      }
    })
    res.json(result)
  } catch (e) { next(e) }
})

// GET /api/attendance/sections/:sectionId/sessions — compatibility
router.get('/sections/:sectionId/sessions', async (req, res, next) => {
  try {
    const sessions = await prisma.classSession.findMany({
      where: { sectionId: req.params.sectionId },
      include: { attendance: { include: { enrollment: { include: { student: true } } } } },
      orderBy: { sessionNo: 'asc' },
    })
    res.json(sessions)
  } catch (e) { next(e) }
})

export default router