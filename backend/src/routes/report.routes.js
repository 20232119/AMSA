// src/routes/report.routes.js
// Sprint 5 — Reportes académicos consolidados
import { Router } from 'express'
import prisma from '../lib/prisma.js'
import { requireAuth, requireRole } from '../middlewares/auth.middleware.js'

const router = Router()
router.use(requireAuth)
router.use(requireRole('registro'))

// ─── GET /api/reports/overview ────────────────────────────────────────────────
// Totals summary for the dashboard stat cards
router.get('/overview', async (req, res, next) => {
  try {
    const [students, sections, pendingGrades, exports] = await Promise.all([
      prisma.user.count({ where: { role: { name: 'estudiante' }, isActive: true } }),
      prisma.section.count({ where: { isActive: true } }),
      prisma.grade.count({ where: { status: 'enviado' } }),
      prisma.auditLog.count({ where: { action: 'EXPORT_XLSX' } }),
    ])
    res.json({ students, sections, pendingGrades, exports })
  } catch (e) { next(e) }
})

// ─── GET /api/reports/attendance?periodId=&sectionId= ─────────────────────────
// Consolidated attendance report
router.get('/attendance', async (req, res, next) => {
  try {
    const { periodId, sectionId } = req.query

    const where = { isActive: true }
    if (periodId)  where.periodId  = parseInt(periodId)
    if (sectionId) where.id        = sectionId

    const sections = await prisma.section.findMany({
      where,
      include: {
        course:    true,
        professor: { select: { firstName: true, lastName: true } },
        period:    true,
        enrollments: {
          where: { status: 'activo' },
          include: {
            student: { select: { id: true, firstName: true, lastName: true, institutionalId: true } },
            attendance: { include: { session: true } },
          },
        },
        classSessions: { orderBy: { sessionNo: 'asc' } },
      },
      orderBy: { course: { name: 'asc' } },
    })

    const result = sections.map(sec => {
      const totalSessions = sec.classSessions.length
      const POINTS = { present: 2, excuse: 2, late: 1, absent: 0 }
      const students = sec.enrollments.map(enr => {
        const present = enr.attendance.filter(a => a.status === 'present').length
        const excuse  = enr.attendance.filter(a => a.status === 'excuse').length
        const late    = enr.attendance.filter(a => a.status === 'late').length
        const absent  = enr.attendance.filter(a => a.status === 'absent').length
        const attended = present + excuse + late
        const points  = Math.min(8, present*2 + excuse*2 + late*1)
        const pct     = totalSessions > 0 ? Math.round((attended / totalSessions) * 100) : 0
        return {
          id:             enr.student.id,
          institutionalId: enr.student.institutionalId,
          name:           `${enr.student.firstName} ${enr.student.lastName}`,
          present, excuse, late, absent,
          attended,
          totalSessions,
          attendancePoints: points,
          percentage:     pct,
          risk:           pct < 75,
        }
      })
      const avg = students.length
        ? Math.round(students.reduce((s, st) => s + st.percentage, 0) / students.length)
        : 0
      return {
        sectionId:    sec.id,
        code:         `${sec.course.code}-0${sec.sectionNo}`,
        courseName:   sec.course.name,
        professor:    `${sec.professor.firstName} ${sec.professor.lastName}`,
        period:       sec.period.name,
        totalSessions,
        totalStudents: students.length,
        atRisk:        students.filter(s => s.risk).length,
        avgAttendance: avg,
        students,
      }
    })

    res.json(result)
  } catch (e) { next(e) }
})

// ─── GET /api/reports/grades?periodId=&sectionId= ─────────────────────────────
// Consolidated academic performance report
router.get('/grades', async (req, res, next) => {
  try {
    const { periodId, sectionId } = req.query

    const where = { isActive: true }
    if (periodId)  where.periodId  = parseInt(periodId)
    if (sectionId) where.id        = sectionId

    const sections = await prisma.section.findMany({
      where,
      include: {
        course:    true,
        professor: { select: { firstName: true, lastName: true } },
        period:    true,
        grades: {
          where:   { status: { in: ['validado', 'publicado'] } },
          include: { student: { select: { institutionalId: true, firstName: true, lastName: true } } },
        },
        enrollments: { where: { status: 'activo' } },
      },
      orderBy: { course: { name: 'asc' } },
    })

    const result = sections.map(sec => {
      const grades       = sec.grades
      const totalEnrolled = sec.enrollments.length
      const approved     = grades.filter(g => (g.finalGrade ?? 0) >= 70).length
      const failed       = grades.filter(g => (g.finalGrade ?? 0) < 70 && g.finalGrade != null).length
      const avgFinal     = grades.length
        ? +(grades.reduce((s, g) => s + (g.finalGrade ?? 0), 0) / grades.length).toFixed(2)
        : null
      return {
        sectionId:     sec.id,
        code:          `${sec.course.code}-0${sec.sectionNo}`,
        courseName:    sec.course.name,
        professor:     `${sec.professor.firstName} ${sec.professor.lastName}`,
        period:        sec.period.name,
        totalEnrolled,
        graded:        grades.length,
        approved,
        failed,
        pending:       totalEnrolled - grades.length,
        passRate:      grades.length ? Math.round((approved / grades.length) * 100) : 0,
        avgFinal,
        grades: grades.map(g => ({
          institutionalId: g.student.institutionalId,
          name:           `${g.student.firstName} ${g.student.lastName}`,
          parcial1:        g.parcial1,
          parcial2:        g.parcial2,
          tareas:          g.tareas,
          examen:          g.examen,
          finalGrade:      g.finalGrade,
          status:          g.status,
          passed:         (g.finalGrade ?? 0) >= 70,
        })),
      }
    })

    res.json(result)
  } catch (e) { next(e) }
})

// ─── GET /api/reports/periods ─────────────────────────────────────────────────
router.get('/periods', async (_req, res, next) => {
  try {
    const periods = await prisma.period.findMany({ orderBy: { startDate: 'desc' } })
    res.json(periods)
  } catch (e) { next(e) }
})

export default router