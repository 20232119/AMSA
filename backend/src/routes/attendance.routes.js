import { Router } from 'express'
import prisma from '../lib/prisma.js'
import { requireAuth, requireRole } from '../middlewares/auth.middleware.js'

const router = Router()
router.use(requireAuth)

const ATTENDANCE_POINTS = {
  present: 2,
  excuse: 2,
  late: 1,
  absent: 0,
  pending: 0,
}

const VALID_STATUSES = ['present', 'absent', 'excuse', 'late']

function parseLocalDate(dateStr) {
  if (!dateStr) return null

  if (dateStr instanceof Date) {
    const d = new Date(dateStr)
    d.setHours(0, 0, 0, 0)
    return d
  }

  const raw = String(dateStr).trim()

  // yyyy-mm-dd
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [y, m, d] = raw.split('-').map(Number)
    const local = new Date(y, m - 1, d)
    local.setHours(0, 0, 0, 0)
    return local
  }

  // dd/mm/yyyy
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) {
    const [d, m, y] = raw.split('/').map(Number)
    const local = new Date(y, m - 1, d)
    local.setHours(0, 0, 0, 0)
    return local
  }

  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) return null

  parsed.setHours(0, 0, 0, 0)
  return parsed
}

function generateSessionDates(startDate) {
  const base = parseLocalDate(startDate)
  return [0, 7, 14, 21].map((offset) => {
    const d = new Date(base)
    d.setDate(d.getDate() + offset)
    d.setHours(0, 0, 0, 0)
    return d
  })
}

function buildSessionWindow(baseDate) {
  const date = parseLocalDate(baseDate)

  const startAt = new Date(date)
  startAt.setHours(18, 0, 0, 0)

  const endAt = new Date(date)
  endAt.setHours(20, 0, 0, 0)

  return { startAt, endAt }
}

function getDayRange(baseDate = new Date()) {
  const startOfDay = new Date(baseDate)
  startOfDay.setHours(0, 0, 0, 0)

  const endOfDay = new Date(startOfDay)
  endOfDay.setDate(endOfDay.getDate() + 1)

  return { startOfDay, endOfDay }
}

async function calcAttendancePoints(sectionId, studentId) {
  const enrollment = await prisma.enrollment.findFirst({
    where: { studentId, sectionId, status: 'activo' },
    include: { attendance: true },
  })

  if (!enrollment) return 0

  const total = enrollment.attendance.reduce(
    (sum, a) => sum + (ATTENDANCE_POINTS[a.status] ?? 0),
    0
  )

  return Math.min(8, total)
}

async function getSessions(sectionId) {
  return prisma.classSession.findMany({
    where: { sectionId },
    orderBy: { sessionNo: 'asc' },
  })
}

// GET /api/attendance/sections/:sectionId/board
router.get(
  '/sections/:sectionId/board',
  requireRole('profesor', 'registro'),
  async (req, res, next) => {
    try {
      const { sectionId } = req.params

      const section = await prisma.section.findUnique({
        where: { id: sectionId },
        include: {
          course: true,
          period: true,
          professor: { select: { id: true, firstName: true, lastName: true } },
        },
      })

      if (!section) {
        return res.status(404).json({ error: 'Sección no encontrada' })
      }

      if (req.user.role === 'profesor' && section.professorId !== req.user.sub) {
        return res.status(403).json({
          error: `No tienes permisos para esta sección. Profesor asignado: ${section.professor.firstName} ${section.professor.lastName}`,
        })
      }

      const sessions = await getSessions(sectionId)

      const enrollments = await prisma.enrollment.findMany({
        where: { sectionId, status: 'activo' },
        include: {
          student: {
            select: {
              id: true,
              institutionalId: true,
              firstName: true,
              lastName: true,
            },
          },
          attendance: { include: { session: true } },
        },
        orderBy: { student: { lastName: 'asc' } },
      })

      const students = enrollments.map((enr) => {
        const attMap = Object.fromEntries(enr.attendance.map((a) => [a.sessionId, a]))

        const sessionData = sessions.map((sess) => ({
          sessionId: sess.id,
          sessionNo: sess.sessionNo,
          attendanceId: attMap[sess.id]?.id ?? null,
          status: attMap[sess.id]?.status ?? 'absent',
          method: attMap[sess.id]?.method ?? null,
          markedAt: attMap[sess.id]?.markedAt ?? null,
        }))

        const points = sessionData.reduce(
          (s, sd) => s + (ATTENDANCE_POINTS[sd.status] ?? 0),
          0
        )

        return {
          enrollmentId: enr.id,
          studentId: enr.student.id,
          institutionalId: enr.student.institutionalId,
          name: `${enr.student.firstName} ${enr.student.lastName}`,
          sessions: sessionData,
          totalPoints: Math.min(8, points),
        }
      })

      res.json({
        sectionId,
        courseName: section.course.name,
        courseCode: section.course.code,
        sectionNo: section.sectionNo,
        professor: `${section.professor.firstName} ${section.professor.lastName}`,
        period: section.period.name,
        sessions: sessions.map((s) => ({
          id: s.id,
          sessionNo: s.sessionNo,
          date: s.date,
          topic: s.topic,
          status: s.status,
          startAt: s.startAt,
          endAt: s.endAt,
        })),
        students,
      })
    } catch (e) {
      next(e)
    }
  }
)

// PATCH /api/attendance/record
router.patch('/record', requireRole('profesor'), async (req, res, next) => {
  try {
    const { enrollmentId, sessionId, status } = req.body

    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({
        error: `Estado inválido. Usa: ${VALID_STATUSES.join(', ')}`,
      })
    }

    const session = await prisma.classSession.findUnique({
      where: { id: sessionId },
      include: { section: true },
    })

    if (!session) {
      return res.status(404).json({ error: 'Sesión no encontrada' })
    }

    if (session.section.professorId !== req.user.sub) {
      return res.status(403).json({ error: 'No tienes permisos para modificar esta sesión.' })
    }

    if (status === 'present' && !session.section.allowManualPresent) {
      return res.status(403).json({
        error:
          'No tienes permiso para marcar Presente manualmente. Contacta a Registro si el sistema biométrico no funciona.',
        code: 'MANUAL_PRESENT_DENIED',
      })
    }

    const record = await prisma.attendance.upsert({
      where: { enrollmentId_sessionId: { enrollmentId, sessionId } },
      update: { status, method: 'manual', markedAt: new Date() },
      create: { enrollmentId, sessionId, status, method: 'manual', markedAt: new Date() },
    })

    const enrollment = await prisma.enrollment.findUnique({ where: { id: enrollmentId } })
    const points = await calcAttendancePoints(session.sectionId, enrollment.studentId)

    await prisma.grade.upsert({
      where: {
        sectionId_studentId: {
          sectionId: session.sectionId,
          studentId: enrollment.studentId,
        },
      },
      update: { asistencia: points },
      create: {
        sectionId: session.sectionId,
        studentId: enrollment.studentId,
        asistencia: points,
      },
    })

    res.json({ record, attendancePoints: points })
  } catch (e) {
    next(e)
  }
})

// POST /api/attendance/sections/:sectionId/set-date
router.post(
 '/sections/:sectionId/set-date',
  requireAuth,
  requireRole('registro'),
  async (req, res, next)  => {
    try {
      const { sectionId } = req.params
      const { startDate } = req.body

      if (!startDate) {
        return res.status(400).json({ error: 'startDate requerido' })
      }

      const normalizedStartDate = parseLocalDate(startDate)
      if (!normalizedStartDate) {
        return res.status(400).json({ error: 'Fecha inválida' })
      }

      const section = await prisma.section.findUnique({
        where: { id: sectionId },
        include: {
          professor: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
      })

      if (!section) {
        return res.status(404).json({ error: 'Sección no encontrada' })
      }

      await prisma.section.update({
        where: { id: sectionId },
        data: { startDate: normalizedStartDate },
      })

      const existing = await prisma.classSession.findMany({ where: { sectionId } })

      for (const sess of existing) {
        await prisma.attendance.deleteMany({ where: { sessionId: sess.id } })
      }

      await prisma.classSession.deleteMany({ where: { sectionId } })

      const dates = generateSessionDates(normalizedStartDate)

      for (let i = 1; i <= 4; i++) {
        const { startAt, endAt } = buildSessionWindow(dates[i - 1])

        await prisma.classSession.create({
          data: {
            sectionId,
            sessionNo: i,
            date: dates[i - 1],
            topic: `Sesión ${i}`,
            status: 'open',
            startAt,
            endAt,
          },
        })
      }
      
      if (section.attendanceLocked && !forceEdit) {
         return res.status(409).json({
         error: 'La asistencia de esta sección está bloqueada. Solo puede modificarse mediante edición justificada.',
        })
      }  

      res.json({ ok: true })
    } catch (e) {
      next(e)
    }
  }
)

// GET /api/attendance/open
router.get('/open', requireRole('estudiante'), async (req, res, next) => {
  try {
    const { startOfDay, endOfDay } = getDayRange(new Date())

    const enrollments = await prisma.enrollment.findMany({
      where: { studentId: req.user.sub, status: 'activo' },
      select: { id: true, sectionId: true },
    })

    const sectionIds = enrollments.map((e) => e.sectionId)
    const enrollmentIds = enrollments.map((e) => e.id)

    if (sectionIds.length === 0) {
      return res.json([])
    }

    const sessions = await prisma.classSession.findMany({
      where: {
        sectionId: { in: sectionIds },
        status: 'open',
        date: {
          gte: startOfDay,
          lt: endOfDay,
        },
        attendance: {
          none: {
            enrollmentId: { in: enrollmentIds },
          },
        },
      },
      include: {
        section: {
          include: {
            course: true,
            professor: true,
          },
        },
      },
      orderBy: [{ date: 'asc' }, { sessionNo: 'asc' }],
    })

    res.json(sessions)
  } catch (e) {
    next(e)
  }
})

// POST /api/attendance/mark
router.post('/mark', requireRole('estudiante'), async (req, res, next) => {
  try {
    const { sessionId } = req.body

    const session = await prisma.classSession.findUnique({
      where: { id: sessionId },
    })

    if (!session) {
      return res.status(400).json({ error: 'Sesión no disponible' })
    }

    const enrollment = await prisma.enrollment.findFirst({
      where: {
        studentId: req.user.sub,
        sectionId: session.sectionId,
        status: 'activo',
      },
    })

    if (!enrollment) {
      return res.status(403).json({ error: 'No estás inscrito en esta sección' })
    }

    const existing = await prisma.attendance.findUnique({
      where: {
        enrollmentId_sessionId: {
          enrollmentId: enrollment.id,
          sessionId,
        },
      },
    })

    if (existing && ['excuse', 'late'].includes(existing.status)) {
      return res.json({
        record: existing,
        message: 'Ya tienes un estado asignado por el profesor',
      })
    }

    const { startOfDay, endOfDay } = getDayRange(new Date())
    const sessionDate = new Date(session.date)

    if (!(sessionDate >= startOfDay && sessionDate < endOfDay)) {
      return res.status(400).json({
        error: 'Esta sesión no corresponde al día de hoy',
      })
    }

    const computedStatus = 'present'

    const record = await prisma.attendance.upsert({
      where: {
        enrollmentId_sessionId: {
          enrollmentId: enrollment.id,
          sessionId,
        },
      },
      update: {
        status: computedStatus,
        method: 'biometric',
        markedAt: new Date(),
      },
      create: {
        enrollmentId: enrollment.id,
        sessionId,
        status: computedStatus,
        method: 'biometric',
        markedAt: new Date(),
      },
    })

    const points = await calcAttendancePoints(session.sectionId, req.user.sub)

    await prisma.grade.upsert({
      where: {
        sectionId_studentId: {
          sectionId: session.sectionId,
          studentId: req.user.sub,
        },
      },
      update: { asistencia: points },
      create: {
        sectionId: session.sectionId,
        studentId: req.user.sub,
        asistencia: points,
      },
    })

    res.json({
      record,
      attendancePoints: points,
      autoStatus: computedStatus,
    })
  } catch (e) {
    next(e)
  }
})

// GET /api/attendance/history
router.get('/history', requireRole('estudiante'), async (req, res, next) => {
  try {
    const enrollments = await prisma.enrollment.findMany({
      where: { studentId: req.user.sub, status: 'activo' },
      include: {
        section: {
          include: {
            course: true,
            classSessions: { orderBy: { sessionNo: 'asc' } },
          },
        },
        attendance: {
          include: { session: true },
          orderBy: { session: { sessionNo: 'asc' } },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    const result = enrollments.map((enr) => {
      const sessions = enr.section.classSessions.map((sess) => {
        const att = enr.attendance.find((a) => a.sessionId === sess.id)
        const status = att?.status ?? 'absent'

        return {
          sessionId: sess.id,
          sessionNo: sess.sessionNo,
          date: sess.date,
          status,
          points: ATTENDANCE_POINTS[status] ?? 0,
        }
      })

      const totalPoints = Math.min(
        8,
        sessions.reduce((sum, s) => sum + s.points, 0)
      )

      return {
        sectionId: enr.sectionId,
        courseName: enr.section.course.name,
        courseCode: enr.section.course.code,
        totalSessions: enr.section.classSessions.length,
        totalPoints,
        sessions,
      }
    })

    res.json(result)
  } catch (e) {
    next(e)
  }
})

export default router