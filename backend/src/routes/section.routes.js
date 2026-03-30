// src/routes/section.routes.js
import { Router } from 'express'
import prisma from '../lib/prisma.js'
import { requireAuth, requireRole } from '../middlewares/auth.middleware.js'

const router = Router()
router.use(requireAuth)

const sectionInclude = {
  course: true, professor: true, period: true,
  enrollments: { include: { student: { include: { career: true } } } },
}

// GET /api/sections  — profesor gets own, registro gets all
router.get('/', async (req, res, next) => {
  try {
    const where = req.user.role === 'profesor'
      ? { professorId: req.user.sub, isActive: true }
      : { isActive: true }
    const sections = await prisma.section.findMany({
      where, include: sectionInclude, orderBy: { createdAt: 'desc' },
    })
    res.json(sections)
  } catch (e) { next(e) }
})

// GET /api/sections/:id
router.get('/:id', async (req, res, next) => {
  try {
    const section = await prisma.section.findUnique({
      where: { id: req.params.id }, include: sectionInclude,
    })
    if (!section) return res.status(404).json({ error: 'Sección no encontrada' })
    if (req.user.role === 'profesor' && section.professorId !== req.user.sub)
      return res.status(403).json({ error: 'Sin permisos' })
    res.json(section)
  } catch (e) { next(e) }
})

// GET /api/sections/student/mine — sections enrolled by the student
router.get('/student/mine', async (req, res, next) => {
  try {
    const enrollments = await prisma.enrollment.findMany({
      where: { studentId: req.user.sub, status: 'activo' },
      include: {
        section: { include: { course: true, professor: true, period: true } },
      },
    })
    res.json(enrollments.map(e => e.section))
  } catch (e) { next(e) }
})

export default router
