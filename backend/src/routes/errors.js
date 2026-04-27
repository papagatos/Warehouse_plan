import { Router } from 'express'
import { requireAuth, requireRole } from '../middleware/auth.js'
import fs from 'fs'
import path from 'path'

const router = Router()
const LOG_FILE = '/root/warehouse-plan/logs/frontend-errors.log'
const BACKEND_LOG = '/root/warehouse-plan/logs/backend-err.log'

// Дедупликация — храним message+url последних 5 минут
const recentErrors = new Map()
const DEDUP_MS = 5 * 60 * 1000

function isDuplicate(key) {
  const last = recentErrors.get(key)
  if (last && Date.now() - last < DEDUP_MS) return true
  recentErrors.get(key) // чистим старые
  recentErrors.set(key, Date.now())
  return false
}

// POST /api/errors — принять ошибку с фронтенда
router.post('/', requireAuth, async (req, res) => {
  try {
    const { message, stack, url, userAgent } = req.body
    if (!message) return res.json({ ok: true })

    const key = `${message}|${url}`
    if (isDuplicate(key)) return res.json({ ok: true })

    const line = [
      `[${new Date().toISOString().replace('T',' ').slice(0,19)}]`,
      `ROLE:${req.user.role}`,
      `URL:${url || '—'}`,
      `\nmessage: ${message}`,
      `\nstack: ${(stack || '').slice(0, 500)}`,
      `\nua: ${(userAgent || '').slice(0, 100)}`,
      '\n---\n'
    ].join(' ')

    fs.appendFileSync(LOG_FILE, line)
    res.json({ ok: true })
  } catch (e) {
    res.json({ ok: true }) // никогда не падаем из-за логирования
  }
})

// GET /api/errors — последние 20 ошибок
router.get('/', requireAuth, requireRole('SUPER'), async (req, res) => {
  try {
    if (!fs.existsSync(LOG_FILE)) return res.json({ errors: [] })

    const content = fs.readFileSync(LOG_FILE, 'utf8')
    const blocks = content.split('---\n').filter(b => b.trim())
    const last20 = blocks.slice(-20).reverse()

    const errors = last20.map(block => {
      const lines = block.trim().split('\n')
      const header = lines[0] || ''
      const message = (lines[1] || '').replace('message: ', '')
      const stack = (lines[2] || '').replace('stack: ', '')
      const ua = (lines[3] || '').replace('ua: ', '')

      const timeMatch = header.match(/\[(.+?)\]/)
      const roleMatch = header.match(/ROLE:(\w+)/)
      const urlMatch = header.match(/URL:(\S+)/)

      return {
        time: timeMatch?.[1] || '',
        role: roleMatch?.[1] || '',
        url: urlMatch?.[1] || '',
        message,
        stack,
        ua,
      }
    })

    res.json({ errors })
  } catch (e) {
    res.json({ errors: [] })
  }
})

// GET /api/errors/download — скачать полный файл
router.get('/download', requireAuth, requireRole('SUPER'), (req, res) => {
  if (!fs.existsSync(LOG_FILE)) {
    // Файл ещё не создан — отдаём пустой
    res.setHeader('Content-Disposition', `attachment; filename="frontend-errors-${new Date().toISOString().slice(0,10)}.log"`)
    res.setHeader('Content-Type', 'text/plain')
    return res.send('Ошибок пока не было\n')
  }
  res.download(LOG_FILE, `frontend-errors-${new Date().toISOString().slice(0,10)}.log`)
})

// GET /api/errors/backend — последние 50 строк backend-err.log
router.get('/backend', requireAuth, requireRole('SUPER'), (req, res) => {
  try {
    if (!fs.existsSync(BACKEND_LOG)) return res.json({ lines: [] })
    const content = fs.readFileSync(BACKEND_LOG, 'utf8')
    const lines = content.split('\n').filter(l => l.trim()).slice(-50).reverse()
    res.json({ lines })
  } catch { res.json({ lines: [] }) }
})

// GET /api/errors/backend/download
router.get('/backend/download', requireAuth, requireRole('SUPER'), (req, res) => {
  if (!fs.existsSync(BACKEND_LOG)) {
    res.setHeader('Content-Disposition', `attachment; filename="backend-err-${new Date().toISOString().slice(0,10)}.log"`)
    res.setHeader('Content-Type', 'text/plain')
    return res.send('Ошибок пока не было\n')
  }
  res.download(BACKEND_LOG, `backend-err-${new Date().toISOString().slice(0,10)}.log`)
})

export default router
