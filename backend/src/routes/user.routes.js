// src/routes/user.routes.js
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
  } catch (e) { next(e) }
})

// GET /api/users  (registro/admin only)
router.get('/', requireRole('registro'), async (req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      include: { role: true, career: true, department: true },
      orderBy: { lastName: 'asc' },
    })
    res.json(users)
  } catch (e) { next(e) }
})

export default router
