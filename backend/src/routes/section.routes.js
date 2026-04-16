import express from 'express'
import prisma from '../lib/prisma.js'

const router = express.Router()

/* =========================
   GET COURSES
========================= */
router.get('/courses', async (req, res) => {
  try {
    const courses = await prisma.course.findMany({
      select: {
        id: true,
        code: true,
        name: true,
      },
      orderBy: { name: 'asc' },
    })

    res.json(courses)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Error cargando materias' })
  }
})

/* =========================
   GET PERIODS
========================= */
router.get('/periods', async (req, res) => {
  try {
    const periods = await prisma.period.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
      },
      orderBy: { id: 'desc' },
    })

    res.json(periods)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Error cargando períodos' })
  }
})

/* =========================
   CREATE SECTION
========================= */
router.post('/sections', async (req, res) => {
  try {
    const {
      courseId,
      professorId,
      periodId,
      sectionNo,
      classDay,
      startTime,
      endTime,
    } = req.body

    if (!courseId || !professorId || !periodId || !sectionNo || !classDay || !startTime || !endTime) {
      return res.status(400).json({
        error: 'Debes completar materia, profesor, período, sección, día, hora de inicio y hora de fin.',
      })
    }

    const section = await prisma.section.create({
      data: {
        courseId: Number(courseId),
        professorId,
        periodId: Number(periodId),
        sectionNo: Number(sectionNo),
        classDay,
        startTime,
        endTime,
        schedule: `${classDay} ${startTime}-${endTime}`,
      },
    })

    res.json(section)
  } catch (e) {
    console.error(e)

    if (e.code === 'P2002') {
      return res.status(400).json({
        error: 'Ya existe esa sección para ese período',
      })
    }

    res.status(500).json({ error: 'Error creando sección' })
  }
})

/* =========================
   GET SECTION BY ID
========================= */
router.get('/sections/:id', async (req, res) => {
  try {
    const { id } = req.params

    const section = await prisma.section.findUnique({
      where: { id },
      include: {
        course: true,
        period: true,
        professor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        classSessions: true,
      },
    })

    if (!section) {
      return res.status(404).json({ error: 'Sección no encontrada' })
    }

    res.json(section)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Error cargando sección' })
  }
})

/* =========================
   ENROLL STUDENTS
========================= */
router.post('/sections/:id/enrollments', async (req, res) => {
  const { id } = req.params
  const { studentIds } = req.body

  try {
    const safeStudentIds = Array.isArray(studentIds) ? studentIds : []

    await prisma.enrollment.deleteMany({
      where: { sectionId: id },
    })

    if (safeStudentIds.length > 0) {
      const data = safeStudentIds.map((studentId) => ({
        studentId,
        sectionId: id,
      }))

      await prisma.enrollment.createMany({
        data,
        skipDuplicates: true,
      })
    }

    res.json({ success: true })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Error guardando inscripciones' })
  }
})

/* =========================
   GET SECTIONS
========================= */
router.get('/sections', async (req, res) => {
  try {
    const sections = await prisma.section.findMany({
      include: {
        course: true,
        period: true,
        professor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        classSessions: true,
      },
      orderBy: [
        { periodId: 'desc' },
        { courseId: 'asc' },
        { sectionNo: 'asc' },
      ],
    })

    res.json(sections)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Error cargando secciones' })
  }
})

export default router