import { Router } from 'express'
import prisma from '../lib/prisma.js'
import { requireAuth, requireRole } from '../middlewares/auth.middleware.js'

const router = Router()

router.use(requireAuth)

// GET /api/users/me
router.get('/me', async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.sub },
      include: { role: true, career: true, department: true },
    })
    res.json(user)
  } catch (e) {
    next(e)
  }
})

// GET /api/users  (registro only)
router.get('/', requireRole('registro'), async (req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      include: { role: true, career: true, department: true },
      orderBy: { lastName: 'asc' },
    })
    res.json(users)
  } catch (e) {
    next(e)
  }
})

/* =========================
   PROFESORES
========================= */
// GET /api/users/professors
router.get('/professors', async (req, res, next) => {
  try {
    const professors = await prisma.user.findMany({
      where: {
        role: { name: 'profesor' },
        isActive: true,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
      },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    })

    res.json(professors)
  } catch (e) {
    next(e)
  }
})

/* =========================
   ESTUDIANTES
========================= */
// GET /api/users/students
router.get('/students', async (req, res, next) => {
  try {
    const students = await prisma.user.findMany({
      where: {
        role: { name: 'estudiante' },
        isActive: true,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        institutionalId: true,
      },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    })

    res.json(students)
  } catch (e) {
    next(e)
  }
})

export default router