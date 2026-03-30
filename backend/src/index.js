// src/index.js
import 'dotenv/config'
import express from 'express'
import cors    from 'cors'
import helmet  from 'helmet'

import authRoutes       from './routes/auth.routes.js'
import userRoutes       from './routes/user.routes.js'
import attendanceRoutes from './routes/attendance.routes.js'
import gradeRoutes      from './routes/grade.routes.js'
import exportRoutes     from './routes/export.routes.js'
import sectionRoutes    from './routes/section.routes.js'
import reportRoutes     from './routes/report.routes.js'

const app  = express()
const PORT = process.env.PORT ?? 3000

app.use(helmet())
app.use(cors({
  origin:      process.env.ORIGIN ?? 'http://localhost:5173',
  credentials: true,
}))
app.use(express.json())

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/auth',       authRoutes)
app.use('/api/users',      userRoutes)
app.use('/api/attendance', attendanceRoutes)
app.use('/api/grades',     gradeRoutes)
app.use('/api/export',     exportRoutes)
app.use('/api/sections',   sectionRoutes)
app.use('/api/reports',    reportRoutes)

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }))

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  const status = err.status ?? 500
  if (process.env.NODE_ENV !== 'production') console.error(err)
  res.status(status).json({ error: err.message ?? 'Error interno del servidor' })
})

app.listen(PORT, () => console.log(`🚀 API escuchando en http://localhost:${PORT}`))
