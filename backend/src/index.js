import 'express-async-errors'
import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { startEmailWorker } from './workers/emailWorker.js'
import { startAutoPostponeScheduler } from './workers/autoPostpone.js'
import authRoutes  from './routes/auth.js'
import planRoutes  from './routes/plans.js'
import adminRoutes from './routes/admin.js'
import rowRoutes from './routes/rows.js'
import photoRoutes from './routes/photos.js'
import labelRoutes from './routes/labels.js'
import settingsRoutes from './routes/settings.js'
import errorsRoutes  from './routes/errors.js'

dotenv.config()

const app  = express()
const PORT = process.env.PORT || 3000

// ── Middleware ────────────────────────────────────────────────
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// ── Routes ────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.use('/auth',   authRoutes)
app.use('/plans',  planRoutes)
app.use('/admin',  adminRoutes)
app.use('/rows', rowRoutes)
app.use('/photos', photoRoutes)
app.use('/labels', labelRoutes)
app.use('/settings', settingsRoutes)
app.use('/errors',   errorsRoutes)

// ── Error handler ─────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[ERROR]', err.message)

  if (err.name === 'ZodError') {
    return res.status(400).json({ error: 'Ошибка валидации', details: err.errors })
  }
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return res.status(401).json({ error: 'Недействительный токен' })
  }
  if (err.code === 'P2002') {
    return res.status(409).json({ error: 'Запись уже существует' })
  }

  const status = err.status || err.statusCode || 500
  res.status(status).json({ error: err.message || 'Внутренняя ошибка сервера' })
})

// ── Запуск ────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✓ Сервер запущен: http://localhost:${PORT}`)
  console.log(`  Среда: ${process.env.NODE_ENV || 'development'}`)
  startEmailWorker()
  startAutoPostponeScheduler()
})
